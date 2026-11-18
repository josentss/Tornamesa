import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getRequestUser } from '@/lib/apiAuth';
import { buildListenTimestamps, parseNotesFile } from '@/lib/notesImport';
import { recomputeMonthsForDates } from '@/lib/monthlyTop';
import { normalizeTimeZone } from '@/lib/timezone';
import { rateLimit, clientKey, rateLimitResponse } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ITEMS = 150;
const MAX_LISTENS = 400;
const MAX_COUNT = 50;
const ALBUM_ID = /^[a-zA-Z0-9]{22}$/;
const SOURCE_NAME = /^20\d{2}-(0[1-9]|1[0-2])\.txt$/i;

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * No Spotify requests during commit: an unresolved album remains in preview.
 * One RPC transaction owns the import ledger and all its listen inserts.
 */
export async function POST(request) {
  try {
    const user = await getRequestUser(request);
    if (!user) return bad('Unauthorized', 401);

    const rl = await rateLimit(clientKey(request, 'import-commit', user.id), {
      limit: 5, windowMs: 5 * 60_000, name: 'import-commit',
    });
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json();
    const file = body?.file;
    const items = body?.items;
    if (!file || typeof file !== 'object' ||
        !SOURCE_NAME.test(file.name || '') ||
        typeof file.content !== 'string' || file.content.length > 200_000) {
      return bad('Original YYYY-MM.txt source file is required');
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return bad(`Select 1–${MAX_ITEMS} resolved album lines`);
    }

    const parsed = parseNotesFile(file.content, file.name);
    if (!parsed.year || parsed.month < 1 || parsed.month > 12) {
      return bad('Invalid source month');
    }
    const byLine = new Map(parsed.rows.map((row) => [row.lineIndex, row]));
    const lineIndices = new Set();
    const uniqueIds = new Set();
    let total = 0;

    const supabase = createSupabaseServer();
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('timezone').eq('id', user.id).single();
    if (profileError) throw profileError;
    const tz = normalizeTimeZone(profile?.timezone || 'UTC');
    const prepared = [];
    const dates = [];

    for (const item of items) {
      const lineIndex = Number(item?.lineIndex);
      const albumId = String(item?.albumId || '');
      const sourceRow = byLine.get(lineIndex);
      const count = Number(item?.count);
      if (!Number.isInteger(lineIndex) || lineIndices.has(lineIndex) ||
          !sourceRow || !ALBUM_ID.test(albumId) ||
          !Number.isInteger(count) || count < 1 || count > MAX_COUNT ||
          count !== sourceRow.count ||
          Number(item.year) !== parsed.year ||
          Number(item.month) !== parsed.month) {
        return bad('Invalid or duplicated source line; restart the preview');
      }
      lineIndices.add(lineIndex);
      uniqueIds.add(albumId);
      total += count;
      if (total > MAX_LISTENS) return bad(`Import limit: ${MAX_LISTENS} listens`);

      const stamps = buildListenTimestamps(
        parsed.year, parsed.month, count, lineIndex, tz
      );
      prepared.push({
        albumId,
        lineIndex,
        year: parsed.year,
        month: parsed.month,
        timestamps: stamps,
      });
      dates.push(...stamps);
    }

    const { data: existing, error: catalogError } = await supabase
      .from('albums').select('spotify_id').in('spotify_id', [...uniqueIds]);
    if (catalogError) throw catalogError;
    const known = new Set((existing || []).map((a) => a.spotify_id));
    const missing = [...uniqueIds].filter((id) => !known.has(id));
    if (missing.length) {
      return NextResponse.json(
        {
          error: 'Some albums are not in the local catalog. Resolve them in Preview before import.',
          unresolvedAlbumIds: missing,
        },
        { status: 409 }
      );
    }

    const fileHash = createHash('sha256')
      .update(file.name).update('\0').update(file.content).digest('hex');

    const { data, error } = await supabase.rpc('commit_note_import_atomic', {
      p_user_id: user.id,
      p_file_sha256: fileHash,
      p_items: prepared,
    });
    if (error) {
      console.error('import atomic RPC:', error);
      return bad('Import transaction failed. No new rows from this request were committed.', 500);
    }

    const inserted = Number(data?.inserted) || 0;
    const recomputation = inserted > 0
      ? await recomputeMonthsForDates(user.id, dates)
      : { monthsRecomputed: [], monthsFailed: [] };

    return NextResponse.json({
      success: true,
      inserted,
      linesImported: Number(data?.linesImported) || 0,
      linesAlreadyImported: Number(data?.linesAlreadyImported) || 0,
      invalidLinesSkipped: parsed.parseErrors.length,
      idempotent: true,
      monthsRecomputed: recomputation.monthsRecomputed || [],
      monthsFailed: recomputation.monthsFailed || [],
    });
  } catch (error) {
    console.error('import commit:', error);
    return bad('Import failed before completion', 500);
  }
}
