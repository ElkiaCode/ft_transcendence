import type { GamificationBadge } from "@/features/gamification/types/gamification.types";

export function BadgeGrid({ badges }: { badges: GamificationBadge[] }) {
  return (
    <div className="w-full max-w-2xl">
      <h3 className="text-center font-bold mb-3 TextColorS text-lg">Badges</h3>
      {badges.length === 0 ? (
        <div className="rounded-lg border-4 BorderColorS bg-white px-4 py-5 text-center">
          <p className="text-sm font-medium text-black">No badges yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`min-h-24 border-2 rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm ${badge.accentClass}`}
            >
              <div className="w-12 h-12 rounded-full bg-white/80 border border-current flex items-center justify-center text-sm font-black flex-shrink-0">
                {badge.mark}
              </div>
              <div className="min-w-0 text-left">
                <div className="font-bold text-sm">{badge.name}</div>
                <div className="text-xs opacity-80">{badge.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
