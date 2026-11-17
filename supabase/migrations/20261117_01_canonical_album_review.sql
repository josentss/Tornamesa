-- Tornamesa: canonical album ratings (Phase 2 follow-up).
-- REQUIRED manual migration before deploying code that calls this RPC.
-- Backup first. Does NOT change, delete, migrate or expose legacy listen
-- ratings or notes. A separate, explicitly optional backfill is documented.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_listen_and_album_review(
  p_user_id uuid,
  p_listen_id bigint,
  p_change_date boolean DEFAULT false,
  p_listened_at timestamptz DEFAULT NULL,
  p_change_review boolean DEFAULT false,
  p_rating smallint DEFAULT NULL,
  p_review_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_listen public.listens%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_note text;
BEGIN
  IF p_user_id IS NULL OR p_listen_id IS NULL
     OR (NOT p_change_date AND NOT p_change_review) THEN
    RAISE EXCEPTION 'Invalid listen update' USING ERRCODE = '22023';
  END IF;

  -- Defense in depth: even a compromised endpoint cannot edit another user's
  -- listen by supplying a mismatched ID. Only service_role may call this RPC.
  SELECT l.* INTO v_listen
  FROM public.listens AS l
  WHERE l.id = p_listen_id AND l.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listen not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_change_date THEN
    IF p_listened_at IS NULL THEN
      RAISE EXCEPTION 'Date must not be null' USING ERRCODE = '22023';
    END IF;
    UPDATE public.listens AS l
      SET listened_at = p_listened_at
    WHERE l.id = v_listen.id
    RETURNING l.* INTO v_listen;
  END IF;

  IF p_change_review THEN
    v_note := NULLIF(btrim(p_review_text), '');
    IF p_rating IS NULL THEN
      -- Clearing a rating deletes the general review (including its text).
      -- The UI must not do this silently on a normal save.
      IF v_note IS NOT NULL THEN
        RAISE EXCEPTION 'An album review needs a rating'
          USING ERRCODE = '22023';
      END IF;
      DELETE FROM public.reviews AS r
      WHERE r.user_id = p_user_id AND r.album_id = v_listen.album_id;
    ELSE
      IF p_rating < 1 OR p_rating > 10 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 10'
          USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.reviews AS r
        (user_id, album_id, rating, review_text)
      VALUES
        (p_user_id, v_listen.album_id, p_rating, v_note)
      ON CONFLICT (user_id, album_id) DO UPDATE SET
        rating = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        updated_at = now();
    END IF;
  END IF;

  SELECT r.* INTO v_review FROM public.reviews AS r
  WHERE r.user_id = p_user_id AND r.album_id = v_listen.album_id;

  -- Return the review as the display source, never the legacy listen rating.
  RETURN jsonb_build_object(
    'id', v_listen.id,
    'user_id', v_listen.user_id,
    'album_id', v_listen.album_id,
    'listened_at', v_listen.listened_at,
    'rating', v_review.rating,
    'albumRating', v_review.rating,
    'review', v_review.review_text,
    'albumReview', v_review.review_text,
    'listenRating', v_listen.rating,
    'legacyNote', v_listen.review
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_listen_and_album_review(
  uuid, bigint, boolean, timestamptz, boolean, smallint, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_listen_and_album_review(
  uuid, bigint, boolean, timestamptz, boolean, smallint, text
) TO service_role;

COMMIT;

-- Read-only verification (run separately after applying):
-- SELECT p.proname, p.prosecdef,
--   has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
--   has_function_privilege('authenticated',p.oid,'EXECUTE') AS user_execute,
--   has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
-- FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid=p.pronamespace
-- WHERE n.nspname='public'
--   AND p.proname='update_listen_and_album_review';
