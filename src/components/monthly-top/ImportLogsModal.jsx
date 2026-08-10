"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";

const MAX_FILES_PER_RUN = 1;
const CHUNK_SIZE = 10;

export default function ImportLogsModal({ open, onClose, onImported }) {
  const inputRef = useRef(null);
  const [step, setStep] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedAmbiguous, setSelectedAmbiguous] = useState({});
  const [commitResult, setCommitResult] = useState(null);

  if (!open) return null;

  const reset = () => {
    setStep("upload");
    setLoading(false);
    setProgress(null);
    setError(null);
    setPreview(null);
    setSelectedAmbiguous({});
    setCommitResult(null);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const mergePreview = (acc, chunk) => {
    if (!acc) {
      return {
        matched: [...(chunk.matched || [])],
        ambiguous: [...(chunk.ambiguous || [])],
        unmatched: [...(chunk.unmatched || [])],
        parseErrors: [...(chunk.parseErrors || [])],
      };
    }
    return {
      matched: [...acc.matched, ...(chunk.matched || [])],
      ambiguous: [...acc.ambiguous, ...(chunk.ambiguous || [])],
      unmatched: [...acc.unmatched, ...(chunk.unmatched || [])],
      parseErrors: [...acc.parseErrors, ...(chunk.parseErrors || [])],
    };
  };

  const buildSummary = (data) => {
    const matched = data.matched || [];
    const ambiguous = data.ambiguous || [];
    const unmatched = data.unmatched || [];
    return {
      matched: matched.length,
      ambiguous: ambiguous.length,
      unmatched: unmatched.length,
      parseErrors: (data.parseErrors || []).length,
      totalListensIfImported: matched.reduce((s, r) => s + (r.count || 0), 0),
      rowsParsed: matched.length + ambiguous.length + unmatched.length,
    };
  };

  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (files.length > MAX_FILES_PER_RUN) {
      setError("Please select 1 month file at a time (avoids timeouts).");
      return;
    }

    for (const f of files) {
      if (!/^\d{4}-\d{2}\.txt$/i.test(f.name)) {
        setError(
          `Invalid filename: "${f.name}". Use YYYY-MM.txt (e.g. 2025-03.txt).`
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0 });

    try {
      const payload = [];
      for (const f of files) {
        const content = await f.text();
        if (content.length > 200_000) {
          throw new Error(`File too large: ${f.name}`);
        }
        payload.push({ name: f.name, content });
      }

      let offset = 0;
      let merged = null;
      let done = false;
      let totalRows = 0;

      while (!done) {
        const data = await api.previewNotesImport(payload, {
          offset,
          limit: CHUNK_SIZE,
        });

        if (!data.chunk) {
          merged = mergePreview(null, data);
          done = true;
        } else {
          merged = mergePreview(merged, data);
          totalRows = data.chunk.totalRows;
          offset = data.chunk.nextOffset;
          done = Boolean(data.chunk.done);
          setProgress({
            done: Math.min(offset, totalRows),
            total: totalRows,
          });
        }
      }

      setPreview({
        ...merged,
        summary: buildSummary(merged),
      });
      setStep("preview");
    } catch (err) {
      setError(err.message || "Preview failed");
    } finally {
      setLoading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const ambKey = (row, i) => `${row.sourceFile}|${row.raw}|${i}`;

  const itemsToImport = () => {
    if (!preview) return [];
    const items = (preview.matched || []).map((r) => ({
      albumId: r.albumId,
      count: r.count,
      year: r.year,
      month: r.month,
      title: r.title,
      artist: r.artist,
    }));

    (preview.ambiguous || []).forEach((r, i) => {
      const key = ambKey(r, i);
      const chosen =
        selectedAmbiguous[key] || r.albumId || r.candidates?.[0]?.id;
      if (chosen) {
        items.push({
          albumId: chosen,
          count: r.count,
          year: r.year,
          month: r.month,
          title: r.title,
          artist: r.artist,
        });
      }
    });

    return items;
  };

  const handleCommit = async () => {
    const items = itemsToImport();
    if (!items.length) {
      setError("Nothing to import");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.commitNotesImport(items);
      setCommitResult(res);
      setStep("done");
      onImported?.(res);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={handleClose}
        aria-label="Close"
      />
      <div className="relative w-full sm:max-w-lg bg-[#131e2c] border border-[#2a3645] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Import month logs
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-stone-500 hover:text-white text-sm"
            >
              Close
            </button>
          </div>

          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-stone-400">
                Import one month at a time. Files must be named{" "}
                <code className="text-[#7cc7e8] text-xs">YYYY-MM.txt</code>.
                Matching runs in batches to avoid timeouts.
              </p>
              <pre className="text-xs bg-[#0a121c] border border-[#2a3645] rounded-lg p-3 text-stone-300 overflow-x-auto">
{`Discos escuchados
4- In Rainbows, Radiohead
2- Kid A, Radiohead`}
              </pre>

              <input
                ref={inputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(e) => readFiles(e.target.files)}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                className="w-full py-3 rounded-xl bg-[#7cc7e8] text-[#0a121c] text-sm font-semibold hover:bg-[#a5d8f0] disabled:opacity-50"
              >
                {loading
                  ? progress?.total
                    ? `Analyzing ${progress.done}/${progress.total}…`
                    : "Analyzing…"
                  : "Choose .txt file"}
              </button>
              {loading && progress?.total > 0 && (
                <div className="h-1.5 rounded-full bg-[#0a121c] overflow-hidden">
                  <div
                    className="h-full bg-[#7cc7e8] transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (100 * progress.done) / Math.max(1, progress.total)
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  ["Matched", preview.summary?.matched],
                  ["Review", preview.summary?.ambiguous],
                  ["Unmatched", preview.summary?.unmatched],
                  ["Listens", preview.summary?.totalListensIfImported],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="bg-[#0a121c] border border-[#2a3645] rounded-lg py-2 px-1"
                  >
                    <p className="text-lg font-semibold text-white">
                      {val ?? 0}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-stone-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {(preview.ambiguous || []).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">
                    Needs review
                  </h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {preview.ambiguous.map((row, i) => {
                      const key = ambKey(row, i);
                      const value =
                        selectedAmbiguous[key] ||
                        row.albumId ||
                        row.candidates?.[0]?.id ||
                        "";
                      return (
                        <div
                          key={key}
                          className="bg-[#0a121c] border border-[#2a3645] rounded-lg p-3"
                        >
                          <p className="text-sm text-white truncate">
                            {row.title}{" "}
                            <span className="text-stone-500">
                              · {row.artist}
                            </span>
                          </p>
                          <p className="text-[10px] text-stone-600 mb-1.5">
                            ×{row.count} · {row.sourceFile}
                          </p>
                          <select
                            value={value}
                            onChange={(e) =>
                              setSelectedAmbiguous((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            className="w-full bg-[#131e2c] border border-[#2a3645] rounded-lg px-2 py-1.5 text-xs text-stone-200"
                          >
                            {(row.candidates || []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title} — {c.artist} ({c.score})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(preview.unmatched || []).length > 0 && (
                <details className="text-sm">
                  <summary className="text-stone-500 cursor-pointer">
                    Unmatched ({preview.unmatched.length}) — skipped
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto text-xs text-stone-400">
                    {preview.unmatched.slice(0, 40).map((r, i) => (
                      <li key={i}>
                        {r.title} — {r.artist} (×{r.count})
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep("upload");
                    setPreview(null);
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-[#2a3645] text-sm text-stone-300"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={loading || itemsToImport().length === 0}
                  onClick={handleCommit}
                  className="flex-1 py-2.5 rounded-lg bg-[#7cc7e8] text-[#0a121c] text-sm font-semibold disabled:opacity-50"
                >
                  {loading
                    ? "Importing..."
                    : `Import ${itemsToImport().length} albums`}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center py-4">
              <p className="text-white font-semibold">Import complete</p>
              <p className="text-sm text-stone-400">
                Inserted{" "}
                <span className="text-[#7cc7e8] font-semibold">
                  {commitResult?.inserted ?? 0}
                </span>{" "}
                listens. Monthly tops for those months were recomputed.
              </p>
              {commitResult?.monthsRecomputed?.length > 0 && (
                <p className="text-xs text-stone-500">
                  Updated: {commitResult.monthsRecomputed.join(", ")}
                </p>
              )}
              {commitResult?.failures?.length > 0 && (
                <p className="text-xs text-amber-400">
                  {commitResult.failures.length} item(s) failed
                </p>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-lg bg-[#7cc7e8] text-[#0a121c] text-sm font-semibold"
              >
                Done
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
}
