"use client";

export default function TermsPage() {
  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6 mb-8 text-center">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: 2025
          </p>
        </div>

        {/* Sections */}
        {[
          {
            title: "1. Acceptance of Terms",
            text: "By accessing or using the platform, you agree to be bound by these Terms of Service. If you do not agree, you must not use the service.",
          },
          {
            title: "2. Eligibility",
            text: "You must be at least 13 years old (or the minimum legal age in your country) to use this service. By creating an account, you confirm that you meet this requirement.",
          },
          {
            title: "3. User Accounts",
            text: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
          },
          {
            title: "4. Acceptable Use",
            text: "You agree not to misuse the platform. This includes attempting to disrupt the service, access unauthorized data, or use the platform for illegal purposes.",
          },
          {
            title: "5. User Content",
            text: "You retain ownership of the content you create, but you grant us a non-exclusive license to use, display, and distribute it within the platform.",
          },
          {
            title: "6. Moderation",
            text: "We may remove content or suspend accounts that violate our rules. Please refer to our moderation policy for more details.",
          },
          {
            title: "7. Termination",
            text: "We reserve the right to suspend or terminate your account at any time if you violate these terms or misuse the service.",
          },
          {
            title: "8. Disclaimer",
            text: "The service is provided 'as is' without warranties of any kind. We do not guarantee uninterrupted or error-free operation.",
          },
          {
            title: "9. Limitation of Liability",
            text: "We are not liable for any damages resulting from your use of the platform, including data loss or service interruptions.",
          },
          {
            title: "10. Changes to Terms",
            text: "We may update these Terms of Service at any time. Continued use of the platform after changes constitutes acceptance of the new terms.",
          },
        ].map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              {section.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {section.text}
            </p>
            <hr className="border-gray-100 dark:border-zinc-700 mt-4" />
          </div>
        ))}

        {/* Footer */}
        <div className="mt-8 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-6 text-sm text-gray-500 dark:text-gray-400 text-center">

          You can also review our{" "}
          <a href="/moderation" className="text-blue-500 hover:underline">
            Moderation Rules
          </a>{" "}
          and{" "}
          <a href="/rgpd" className="text-blue-500 hover:underline">
            Privacy Policy
          </a>.
        </div>

      </div>
    </div>
  );
}