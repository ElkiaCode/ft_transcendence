export default function RgpdPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-center bg-white">

      {/* Hero */}
      <div className="border-b border-gray-200 pb-6 mb-8">
        <h1 className="text-3xl font-medium text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500">
          Last updated — 2025 &nbsp;·&nbsp;
          <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-0.5 rounded-full">GDPR compliant</span>
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { dot: "bg-emerald-500", title: "Data collected", text: "Username, email, avatar, and 42 OAuth data if applicable." },
          { dot: "bg-blue-600", title: "Security", text: "Passwords are hashed and salted. HTTPS connections only." },
          { dot: "bg-amber-600", title: "Retention", text: "Data is kept for as long as your account is active." },
        ].map((c) => (
          <div key={c.title} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`w-2 h-2 rounded-full ${c.dot} mx-auto mb-3`} />
            <h3 className="text-sm font-medium text-gray-900 mb-1">{c.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      {[
        { title: "How we use your data", text: "Your data is used solely to provide the application's features: authentication, profile management, friend system, chat, and gameplay. We do not sell or share your data with third parties." },
        { title: "Cookies", text: "We only use session cookies strictly necessary for authentication. No tracking or advertising cookies are used." },
        { title: "Your rights", text: "You may request access, correction, or deletion of your data at any time by contacting the project team. All requests will be handled promptly." },
      ].map((s) => (
        <div key={s.title}>
          <h2 className="text-base font-medium text-gray-900 mb-2">{s.title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{s.text}</p>
          <hr className="border-gray-100 mb-4" />
        </div>
      ))}

      {/* Footer */}
      <div className="bg-gray-50 rounded-xl px-6 py-4">
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-800">Contact:</span> For any questions regarding your data, reach us at{" "}
          <span className="font-medium text-gray-800">your-login@student.42.fr</span>
        </p>
      </div>
    </div>
  );
}