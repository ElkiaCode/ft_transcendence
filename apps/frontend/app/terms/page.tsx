"use client";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-center">
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">

        {/* Hero */}
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6 mb-8">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated — 2025 &nbsp;·&nbsp;
            <span className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-3 py-0.5 rounded-full">
              Required at registration
            </span>
          </p>
        </div>

        {/* Sections */}
        {[
          {
            title: "Behaviour",
            text: "All users must behave respectfully at all times. Sexist, racist, homophobic, or any discriminatory language is strictly prohibited and will result in immediate account suspension.",
          },
          {
            title: "Content",
            text: "You may not post or share any content that is offensive, illegal, or harmful to other users. This includes hate speech, harassment, explicit content, and personal attacks.",
          },
          {
            title: "Account",
            text: "You are responsible for all activity on your account. Any violation of these terms may result in permanent account deletion without prior notice.",
          },
        ].map((s) => (
          <div key={s.title} className="text-left mb-4">
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">{s.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.text}</p>
            <hr className="border-gray-100 dark:border-zinc-700 mt-4" />
          </div>
        ))}

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-6 py-4 mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            By registering, you confirm that you have read and agree to these terms.{" "}
            <a href="/rgpd" className="text-blue-500 hover:underline">Privacy Policy</a>
          </p>
        </div>

      </div>
    </div>
  );
}