import Image from "next/image";

export default function ActivityFeed({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1f2b3a] flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-500"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <p className="text-stone-400 text-sm font-medium">No hay actividad reciente</p>
        <p className="text-stone-500 text-xs mt-1 max-w-[220px]">
          Cuando registres álbumes aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((act, idx) => (
        <div
          key={idx}
          className="flex items-center gap-4 bg-[#131e2c]/60 border border-[#2a3645] rounded-lg p-3 hover:border-[#3d5068] transition-colors"
        >
          <div className="w-12 h-12 rounded overflow-hidden bg-[#1f2b3a] flex-shrink-0">
            {act.album.cover && (
              <Image
                src={act.album.cover}
                alt={act.album.title}
                width={48}
                height={48}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{act.album.title}</p>
            <p className="text-xs text-stone-400 truncate">{act.album.artist}</p>
            {act.album.rating && (
              <span className="text-xs text-yellow-400 mt-1 inline-block">
                ★ {act.album.rating}/10
              </span>
            )}
          </div>
          {act.count > 1 && (
            <span className="text-xs font-bold text-[#7cc7e8] bg-[#0a121c] px-2 py-1 rounded border border-[#2a3645]">
              x{act.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
