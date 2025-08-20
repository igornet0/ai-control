export default function ProgressChart() {
  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Status</h3>
      <div className="flex justify-center items-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="absolute inset-0" viewBox="0 0 36 36">
            <circle className="text-gray-200" strokeWidth="4" fill="none" r="16" cx="18" cy="18" />
            <circle
              className="text-blue-600"
              strokeWidth="4"
              strokeDasharray="100"
              strokeDashoffset="50"
              strokeLinecap="round"
              fill="none"
              r="16"
              cx="18"
              cy="18"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">50%</div>
        </div>
      </div>
      <ul className="text-xs text-gray-500 space-y-1">
        <li><span className="inline-block w-3 h-3 rounded-full bg-blue-600 mr-2" /> In Progress – 30%</li>
        <li><span className="inline-block w-3 h-3 rounded-full bg-green-600 mr-2" /> Completed – 30%</li>
        <li><span className="inline-block w-3 h-3 rounded-full bg-gray-500 mr-2" /> Review – 20%</li>
      </ul>
    </div>
  );
}