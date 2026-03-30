import Image from "next/image";

function Header()
{
  return (
    <header className="bg-black text-white p-4 flex items-center">
      <h1 className="text-2xl font-bold">Transcendence</h1>
      <nav className="flex gap-12 font-bold mx-auto">
        <a className="hover:text-gray-300 cursor-pointer">Accueil</a>
        <a className="hover:text-gray-300 cursor-pointer">projet</a>
        <a className="hover:text-gray-300 cursor-pointer">contact</a>
        <a className="hover:text-gray-300 cursor-pointer">blog</a>
      </nav>
    </header>
  );
}

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

function Section()
{
  const projects = [
  {
    id: 1,
    title: "test 1",
    description: "Mon premier site web",
  },
  {
    id: 2,
    title: "test 2",
    description: "Gestion de tâches",
  },
  {
    id: 3,
    title: "test 3",
    description: "Articles techniques",
  },
];
 return (
    <section className="flex flex-1">
      <div className="w-1/16 bg-gray-100 text-black font-bold text-center p-4">Menu</div>
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
    </section>
  );
}

function Footer()
{
  return <p className="bg-gray-200 p-4 text-3xl text-center text-black">© 2026</p>;
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <Section />
      <Footer />
    </main>
  );
}