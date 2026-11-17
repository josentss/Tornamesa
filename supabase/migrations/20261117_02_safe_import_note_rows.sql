-- PR #10: atomic, idempotent .txt import per user + source file + line.
-- Manual migration. Take a backup before applying. This does not rewrite
-- historical listens, albums, reviews or monthly summaries.
BEGIN;

CREATE TABLE IF NOT EXISTS public.import_note_rows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  line_index integer NOT NULL CHECK (line_index > 0),
  album_id varchar NOT NULL REFERENCES public.albums(spotify_id),
  listen_count integer NOT NULL CHECK (listen_count BETWEEN 1 AND 50),
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, file_sha256, line_index)
);

ALTER TABLE public.import_note_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_note_rows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.import_note_rows TO service_role;

CREATE OR REPLACE FUNCTION public.commit_note_import_atomic(
  p_user_id uuid,
  p_file_sha256 text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_album text;
  v_index integer;
  v_year integer;
  v_month integer;
  v_count integer;
  v_timestamps jsonb;
  v_stamp text;
  v_date timestamptz;
  v_tz text;
  v_new integer;
  v_imported integer := 0;
  v_skipped integer := 0;
  v_lines integer := 0;
  v_total integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_file_sha256 !~ '^[0-9a-f]{64}$'
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 150 THEN
    RAISE EXCEPTION 'Invalid import request' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.profiles AS p WHERE p.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown profile' USING ERRCODE = '22023';
  END IF;

  v_tz := public.monthly_top_timezone(p_user_id);

  -- All lines are committed or all are rolled back on error. Re-sending a
  -- previously imported line skips it, including under concurrent requests.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_album := v_item->>'albumId';
    v_index := (v_item->>'lineIndex')::integer;
    v_year := (v_item->>'year')::integer;
    v_month := (v_item->>'month')::integer;
    v_timestamps := v_item->'timestamps';

    IF v_album IS NULL OR v_album !~ '^[a-zA-Z0-9]{22}$'
       OR v_index IS NULL OR v_index <= 0
       OR v_year IS NULL OR v_year NOT BETWEEN 1900 AND 2100
       OR v_month IS NULL OR v_month NOT BETWEEN 1 AND 12
       OR v_timestamps IS NULL OR jsonb_typeof(v_timestamps) <> 'array'
       OR jsonb_array_length(v_timestamps) NOT BETWEEN 1 AND 50
    THEN
      RAISE EXCEPTION 'Invalid import line' USING ERRCODE = '22023';
    END IF;
    v_count := jsonb_array_length(v_timestamps);
    v_total := v_total + v_count;
    v_lines := v_lines + 1;
    IF v_total > 400 THEN
      RAISE EXCEPTION 'Import limit exceeded' USING ERRCODE = '22023';
    END IF;

    -- All referenced albums must have been resolved locally before commit.
    PERFORM 1 FROM public.albums WHERE spotify_id = v_album;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Album not in local catalog'
        USING ERRCODE = '23503';
    END IF;

    -- Validate every date before claiming the line so a malformed replay
    -- cannot convert an already-imported line into success.
    FOR v_stamp IN SELECT value FROM jsonb_array_elements_text(v_timestamps)
    LOOP
      v_date := v_stamp::timestamptz;
      IF extract(year FROM v_date AT TIME ZONE v_tz)::integer <> v_year
         OR extract(month FROM v_date AT TIME ZONE v_tz)::integer <> v_month THEN
        RAISE EXCEPTION 'Listen timestamp does not match source month'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;

    INSERT INTO public.import_note_rows
      (user_id, file_sha256, line_index, album_id, listen_count)
    VALUES (p_user_id, p_file_sha256, v_index, v_album, v_count)
    ON CONFLICT (user_id, file_sha256, line_index) DO NOTHING;
    GET DIAGNOSTICS v_new = ROW_COUNT;

    IF v_new > 0 THEN
      INSERT INTO public.listens (user_id, album_id, listened_at)
      SELECT p_user_id, v_album, value::timestamptz
      FROM jsonb_array_elements_text(v_timestamps);
      v_imported := v_imported + v_count;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_imported,
    'linesImported', v_lines - v_skipped,
    'linesAlreadyImported', v_skipped,
    'idempotent', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_note_import_atomic(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_note_import_atomic(uuid,text,jsonb)
  TO service_role;

COMMIT;

-- Read-only verification:
-- SELECT has_function_privilege('anon','public.commit_note_import_atomic(uuid,text,jsonb)','EXECUTE'),
--        has_function_privilege('authenticated','public.commit_note_import_atomic(uuid,text,jsonb)','EXECUTE'),
--        has_function_privilege('service_role','public.commit_note_import_atomic(uuid,text,jsonb)','EXECUTE');
