"use client";

import { useState } from "react";
import { addFriendRequest, apiSearchUsers, blockUser, unblockUser } from "@/lib/api/auth";

interface SearchUser {
  id: string;
  username: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

interface Conv {
  id: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  type: 'dm' | 'group';
  unreadCount?: number;
}

function Section() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);

  const handleSearch = async (value: string) => {
  setSearchQuery(value);

  if (value.trim().length < 2) {
    setSearchResults([]);
    return;
  }

  try {
    const results = await apiSearchUsers(value);
    setSearchResults(results);
  } catch (error) {
    console.error("Search error:", error);
    setSearchResults([]);
  }
};
   return (
    <section className="flex flex-1 h-full relative">
      <div className="w-1/4 bg-gray-200 text-black font-bold flex flex-col p-4 gap-4 overflow-hidden">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          className="border border-gray-400 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-normal"
        />
        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          <h3 className="text-sm font-bold text-gray-700 px-2 text-center">Chat</h3>
          {/* {conv.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                selectedConv === conv.id
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-gray-300'
              }`}
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                {conv.avatarUrl ? (
                  <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  conv.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{conv.name}</p>
                <p className={`text-xs truncate ${selectedConv === conv.id ? 'text-blue-100' : 'text-gray-600'}`}>
                  {conv.lastMessage || 'No messages yet'}
                </p>
              </div>
              {conv.unreadCount && conv.unreadCount > 0 && (
                <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {conv.unreadCount}
                </div>
              )}
            </div> */}
          {/* ))} */}
        </div>
      </div>
      {searchResults.length > 0 && (
        <div className="absolute top-16 left-0 w-1/4 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-60 overflow-y-auto flex flex-col gap-2">
          {searchResults.map((user: SearchUser) => (
            <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-300 cursor-pointer">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex-shrink-0 overflow-hidden">
                {user.profile?.avatarUrl
                  ? <img src={user.profile.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                  : <span className="text-white text-sm font-medium">{user.username.charAt(0).toUpperCase()}</span>
                }
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">{user.username}</p>
                <p className="text-sm text-gray-700 font-normal">{user.profile?.displayName}</p>
              </div>
             <div className="relative ml-auto">
              <button
                onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                className="px-2 py-1 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                </svg>
              </button>
              {openMenuId === user.id && (
                <div className="absolute right-0 mt-2 w-40 bg-white shadow-lg rounded-lg z-20">
                  <button
                    onClick={() => addFriendRequest(user.id)}
                    className="block w-full text-green-500 text-left px-4 py-2 hover:bg-gray-100">
                    Add friend
                  </button>
                  <button
                    onClick={() => blockUser(user.id)}
                    className="block w-full text-red-500 text-left px-4 py-2 hover:bg-gray-100">
                    Block User
                  </button>
                  <button
                    onClick={() => unblockUser(user.id)}
                    className="block w-full text-blue-500 text-left px-4 py-2 hover:bg-gray-100">
                    Unblock User
                  </button>
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 flex flex-col justify-end">
        <div className="bg-white border-t border-gray-300 p-4 flex gap-2 items-center">
          <input
            type="text"
            placeholder="Enter a message..."
            className="flex-1 border border-gray-300  text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-green-500 transition cursor-pointer">Send
          </button>
          <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
            
          </div>
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