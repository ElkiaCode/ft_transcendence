"use client";

import { useState, useEffect, useRef } from "react";
import { addFriendRequest, apiSearchUsers, blockUser, unblockUser } from "@/lib/api/auth";
import { apiAddMessageReaction, apiGetConversations, apiGetMessages, createOrGetDirectConversation } from "@/lib/api/chat";
import { useAuthStore } from "@/store/authStore";
import { Socket } from "socket.io-client";
import { getChatSocket, resetChatSocket } from "@/lib/socket/chat-socket";
import { apiPromoteUser } from "@/lib/api/auth";

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

type ReactionType = 'THUMBS_UP' | 'HEART';

const reactionIcons: Record<ReactionType, string> = {
  THUMBS_UP: '/reaction-thumbs-up.svg',
  HEART: '/reaction-heart.svg',
};

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
  isAdmin,
  onAddFriend,
  onBlock,
  onUnblock,
  onPromote,
}: {
  user: SearchUser;
  x: number;
  y: number;
  isAdmin: boolean;
  onAddFriend: (userId: string) => void;
  onBlock: (userId: string) => void;
  onUnblock: (userId: string) => void;
  onPromote: (userId: string) => void;
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
      {isAdmin && (
        <button onClick={() => onPromote(user.id)} className="block w-full text-purple-500 text-left px-4 py-2 hover:bg-gray-100">
          Promote to Moderator
        </button>
      )}
    </div>
  );
}

