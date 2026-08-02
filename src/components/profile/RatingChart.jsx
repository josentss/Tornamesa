export default function RatingChart({ distribution }) {
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="space-y-1.5">
      {Object.entries(distribution)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([rating, count]) => {
          const percentage = (count / maxCount) * 100;
          return (
            <div key={rating} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-right text-stone-400">{rating}</span>
              <div className="flex-1 bg-[#0a121c] h-2 rounded-full overflow-hidden border border-[#2a3645]">
                <div
                  className="bg-[#7cc7e8] h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-6 text-stone-500 font-mono">{count}</span>
            </div>
          );
        })}
    </div>
  );
}
