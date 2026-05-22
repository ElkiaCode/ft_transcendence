export default function ModerationPage() {
  return (
    <div className="bg-white dark:bg-zinc-900 min-h-full">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6 mb-8 text-center">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-2">
            Moderation Rules
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By registering, you agree to follow these rules without exception.
          </p>
        </div>

        {/* Points system */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            {
              dot: "bg-red-500",
              title: "Penalties",
              text: "Each message containing a prohibited word results in a loss of points depending on the severity.",
            },
            {
              dot: "bg-emerald-500",
              title: "Rewards",
              text: "Positive reactions from other users on your messages earn you points.",
            },
            {
              dot: "bg-amber-500",
              title: "Ban",
              text: "Reaching −500 points results in immediate and permanent account suspension.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 text-center"
            >
              <div className={`w-2 h-2 rounded-full ${c.dot} mx-auto mb-3`} />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{c.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>

        {/* Detailed sections */}
        {[
          {
            title: "Points System",
            text: "Each account starts at 0 points. Your actions on the platform will increase or decrease this score. Points reflect your overall behavior within the community.",
          },
          {
            title: "Prohibited Words and Penalties",
            text: "Certain words or expressions are automatically detected by our moderation system. Each violation results in a loss of points proportional to the severity of the content: minor, moderate, or severe. The concerned messages are deleted and you are notified.",
          },
          {
            title: "Reactions and Point Gains",
            text: "When another user reacts positively to one of your messages, you gain points. This reflects the quality and respectfulness of your interactions within the community.",
          },
          {
            title: "SuperUser Badge (+250 pts)",
            text: "Upon reaching 250 points, you earn the SuperUser badge. This badge is visible on your profile and highlights your positive contribution to the community. It also boosts your visibility in search results.",
          },
          {
            title: "Moderator Status (+500 pts)",
            text: "At 500 points, you become a moderator. You can then report messages, remove users from groups you own, and actively contribute to platform safety.",
          },
          {
            title: "Ban at −500 pts",
            text: "If your score reaches −500 points, your account is automatically banned and permanently deleted. No appeal is possible. All your data, messages, and history are erased in accordance with our privacy policy.",
          },
          {
            title: "Reports",
            text: "Any user can report a message they consider inappropriate. Reports are reviewed by our automated system and, if necessary, by a moderator. Abuse of the reporting system may also result in penalties.",
          },
        ].map((s) => (
          <div key={s.title} className="mb-5">
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-1">{s.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.text}</p>
            <hr className="border-gray-100 dark:border-zinc-700 mt-4" />
          </div>
        ))}

        {/* Summary */}
        <div className="mt-8 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 text-center">
            Points System Summary
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: "−500 pts", desc: "Permanent account ban and deletion", color: "text-red-600" },
              { label: "0 pts", desc: "Starting score for all new users", color: "text-gray-500" },
              { label: "+250 pts", desc: "SuperUser badge unlocked", color: "text-amber-500" },
              { label: "+500 pts", desc: "Moderator status unlocked", color: "text-emerald-600" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-4">
                <span className={`font-bold w-20 shrink-0 ${row.color}`}>{row.label}</span>
                <span className="text-gray-500 dark:text-gray-400">{row.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}