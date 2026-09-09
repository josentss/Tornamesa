"use client";

import Image from "next/image";
import Link from "next/link";
import HScroll from "@/components/home/HScroll";

export default function OnThisDay({ data }) {
  if (!data?.years?.length) return null;

  const { label, years } = data;

  return (
    <section className="mt-8 sm:mt-10">
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="text-[11px] sm:text-xs text-stone-400 font-bold uppercase tracking-widest">
            On this day
          </h2>
          <p className="text-sm text-white font-semibold mt-0.5">{label}</p>
        </div>
      </div>

      <div className="space-y-5">
        {years.map((block) => (
          <div key={block.year}>
            <p className="text-[11px] text-stone-500 mb-2">
              {block.yearsAgo === 1
                ? "1 year ago"
                : `${block.yearsAgo} years ago`}
              <span className="text-stone-600"> · {block.year}</span>
            </p>
            <HScroll>
              {block.items.map((item) => (
                <Link
                  key={item.listenId}
                  href={`/album/${item.album.id}`}
                  className="group flex-shrink-0 w-[120px] sm:w-[132px]"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-[#2a3645] bg-[#131e2c] transition-all duration-300 group-hover:border-[#7cc7e8]/50">
                    {item.album.cover ? (
                      <Image
                        src={item.album.cover}
                        alt={item.album.title}
                        fill
                        sizes="132px"
                        className="object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1f2b3a]" />
                    )}
                    {item.rating != null && (
                      <span className="absolute top-1.5 right-1.5 text-[10px] font-bold bg-black/70 text-yellow-400 px-1.5 py-0.5 rounded">
                        ★ {item.rating}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold text-white truncate group-hover:text-[#7cc7e8] transition-colors">
                    {item.album.title}
                  </p>
                  <p className="text-[10px] text-stone-500 truncate">
                    {item.album.artist}
                  </p>
                </Link>
              ))}
            </HScroll>
          </div>
        ))}
      </div>
    </section>
  );
}