function ChatPanel({
  selectedConv,
  messages,
  messageInput,
  currentUserId,
  typingUsers,
  onlineCount,
  bottomRef,
  onInputChange,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onReact,
}: {
  selectedConv: Conversation | null;
  messages: any[];
  messageInput: string;
  currentUserId: string | undefined;
  typingUsers: string[];
  onlineCount: number;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onEditMessage: (message: any) => void;
  onDeleteMessage: (message: any) => void;
  onReact: (message: any, type: ReactionType) => void;
}) {
  return (
    <div className="flex-1 flex flex-col h-full">
      {selectedConv && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 text-xs text-gray-500">
          {onlineCount} online
        </div>
      )}
	      <div className="flex-1 overflow-y-auto p-4 space-y-2">
	        {selectedConv ? (
            (() => {
              const lastEditableMessage = [...messages]
                .reverse()
                .find((message) => !message.deletedAt);

              return messages.map((msg) => {
		            const isMe = msg.sender.id === currentUserId;
		            const isDeleted = Boolean(msg.deletedAt);
                const canEditOrDelete =
                  isMe && !isDeleted && lastEditableMessage?.id === msg.id;
                const reactionCounts = (msg.reactions ?? []).reduce(
                  (counts: Record<ReactionType, number>, reaction: { type: ReactionType }) => {
                    counts[reaction.type] = (counts[reaction.type] ?? 0) + 1;
                    return counts;
                  },
                  { THUMBS_UP: 0, HEART: 0 },
                );
		            return (
	              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
	                <div className="flex flex-col max-w-xs">
	                  {!isMe && (
	                    <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender.username}</span>
	                  )}
	                  <div className={`px-3 py-2 rounded-lg text-sm ${isMe ? "bg-blue-500 text-white self-end" : "bg-gray-300 text-black"} ${isDeleted ? "italic opacity-70" : ""}`}>
	                    {isDeleted ? "Message deleted" : msg.content}
	                  </div>
                    <div className={`mt-1 flex gap-2 text-[11px] text-gray-500 ${isMe ? "justify-end" : "justify-start"}`}>
                      {msg.isEdited && !isDeleted && <span>edited</span>}
	                      {canEditOrDelete && (
	                        <>
	                          <button onClick={() => onEditMessage(msg)} className="hover:underline">Edit</button>
                          <button onClick={() => onDeleteMessage(msg)} className="hover:underline">Delete</button>
                        </>
                      )}
	                      {isMe && msg.reads?.length > 0 && <span>seen by {msg.reads.length}</span>}
	                    </div>
                    {!isDeleted && (
                      <div className={`mt-1 flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                        {(Object.keys(reactionIcons) as ReactionType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => onReact(msg, type)}
                            disabled={isMe}
                            title={type === 'HEART' ? 'Heart' : 'Thumbs up'}
                            className={`flex h-6 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 text-[11px] shadow-sm transition ${
                              isMe ? "cursor-not-allowed opacity-60" : "hover:bg-gray-100"
                            }`}
                          >
                            <img src={reactionIcons[type]} alt="" className="h-3.5 w-3.5" />
                            {reactionCounts[type] > 0 && <span>{reactionCounts[type]}</span>}
                          </button>
                        ))}
                      </div>
                    )}
		                </div>
			              </div>
		            );
		          });
            })()
	        ) : (
          <div className="text-gray-500 text-center mt-10">Select a conversation</div>
        )}
	        <div ref={bottomRef} />
	      </div>
	      {selectedConv && (
	        <div className="border-t border-gray-300 p-4 flex flex-col gap-2 bg-white">
          {typingUsers.length > 0 && (
            <p className="text-xs text-gray-500 px-4">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
            </p>
          )}
          <div className="flex gap-2 items-center">
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
	        </div>
	      )}
    </div>
  );
}


function Section() {
  const socketRef = useRef<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const user = useAuthStore((state) => state.user);
  console.log(user);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<{ user: SearchUser; x: number; y: number } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const isTypingRef = useRef(false);

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
          const lastMessage = data[data.length - 1];
          if (lastMessage && socketRef.current) {
            socketRef.current.emit('chat.markRead', {
              conversationId: selectedConv.id,
              messageId: lastMessage.id,
            });
          }
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

      socketRef.current.emit('chat.typing.stop', {
        conversationId: selectedConv.id,
      });
      isTypingRef.current = false;

	    setMessageInput("");
	  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);

    if (!selectedConv || !socketRef.current) return;

    const hasText = value.trim().length > 0;

    if (hasText && !isTypingRef.current) {
      socketRef.current.emit('chat.typing.start', {
        conversationId: selectedConv.id,
      });
      isTypingRef.current = true;
    }

    if (!hasText && isTypingRef.current) {
      socketRef.current.emit('chat.typing.stop', {
        conversationId: selectedConv.id,
      });
      isTypingRef.current = false;
    }
  };

  const handleEditMessage = (message: any) => {
    if (!selectedConv || !socketRef.current) return;

    const nextContent = window.prompt("Edit message", message.content ?? "");
    if (!nextContent?.trim()) return;

    socketRef.current.emit('chat.editMessage', {
      conversationId: selectedConv.id,
      messageId: message.id,
      content: nextContent,
    });
  };

  const handleDeleteMessage = (message: any) => {
    if (!selectedConv || !socketRef.current) return;
    if (!window.confirm("Delete this message?")) return;

    socketRef.current.emit('chat.deleteMessage', {
      conversationId: selectedConv.id,
      messageId: message.id,
    });
  };

  const handleReact = async (message: any, type: ReactionType) => {
    if (!selectedConv || message.sender.id === user?.id || message.deletedAt) return;

    try {
      const result = await apiAddMessageReaction(selectedConv.id, message.id, type);

      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== message.id) return item;

          const reactions = item.reactions ?? [];
          const alreadyExists = reactions.some(
            (reaction: any) =>
              reaction.userId === user?.id && reaction.type === result.reaction.type,
          );

          if (alreadyExists) return item;

          return {
            ...item,
            reactions: [
              ...reactions,
              {
                ...result.reaction,
                userId: user?.id,
              },
            ],
          };
        }),
      );
    } catch (err) {
      console.error("Failed to react:", err);
    }
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

  socket.on('chat.message.updated', (msg) => {
    setMessages((prev) => prev.map((item) => item.id === msg.id ? msg : item));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastMessage: msg.content }
          : c
      )
    );
  });

  socket.on('chat.message.deleted', (msg) => {
    setMessages((prev) => prev.map((item) => item.id === msg.id ? msg : item));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastMessage: "Message deleted" }
          : c
      )
    );
  });

  socket.on('chat.conversation.read', (payload) => {
    if (payload?.userId === user.id) return;

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.sender.id !== user.id || msg.deletedAt) return msg;
        if (payload?.messageId && msg.id !== payload.messageId) return msg;

        const reads = msg.reads ?? [];
        if (reads.some((read: any) => read.userId === payload.userId)) return msg;

        return {
          ...msg,
          reads: [
            ...reads,
            {
              userId: payload.userId,
              readAt: new Date().toISOString(),
            },
          ],
        };
      })
    );
  });

  socket.on('chat.typing', (payload) => {
    if (!payload?.userId || payload.userId === user.id) return;

    setTypingUsers((prev) => {
      const next = { ...prev };
      if (payload.isTyping) next[payload.userId] = payload.username ?? "Someone";
      else delete next[payload.userId];
      return next;
    });
  });

  socket.on('presence.changed', (payload) => {
    if (!payload?.userId) return;

    setOnlineUserIds((prev) => {
      const next = new Set(prev);
      if (payload.isOnline) next.add(payload.userId);
      else next.delete(payload.userId);
      return next;
    });
  });

  socket.emit('presence.list', {}, (payload: { onlineUserIds?: string[] }) => {
    setOnlineUserIds(new Set(payload?.onlineUserIds ?? []));
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
    socket.off('chat.message.updated');
    socket.off('chat.message.deleted');
    socket.off('chat.conversation.read');
    socket.off('chat.typing');
    socket.off('presence.changed');
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

  setTypingUsers({});
  socket.emit('chat.joinConversation', { conversationId: selectedConv.id });

  return () => {
    socket.emit('chat.typing.stop', { conversationId: selectedConv.id });
    isTypingRef.current = false;
    socket.emit('chat.leaveConversation', { conversationId: selectedConv.id });
  };
}, [selectedConv]);

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
          isAdmin={user?.globalRole === 'ADMIN'}
          onAddFriend={(id) => { addFriendRequest(id); setMenu(null); }}
          onBlock={(id) => { blockUser(id); setMenu(null); }}
          onUnblock={(id) => { unblockUser(id); setMenu(null); }}
          onPromote={(id) => { console.log('promote', id); setMenu(null); }}
        />
      )}
      <ChatPanel
        selectedConv={selectedConv}
	        messages={messages}
	        messageInput={messageInput}
	        currentUserId={user?.id}
          typingUsers={Object.values(typingUsers)}
          onlineCount={onlineUserIds.size}
	        bottomRef={bottomRef}
	        onInputChange={handleInputChange}
          onSend={handleSend}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReact={handleReact}
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
