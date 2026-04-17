"use client";

import { useEffect, useState } from "react";
import { getUser } from "@/lib/api/auth";



function Section() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const userData = await getUser();
      if (userData) {
        setUser(userData);
      }
    }

    loadUser();
  }, []);

  return (
    <section className="flex-1 flex items-center flex-col w-full gap-8 py-12">
      <div className="w-48 h-48 bg-blue-500 rounded-full overflow-hidden flex items-center justify-center">
        {user?.profile?.avatarUrl ? (
          <img src={user.profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-6xl font-bold">
            {user?.username?.charAt(0).toUpperCase() ?? "?"}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl text-black font-bold">{user?.username ?? "..."}</h2>
      </div>
      <div className="flex gap-4">
        <button className="bg-black text-white px-6 py-2 rounded hover:text-gray-300 cursor-pointer">Edit profile</button>
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