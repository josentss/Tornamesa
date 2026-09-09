"use client";

import Image from "next/image";
import Link from "next/link";

export default function OnThisDay({ data }) {
  if (!data?.years?.length) return null;

  const { label, years } = data;
  const flat = years.flatMap((block) =>
    (block.items || []).map((item) => ({
      ...item,
      year: block.year,
      yearsAgo: block.yearsAgo,
    }))
  );
  if (!flat.length) return null;

  const shown = flat.slice(0, 4);
  const extra = flat.length - shown.length;

  return (
    <section className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-1">
      <div className="flex-shrink-0 min-w-0 sm:w-[9.5rem]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
          On this day
        </p>
        <p className="text-xs text-stone-400 mt-0.5 truncate">
          {label}
          {flat.length === 1 && flat[0].yearsAgo != null && (
            <span className="text-stone-600">
              {" "}
              ·{" "}
              {flat[0].yearsAgo === 1
                ? "1 year ago"
                : `${flat[0].yearsAgo}y ago`}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto scrollbar-none">
        {shown.map((item) => (
          <Link
            key={item.listenId}
            href={`/album/${item.album.id}`}
            title={`${item.album.title}${item.yearsAgo ? ` · ${item.yearsAgo}y ago` : ""}`}
            className="flex items-center gap-2 rounded-lg border border-[#2a3645] bg-[#131e2c]/80 pl-1 pr-2.5 py-1 hover:border-[#7cc7e8]/40 transition-colors flex-shrink-0 max-w-[200px] group"
          >
            <div className="relative w-9 h-9 rounded-md overflow-hidden bg-[#1f2b3a] flex-shrink-0">
              {item.album.cover ? (
                <Image
                  src={item.album.cover}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                {item.album.title}
              </p>
              <p className="text-[10px] text-stone-500 truncate">
                {item.album.artist}
              </p>
            </div>
          </Link>
        ))}
        {extra > 0 && (
          <span className="text-[10px] text-stone-500 flex-shrink-0 px-1">
            +{extra}
          </span>
        )}
      </div>
    </section>
  );
}
