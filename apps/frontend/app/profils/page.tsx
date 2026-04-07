
function Section() {
  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12">
      <div className="w-48 h-48 bg-blue-500 rounded-full"/>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl text-black font-bold">Username</h2>
        <p className="text-gray-600 text-center">Here is some information about your profile.</p>
      </div>
      <div className="flex gap-4">
        <button className="bg-black text-white px-6 py-2 rounded hover:text-gray-300 cursor-pointer">Edit profile</button>
        <button className="border border-black text-black px-6 py-2 rounded hover:bg-gray-100 cursor-pointer">Share</button>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full max-w-2xl mt-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="bg-gray-300 aspect-square rounded" />
        ))}
      </div>
      
      </section>
  );
}


export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 flex flex-col">
      <Section />
    </main>
  );
}