"use client";

import { useState, useEffect, useRef } from "react";
import { addFriendRequest, apiSearchUsers, blockUser, unblockUser } from "@/lib/api/auth";
import { apiGetConversations, apiGetMessages, apiReportMessage, createOrGetDirectConversation } from "@/lib/api/chat";
import { useAuthStore } from "@/store/authStore";
import { Socket } from "socket.io-client";
import { getChatSocket, resetChatSocket } from "@/lib/socket/chat-socket";

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
  type: 'dm' | 'group';
  name: string;
  avatarUrl?: string | null;
  lastMessage?: string | null;
  unreadCount?: number;
}

function ReportModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Report message</h2>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the reason (5 to 1000 characters)..."
          className="border border-gray-300 rounded-lg p-3 text-sm text-black resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason)}
            disabled={reason.trim().length < 5}
            className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed">
            Report
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarSearch({
  searchQuery,
  conversations,
  selectedConvId,
  onSearchChange,
  onSelectConv,
}: {
  searchQuery: string;
  conversations: Conversation[];
  selectedConvId: string | null;
  onSearchChange: (value: string) => void;
  onSelectConv: (conv: Conversation) => void;
}) {
  return (
    <div className="w-1/4 bg-gray-200 text-black font-bold flex flex-col p-4 gap-4 overflow-hidden">
      <input
        type="text"
        placeholder="Search users..."
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        className="border border-gray-400 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-normal"
      />
      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        <h3 className="text-sm font-bold text-gray-700 px-2 text-center">Chat</h3>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConv(conv)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
              selectedConvId === conv.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-300'
            }`}
          >
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold overflow-hidden">
              {conv.avatarUrl ? (
                <img src={conv.avatarUrl} className="w-full h-full object-cover" />
              ) : (
                conv.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{conv.name}</p>
              <p className="text-xs text-gray-600 truncate">{conv.lastMessage || 'No messages yet'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchDropdown({
  results,
  onSelectUser,
  onOpenMenu,
}: {
  results: SearchUser[];
  onSelectUser: (user: SearchUser) => void;
  onOpenMenu: (user: SearchUser, x: number, y: number) => void;
}) {
  if (results.length === 0) return null;

  return (
    <div className="absolute top-16 left-0 w-1/4 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-60 overflow-y-auto flex flex-col gap-2">
      {results.map((user) => (
        <div
          key={user.id}
          onClick={() => onSelectUser(user)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
        >
          <div className="w-10 h-10 bg-blue-500 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-medium">
            {user.profile?.avatarUrl ? (
              <img src={user.profile.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              user.username.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">{user.username}</p>
            <p className="text-sm text-gray-700 font-normal">{user.profile?.displayName}</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                onOpenMenu(
                  user,
                  Math.min(rect.right, window.innerWidth - 160),
                  Math.min(rect.bottom, window.innerHeight - 150)
                );
              }}
              className="px-2 py-1 text-gray-500 hover:text-gray-700"
            >
              ⋯
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function UserContextMenu({
  user,
  x,
  y,
  onAddFriend,
  onBlock,
  onUnblock,
}: {
  user: SearchUser;
  x: number;
  y: number;
  onAddFriend: (userId: string) => void;
  onBlock: (userId: string) => void;
  onUnblock: (userId: string) => void;
}) {
  return (
    <div className="fixed z-50 w-40 bg-white shadow-lg rounded-lg" style={{ top: y, left: x }}>
      <button onClick={() => onAddFriend(user.id)} className="block w-full text-green-500 text-left px-4 py-2 hover:bg-gray-100">
        Add friend
      </button>
      <button onClick={() => onBlock(user.id)} className="block w-full text-red-500 text-left px-4 py-2 hover:bg-gray-100">
        Block User
      </button>
      <button onClick={() => onUnblock(user.id)} className="block w-full text-blue-500 text-left px-4 py-2 hover:bg-gray-100">
        Unblock User
      </button>
    </div>
  );
}

function ChatPanel({
  selectedConv,
  messages,
  messageInput,
  currentUserId,
  bottomRef,
  onInputChange,
  onSend,
  onReport,
}: {
  selectedConv: Conversation | null;
  messages: any[];
  messageInput: string;
  currentUserId: string | undefined;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onReport: (messageId: string, userId: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {selectedConv ? (
          messages.map((msg) => {
            const isMe = msg.sender.id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className="flex flex-col max-w-xs">
                  {!isMe && (
                    <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender.username}</span>
                  )}
                  <div className="flex items-end gap-1">
                    <div className={`px-3 py-2 rounded-lg text-sm ${isMe ? "bg-blue-500 text-white self-end" : "bg-gray-300 text-black"}`}>
                      {msg.content}
                    </div>
                    {!isMe && (
                      <button
                        onClick={() => onReport(msg.id , msg.sender.id)}
                        className="text-gray-400 hover:text-red-500 text-xs transition mb-1"
                        title="Report message"
                      >
                        ⚑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-gray-500 text-center mt-10">Select a conversation</div>
        )}
        <div ref={bottomRef} />
      </div>
      {selectedConv && (
        <div className="border-t border-gray-300 p-4 flex gap-2 items-center bg-white">
          <input
            value={messageInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSend(); } }}
            type="text"
            placeholder="Enter a message..."
            className="flex-1 border border-gray-300 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={onSend} className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-green-500 cursor-pointer transition">
            Send
          </button>
        </div>
      )}
    </div>
  );
}


function Section() {
  const socketRef = useRef<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<{ user: SearchUser; x: number; y: number } | null>(null);
  const [reportModal, setReportModal] = useState<{ messageId: string, userId: string } | null>(null);

  useEffect(() => {
    const handleClick = () => setMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!user) return;
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
    if (!bottomRef.current) return;
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, 0);
  }, [messages, selectedConv]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setMessages([]);
      setSelectedConv(null);
      setSearchResults([]);
      setSearchQuery("");
    }
  }, [user]);

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

  const handleSelectUser = async (searchUser: SearchUser) => {
    try {
      const conv = await createOrGetDirectConversation(searchUser.id);
      setConversations((prev) => prev.find((c) => c.id === conv.id) ? prev : [conv, ...prev]);
      setSelectedConv(conv);
      setSearchResults([]);
      setSearchQuery("");
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConv || !socketRef.current) return;

    socketRef.current.emit('chat.sendMessage', {
      conversationId: selectedConv.id,
      content: messageInput,
    });

    setMessageInput("");
  };

useEffect(() => {
  if (!user) return;

  const token = useAuthStore.getState().accessToken;
  const socket = getChatSocket(token);
  socketRef.current = socket;

  socket.on('chat.message.created', (msg) => {
    setMessages((prev) => [...prev, msg]);
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastMessage: msg.content }
          : c
      );
      const idx = updated.findIndex((c) => c.id === msg.conversationId);
      if (idx > 0) {
        const [conv] = updated.splice(idx, 1);
        updated.unshift(conv);
      }
      return updated;
    });
  });

  socket.on('chat.conversation.created', (conv) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === conv.id);
      if (exists) return prev;
      return [conv, ...prev];
    });
  });

  return () => {
    socket.off('chat.message.created');
    socket.off('chat.conversation.created');
  };
}, [user]);

useEffect(() => {
  if (!user) {
    resetChatSocket();
    socketRef.current = null;
  }
}, [user]);

useEffect(() => {
  const socket = socketRef.current;
  if (!socket || !selectedConv) return;

  socket.emit('chat.joinConversation', { conversationId: selectedConv.id });

  return () => {
    socket.emit('chat.leaveConversation', { conversationId: selectedConv.id });
  };
}, [selectedConv]);

const handleReport = async (messageId: string, userId: string, reason: string) => {
  try {
    await apiReportMessage(messageId, userId, reason);
    setReportModal(null);
  } catch (err) {
    console.error("Failed to report:", err);
  }
};

  return (
    <section className="flex flex-1 h-full relative">
      <SidebarSearch
        searchQuery={searchQuery}
        conversations={conversations}
        selectedConvId={selectedConv?.id ?? null}
        onSearchChange={handleSearch}
        onSelectConv={setSelectedConv}
      />
      <SearchDropdown
        results={searchResults}
        onSelectUser={handleSelectUser}
        onOpenMenu={(u, x, y) => setMenu({ user: u, x, y })}
      />
      {menu && (
        <UserContextMenu
          user={menu.user}
          x={menu.x}
          y={menu.y}
          onAddFriend={(id) => { addFriendRequest(id); setMenu(null); }}
          onBlock={(id) => { blockUser(id); setMenu(null); }}
          onUnblock={(id) => { unblockUser(id); setMenu(null); }}
        />
      )}
      {reportModal && (
        <ReportModal
          onSubmit={(reason) => handleReport(reportModal.messageId, reportModal.userId, reason)}
          onClose={() => setReportModal(null)}
        />
      )}
      <ChatPanel
        selectedConv={selectedConv}
        messages={messages}
        messageInput={messageInput}
        currentUserId={user?.id}
        bottomRef={bottomRef}
        onInputChange={setMessageInput}
        onSend={handleSend}
        onReport={(messageId, userId) => setReportModal({ messageId, userId })}
      />
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