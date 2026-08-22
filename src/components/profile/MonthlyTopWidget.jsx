import Image from "next/image";
import Link from "next/link";

export default function MonthlyTopWidget({ albums, username }) {
  if (!albums || albums.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-stone-500">No data this month</p>
        {username && (
          <Link
            href={`/${username}/monthly-top`}
            className="text-xs text-[#7cc7e8] hover:underline mt-2 inline-block"
          >
            View full top
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {albums.map((album, i) => (
        <Link
          key={album.id || i}
          href={`/album/${album.id}`}
          className="flex items-center gap-3 hover:bg-white/5 rounded p-1 -mx-1 transition-colors group"
        >
          <span className="text-sm font-bold text-[#7cc7e8] w-4">{i + 1}</span>
          <div className="w-8 h-8 rounded overflow-hidden bg-[#1f2b3a] flex-shrink-0 border border-transparent transition-all duration-300 ease-out group-hover:border-[#7cc7e8]/40 group-hover:shadow-sm group-hover:shadow-black/20">
            {album.cover && (
              <Image
                src={album.cover}
                alt={album.title}
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate group-hover:text-[#7cc7e8] transition-colors">
              {album.title}
            </p>
            <p className="text-[10px] text-stone-400">
              {album.count} play{album.count > 1 ? "s" : ""}
            </p>
          </div>
        </Link>
      ))}
      {username && (
        <Link
          href={`/${username}/monthly-top`}
          className="text-xs text-[#7cc7e8] hover:underline mt-2 inline-block"
        >
          View full top
        </Link>
      )}
    </div>
  );
}
