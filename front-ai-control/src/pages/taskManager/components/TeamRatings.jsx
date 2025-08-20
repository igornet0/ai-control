
export default function TeamRatings() {
    const team = [
    { name: "Alice Brown", avatar: "https://i.pravatar.cc/32?img=1" },
    { name: "John Doe", avatar: "https://i.pravatar.cc/32?img=2" },
    { name: "Emily White", avatar: "https://i.pravatar.cc/32?img=3" },
 ];
  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Team Ratings</h3>
      <ul className="space-y-2">
        {team.map((member, i) => (
          <li key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full" />
              <span>{member.name}</span>
            </div>
            <span className="text-yellow-500">⭐</span>
          </li>
        ))}
      </ul>
    </div>
  );
}