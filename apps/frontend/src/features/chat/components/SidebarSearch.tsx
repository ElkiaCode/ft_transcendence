"use client";

import { useRouter } from "next/navigation";
import type { Conversation } from "@/features/chat/types/chat.types";

export function SidebarSearch({
  searchQuery,
  conversations,
  selectedConvId,
  onSearchChange,
  onSelectConv,
  onOpenGroupModal,
  onDeleteConv,
}: {
  searchQuery: string;
  conversations: Conversation[];
  selectedConvId: string | null;
  onSearchChange: (value: string) => void;
  onSelectConv: (conv: Conversation) => void;
  onOpenGroupModal: () => void;
  onDeleteConv: (convId: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="w-1/4 bg-gray-200 text-black flex flex-col p-4 gap-4 overflow-hidden">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border border-gray-400 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[90%] font-normal"
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchQuery.trim().length >= 2)
              router.push(`/search?query=${searchQuery.trim()}`);
          }}
        />
        <button
          onClick={onOpenGroupModal}
          className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 cursor-pointer transition w-[10%]"
          title="Create Group"
        >
          <img src="/addGroup.png" alt="Add Group" className="h-full w-full" />
        </button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        <h3 className="text-sm font-bold text-gray-700 px-2 text-center">
          Chat
        </h3>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${selectedConvId === conv.id ? "bg-white/70" : ""} ${(conv.unreadCount ?? 0) > 0 ? "font-bold" : ""}`}
          >
            <div
              onClick={() => onSelectConv(conv)}
              className="flex items-center gap-3 flex-1"
            >
              <div
                className={`w-10 h-10 ColorsS rounded-full flex items-center justify-center text-white overflow-hidden $`}
              >
                {conv.avatarUrl ? (
                  <img
                    src={conv.avatarUrl}
                    alt={`${conv.name} avatar`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (conv.name ?? "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0 relative">
                <p className="text-sm truncate">{conv.name}</p>
                <p className="text-xs text-gray-900 truncate">
                  {conv.lastMessage || "No messages yet"}
                </p>
                {(conv.unreadCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                    {(conv.unreadCount ?? 0) > 99 ? "99+" : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConv(conv.id);
              }}
              className="text-gray-400 hover:text-red-500 px-1 transition cursor-pointer"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
