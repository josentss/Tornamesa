export default function ListsPreview({ lists }) {
  if (!lists || lists.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-stone-500 mb-2">Aún no hay listas</p>
        <button className="text-xs text-[#7cc7e8] hover:underline">
          Crear una lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lists.slice(0, 3).map((list, idx) => (
        <div
          key={idx}
          className="text-sm text-stone-300 hover:text-white transition-colors cursor-pointer"
        >
          {list.name}{" "}
          <span className="text-stone-500 text-xs">({list.count} albums)</span>
        </div>
      ))}
      <button className="text-xs text-[#7cc7e8] hover:underline mt-2">
        View all lists
      </button>
    </div>
  );
}
