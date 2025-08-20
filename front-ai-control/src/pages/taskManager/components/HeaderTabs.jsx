const tabs = ["Tasks", "Overview", "Statistics", "Team"];

export default function HeaderTabs() {
  return (
    <nav className="flex border-b border-gray-200 space-x-6 text-gray-600">
      {tabs.map((tab, i) => (
        <button
          key={i}
          className={`pb-2 border-b-2 ${
            i === 0
              ? "border-green-600 text-green-600 font-medium"
              : "border-transparent hover:text-green-500"
          }`}
        >
          {tab}
        </button>
      ))}
      <div className="ml-auto text-gray-400 cursor-pointer">🔍</div>
    </nav>
  );
}