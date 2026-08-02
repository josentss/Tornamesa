import Image from 'next/image';

export default function ActivityFeed({ activities }) {
  if (!activities || activities.length === 0) {
    return <p className="text-stone-500 text-sm py-8 text-center">No recent activity.</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((act, idx) => (
        <div key={idx} className="flex items-center gap-4 bg-[#131e2c]/60 border border-[#2a3645] rounded-lg p-3 hover:border-[#3d5068] transition-colors">
          <div className="w-12 h-12 rounded overflow-hidden bg-[#1f2b3a] flex-shrink-0">
            {act.album.cover && (
              <Image src={act.album.cover} alt={act.album.title} width={48} height={48} className="object-cover w-full h-full" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{act.album.title}</p>
            <p className="text-xs text-stone-400 truncate">{act.album.artist}</p>
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
