"use client";


function Section() {
  return (
    <section className="flex flex-1">
      <div className="w-1/4 bg-gray-200 text-black font-bold text-center p-4">
        threads
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <div className="bg-white border-t border-gray-300 p-4 flex gap-2 items-center">
          <input
            type="text"
            placeholder="Enter a message..."
            className="flex-1 border border-gray-300  text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-green-500 transition cursor-pointer">
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col h-full bg-gray-100">
      <Section />
    </div>
  );
}