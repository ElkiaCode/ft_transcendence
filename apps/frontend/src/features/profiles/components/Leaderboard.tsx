import type { TopUser } from "@/features/gamification/types/gamification.types";

function getTrophy(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return null;
}

function getRankColor(i: number) {
  if (i === 0) return "#FFD700";
  if (i === 1) return "#C0C0C0";
  if (i === 2) return "#CD7F32";
  return "#00BABC";
}

export function Leaderboard({ users }: { users: TopUser[] }) {
  return (
    <div className="w-full max-w-md mt-4">
      <h3 className="text-center font-bold mb-3 TextColorS text-lg">
        🏆 Top Users
      </h3>
      <div className="rounded-lg overflow-hidden border-4 BorderColorS bg-white shadow-md">
        {users.length === 0 && (
          <div className="px-4 py-6 text-center ColorsS">
            <p className="text-white font-medium">No users yet</p>
          </div>
        )}
        {users.map((user, i) => (
          <div
            key={user.id}
            className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 bg-white"
          >
            <span
              className="font-bold w-6 h-6 flex items-center justify-center text-base"
              style={{ color: getRankColor(i) }}
            >
              {getTrophy(i) ?? i + 1}
            </span>
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center ColorsS">
              {user.profile?.avatarUrl ? (
                <img
                  src={user.profile.avatarUrl}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-xs font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="flex-1 text-sm font-medium text-black">
              {user.profile?.displayName ?? user.username}
            </span>
            <span className="font-bold text-sm text-black">
              {user.penaltyPoints} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}