export function TermsPageContent() {
  return (
    <div className="min-h-0 bg-white dark:bg-zinc-900">
      <div className="max-w-3xl mx-auto px-6 py-12 text-left">
        <div className="border-b border-gray-200 dark:border-zinc-700 pb-6 mb-8 text-center">
          <h1 className="text-3xl font-medium text-gray-900 dark:text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated - 2026
          </p>
        </div>

        <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              Use of the application
            </h2>
            <p>
              Transcendence is a social chat application created for the 42
              curriculum. You agree to use it lawfully, respectfully, and only
              through the interfaces provided by the application.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              Accounts and security
            </h2>
            <p>
              You are responsible for keeping your login credentials private.
              You must not impersonate another user, attempt to access another
              account, or bypass authentication and permission checks.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              User content and conduct
            </h2>
            <p>
              Messages, profile information, avatars, and reports must not be
              illegal, abusive, harassing, hateful, threatening, or spam. The
              application includes automated and moderator-assisted moderation,
              and accounts may be warned, restricted, or banned when necessary.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              Privacy and data rights
            </h2>
            <p>
              Personal data is handled according to the Privacy Policy. You can
              request an export of your account data and delete your account
              from the privacy page when logged in.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-gray-900 dark:text-white mb-2">
              Service availability
            </h2>
            <p>
              This project is provided for educational purposes. The team may
              change, suspend, or remove features during development, testing,
              or evaluation.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
