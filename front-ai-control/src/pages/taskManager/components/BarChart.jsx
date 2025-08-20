export default function BarChart() {
  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Status</h3>
      <div className="flex items-end gap-2 h-24">
        <div className="w-4 bg-blue-500 h-16 rounded"></div>
        <div className="w-4 bg-green-500 h-12 rounded"></div>
        <div className="w-4 bg-gray-400 h-10 rounded"></div>
      </div>
    </div>
  );
}