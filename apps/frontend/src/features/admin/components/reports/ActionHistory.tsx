import type { ModerationAction } from "@/features/admin/types/admin.types";

const actionColors: Record<string, string> = {
  WARN: "bg-yellow-100 text-yellow-700",
  BAN: "bg-red-100 text-red-700",
  UNBAN: "bg-green-100 text-green-700",
  DISMISS_REPORT: "bg-gray-100 text-gray-500",
  ADJUST_POINTS: "bg-blue-100 text-blue-700",
};

export function ActionHistory({ actions }: { actions: ModerationAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 mt-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Action history
      </p>
      {actions.map((action) => (
        <div
          key={action.id}
          className="flex flex-wrap items-center gap-2 text-xs text-gray-600"
        >
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${actionColors[action.action] ?? "bg-gray-100 text-gray-500"}`}
          >
            {action.action}
          </span>
          {action.moderator && (
            <span className="text-gray-400">
              by{" "}
              <span className="font-medium text-gray-600">
                {action.moderator.username}
              </span>
            </span>
          )}
          {action.penaltyPointsChange !== null &&
            action.penaltyPointsChange !== undefined &&
            action.penaltyPointsChange !== 0 && (
              <span
                className={`font-medium ${action.penaltyPointsChange > 0 ? "text-green-600" : "text-red-600"}`}
              >
                {action.penaltyPointsChange > 0
                  ? `+${action.penaltyPointsChange}`
                  : action.penaltyPointsChange}{" "}
                pts
              </span>
            )}
          {action.note && (
            <span className="italic text-gray-400">
              &quot;{action.note}&quot;
            </span>
          )}
          <span className="text-gray-300">
            {new Date(action.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}
