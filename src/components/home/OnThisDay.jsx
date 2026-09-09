"use client";

import Image from "next/image";
import Link from "next/link";

export default function OnThisDay({ data }) {
  if (!data?.years?.length) return null;

  const { label, years } = data;
  const total = years.reduce((n, y) => n + (y.items?.length || 0), 0);
  if (total === 0) return null;

  return (
    <section className="rounded-2xl border border-[#2a3645] bg-[#131e2c]/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#7cc7e8]">
            On this day
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            {label}
          </h2>
          <p className="text-[11px] text-stone-500 mt-1">
            {total === 1
              ? "1 album from past years"
              : `${total} albums from past years`}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {years.map((block) => {
          if (!block.items?.length) return null;
          return (
            <div key={block.year}>
              <p className="text-[11px] text-stone-500 mb-2.5">
                <span className="text-stone-300 font-medium">
                  {block.yearsAgo === 1
                    ? "1 year ago"
                    : `${block.yearsAgo} years ago`}
                </span>
                <span className="text-stone-600"> · {block.year}</span>
              </p>

              <ul className="space-y-2">
                {block.items.map((item) => (
                  <li key={item.listenId}>
                    <Link
                      href={`/album/${item.album.id}`}
                      className="flex items-center gap-3 rounded-xl border border-[#2a3645] bg-[#0a121c]/80 px-2.5 py-2 hover:border-[#7cc7e8]/40 transition-colors group min-w-0"
                    >
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[#1f2b3a] flex-shrink-0 border border-[#2a3645]">
                        {item.album.cover ? (
                          <Image
                            src={item.album.cover}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                          {item.album.title}
                        </p>
                        <p className="text-xs text-stone-500 truncate">
                          {item.album.artist}
                        </p>
                      </div>
                      {item.rating != null && (
                        <span className="text-[11px] font-bold text-yellow-400 flex-shrink-0">
                          ★ {item.rating}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
