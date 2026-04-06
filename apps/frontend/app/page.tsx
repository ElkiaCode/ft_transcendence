"use client";



function Card({ title, description }: { title: string; description: string })
{
  return (
    <div className="bg-white shadow-md rounded-lg p-6 w-80 hover:shadow-xl transition">
      <h3 className="text-xl text-center text-black font-bold"> {title} </h3>
      <p className="mt-2 text-center text-gray-600">THE CARD</p>
      <p className="mt-2 text-gray-600 text-center"> {description} </p>
      <button className="mt-4 bg-black text-white px-4 py-2 rounded hover:text-gray-300 cursor-pointer">Voir</button>
    </div>
  );
}


function Section() {
  const projects = [
    { id: 1, title: "test 1", description: "test" },
    { id: 2, title: "test 2", description: "test" },
    { id: 3, title: "test 3", description: "test" },
  ];

  return (
    <section className="flex flex-1">
      <div className="w-1/6 bg-gray-200 text-black font-bold text-center p-4">
        Menu
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex justify-center items-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 justify-items-center">
            {projects.map((project) => (
              <Card
                key={project.id}
                title={project.title}
                description={project.description}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-center text-black items-center p-4">
          <input
            type="text"
            placeholder="Écris ici..."
            className="w-3/5 border border-gray-300 rounded px-4 py-3"
          />
        </div>
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