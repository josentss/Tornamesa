import Image from "next/image";

export default function MonthlyTopWidget({ albums }) {
  if (!albums || albums.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-stone-500">Sin datos este mes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {albums.map((album, i) => (
        <div
          key={i}
          className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded p-1 -mx-1 transition-colors"
        >
          <span className="text-sm font-bold text-[#7cc7e8] w-4">{i + 1}</span>
          <div className="w-8 h-8 rounded overflow-hidden bg-[#1f2b3a] flex-shrink-0">
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
            <p className="text-xs font-medium text-white truncate">{album.title}</p>
            <p className="text-[10px] text-stone-400">
              {album.count} play{album.count > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      ))}
      <button className="text-xs text-[#7cc7e8] hover:underline mt-2 w-full text-left">
        View full top
      </button>
    </div>
  );
}
