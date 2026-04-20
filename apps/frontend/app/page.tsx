"use client";

import { useState, useEffect, useRef } from "react";
import { addFriendRequest, apiSearchUsers, blockUser, unblockUser } from "@/lib/api/auth";
import { apiGetConversations, apiGetMessages, apiSendMessage } from "@/lib/api/chat";
import { useAuthStore } from "@/store/authStore";

interface SearchUser {
  id: string;
  username: string;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  participants: {
    user: {
      id: string;
      username: string;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
    };
  }[];
  messages: {
    content: string;
    createdAt: string;
    sender: {
      id: string;
      username: string;
    };
  }[];
}

function Section() {
  const [searchQuery, setSearchQuery] = useState("");
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<{
    user: SearchUser;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleClick = () => setMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

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
  useEffect(() => {
    const fetchConversations = async () => {
      try {
            const data = await apiGetConversations();
            setConversations(data);
          } catch (err) {
            console.error('Failed to load conversations:', err);
          }
    };
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConv) return;
    const fetchMessages = async () => {
      try {
        const data = await apiGetMessages(selectedConv.id);
        setMessages(data);
      } catch (err) {
        console.error(err);
        setMessages([]);
      }
    };

    fetchMessages();
  }, [selectedConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          {conversations.map((conversation) => {
            const otherUser = conversation.participants.find((p) => p.user.id !== user?.id)?.user;
            const name = conversation.type === 'DIRECT'
                ? otherUser?.username
                : 'Group chat';
            const avatar = conversation.type === 'DIRECT'
                ? otherUser?.profile?.avatarUrl
                : null;
            const lastMessage = conversation.messages?.[0]?.content;
            return (
              <div
                key={conversation.id}
                onClick={() => setSelectedConv(conversation)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                  selectedConv?.id === conversation.id
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-300'
                }`}
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden">
                  {avatar ? (
                    <img src={avatar} className="w-full h-full object-cover" />
                  ) : (
                    name?.charAt(0).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{name}</p>
                  <p className="text-xs text-gray-600 truncate">
                    {lastMessage || 'No messages yet'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {searchResults.length > 0 && (
        <div className="absolute top-16 left-0 w-1/4 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-60 overflow-y-auto flex flex-col gap-2">
          
          {searchResults.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-medium">
                {user.profile?.avatarUrl ? (
                  <img
                    src={user.profile.avatarUrl}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </div>

              <div>
                <p className="text-base font-bold text-gray-900">
                  {user.username}
                </p>
                <p className="text-sm text-gray-700 font-normal">
                  {user.profile?.displayName}
                </p>
              </div>

              <div className="ml-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();

                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

                    const x = Math.min(rect.right, window.innerWidth - 160);
                    const y = Math.min(rect.bottom, window.innerHeight - 150);

                    setMenu({ user, x, y });
                  }}
                  className="px-2 py-1 text-gray-500 hover:text-gray-700"
                >
                  ⋯
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {menu && (
        <div
          className="fixed z-50 w-40 bg-white shadow-lg rounded-lg"
          style={{
            top: menu.y,
            left: menu.x,
          }}
        >
          <button
            onClick={() => {
              addFriendRequest(menu.user.id);
              setMenu(null);
            }}
            className="block w-full text-green-500 text-left px-4 py-2 hover:bg-gray-100"
          >
            Add friend
          </button>

          <button
            onClick={() => {
              blockUser(menu.user.id);
              setMenu(null);
            }}
            className="block w-full text-red-500 text-left px-4 py-2 hover:bg-gray-100"
          >
            Block User
          </button>

          <button
            onClick={() => {
              unblockUser(menu.user.id);
              setMenu(null);
            }}
            className="block w-full text-blue-500 text-left px-4 py-2 hover:bg-gray-100"
          >
            Unblock User
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {selectedConv ? (
              messages.map((msg) => {
                const isMe = msg.sender.id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`px-3 py-2 rounded-lg max-w-xs text-sm ${
                        isMe
                          ? "bg-blue-500 text-white"
                          : "bg-gray-300 text-black"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 text-center mt-10">
                Select a conversation
              </div>
            )}
          </div>

          {selectedConv && (
            <div className="bg-white border-t border-gray-300 p-4 flex gap-2 items-center">
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                type="text"
                placeholder="Enter a message..."
                className="flex-1 border border-gray-300 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={async () => {
                  if (!messageInput.trim()) return;

                  const newMsg = await apiSendMessage(
                    selectedConv.id,
                    messageInput
                  );

                  setMessages((prev) => [...prev, newMsg]);
                  setMessageInput("");
                }}
                className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-green-500 transition"
              >
                Send
              </button>
            </div>
          )}
      </div><div ref={bottomRef}/>
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