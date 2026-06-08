"use client";

import { useState, useEffect, useRef } from "react";
import { addFriendRequest, apiSearchUsers, blockUser, unblockUser } from "@/lib/api/auth";
import { apiAddMessageReaction, apiCreateGroupConversation, apiGetConversations, apiGetGroupMembers, apiGetMessages, apiInviteGroupMembers, apiLeaveGroupConversation, apiRemoveGroupMember, apiRenameGroupConversation, apiReportMessage, createOrGetDirectConversation } from "@/lib/api/chat";
import { useAuthStore } from "@/store/authStore";
import { Socket } from "socket.io-client";
import { getChatSocket, resetChatSocket } from "@/lib/socket/chat-socket";
import { apiPromoteUser } from "@/lib/api/auth";
import type { ChatMessage, GroupMember, MessageReaction } from "@/lib/types";
import { useRouter } from "next/navigation";

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

function GroupMenuModal({
  onInvite,
  onMembers,
  onRename,
  onLeave,
  onClose,
}: {
  onInvite: () => void;
  onMembers: () => void;
  onRename: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute right-4 top-12 bg-white rounded-lg shadow-lg w-44 flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onInvite} className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition">
          Add members
        </button>
        <button onClick={onMembers} className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition">
          View members
        </button>
        <button onClick={onRename} className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition">
          Rename group
        </button>
        <button onClick={onLeave} className="text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 transition">
          Leave group
        </button>
      </div>
    </div>
  );
}

function InviteMembersModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (userIds: string[]) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    try {
      const results = await apiSearchUsers(value);
      setSearchResults(results);
    } catch { setSearchResults([]); }
  };

  const toggleUser = (user: SearchUser) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Add members</h2>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto flex flex-col">
            {searchResults.map((user) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`flex items-center gap-3 p-2 cursor-pointer transition ${isSelected ? 'ColorsS' : 'hover:bg-gray-100'}`}
                >
                  <div className="w-8 h-8 ColorsS rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {user.profile?.avatarUrl ? (
                      <img src={user.profile.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm text-gray-900">{user.username}</span>
                  {isSelected && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
        )}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <span key={user.id} className="flex items-center gap-1 ColorsS text-blue-800 text-xs px-2 py-1 rounded-full">
                {user.username}
                <button onClick={() => toggleUser(user)} className="hover:text-blue-600 cursor-pointer">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">Cancel</button>
          <button
            onClick={() => onSubmit(selectedUsers.map((u) => u.id))}
            disabled={selectedUsers.length === 0}
            className="px-4 py-2 rounded-full ColorsS text-white hover:ColorsScursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function MembersModal({
  members,
  currentUserId,
  currentUserRole,
  onRemove,
  onClose,
}: {
  members: GroupMember[];
  currentUserId: string | undefined;
  currentUserRole: string | undefined;
  onRemove: (userId: string) => void;
  onClose: () => void;
}) {
  const canRemove = currentUserRole === 'OWNER';
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Members</h2>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 p-2 rounded-lg">
              <div className="w-8 h-8 ColorsS rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 overflow-hidden">
                {member.user.avatarUrl ? (
                  <img src={member.user.avatarUrl} alt={member.user.username} className="w-full h-full object-cover" />
                ) : (
                  member.user.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{member.user.username}</p>
                <p className="text-xs text-gray-400">{member.role}</p>
              </div>
              {canRemove && member.userId !== currentUserId && (
                  <button
                    onClick={() => onRemove(member.userId)}
                    className="text-red-400 hover:text-red-600 text-xs transition cursor-pointer"
                  >
                    Remove
                  </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">Close</button>
        </div>
      </div>
    </div>
  );
}

function RenameModal({
  currentName,
  onSubmit,
  onClose,
}: {
  currentName: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(currentName);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Rename group</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">Cancel</button>
          <button
            onClick={() => onSubmit(title)}
            disabled={!title.trim()}
            className="px-4 py-2 rounded-full ColorsS text-white hover:ColorsS cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

function LeaveModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Leave group</h2>
        <p className="text-sm text-gray-600">Are you sure you want to leave this group?</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 cursor-pointer transition">Leave</button>
        </div>
      </div>
    </div>
  );
}

function CreateGroupModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (title: string, userIds: string[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await apiSearchUsers(value);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  const toggleUser = (user: SearchUser) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Create group</h2>
        <input
          type="text"
          placeholder="Group name (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Search users to add..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto flex flex-col">
            {searchResults.map((user) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className={`flex items-center gap-3 p-2 cursor-pointer transition ${
                    isSelected ? 'ColorsS' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="w-8 h-8 ColorsS rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {user.profile?.avatarUrl ? (
                      <img src={user.profile.avatarUrl} alt={user.username} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm text-gray-900">{user.username}</span>
                  {isSelected && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
        )}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-1 ColorsS text-blue-800 text-xs px-2 py-1 rounded-full"
              >
                {user.username}
                <button
                  onClick={() => toggleUser(user)}
                  className="hover:text-blue-600 cursor-pointer"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">At least 2 users required</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(title, selectedUsers.map((u) => u.id))}
            disabled={selectedUsers.length < 2}
            className="px-4 py-2 rounded-full bg-green-500 text-white hover:bg-green-600 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  message,
  onSubmit,
  onClose,
}: {
  message: ChatMessage;
  onSubmit: (content: string) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(message.content ?? "");

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Edit message</h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border border-gray-300 rounded-lg p-3 text-sm text-black resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(content)}
            disabled={!content.trim()}
            className="px-4 py-2 rounded-full ColorsS text-white hover:ColorsS cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Delete message</h2>
        <p className="text-sm text-gray-600">Are you sure you want to delete this message? This action cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 cursor-pointer transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
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
    <div className="w-1/4 bg-gray-200 text-black font-bold flex flex-col p-4 gap-4 overflow-hidden">
      <div className="flex gap-2 items-center">
      <input
        type="text"
        placeholder="Search users..."
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        className="border border-gray-400 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[90%] font-normal"
        onKeyDown={(e) => {
            if (e.key === "Enter" && searchQuery.trim().length >= 2) {
              router.push(`/search?query=${searchQuery.trim()}`);
            }
          }}
      />
      <button onClick={onOpenGroupModal} className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 cursor-pointer transition w-[10%]">
        <img src="/addGroup.png" alt="Add Group" className="h-full w-full" />
      </button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-autoconst flex-1 relative">
        <h3 className="text-sm font-bold text-gray-700 px-2 text-center">Chat</h3>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConv(conv)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
              selectedConvId === conv.id ? 'ColorsS text-white' : 'hover:bg-gray-300'
            }`}
          >
            <div className={`w-10 h-10 ColorsS rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
               selectedConvId === conv.id ? 'ring-2 ring-white' : ''
              }`}>
              {conv.avatarUrl ? (
                <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full object-cover" />
              ) : (
                conv.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{conv.name}</p>
              <p className="text-xs text-gray-900 truncate">{conv.lastMessage || 'No messages yet'}</p>
            </div>
          {/* </div> */}
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteConv(conv.id); }}
            className="text-gray-400 hover:text-red-500 px-1 transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
            </svg>
          </button>
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
          <div className="w-10 h-10 ColorsS rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-medium">
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
  onViewProfile
}: {
  user: SearchUser;
  x: number;
  y: number;
  isAdmin: boolean;
  onAddFriend: (userId: string) => void;
  onBlock: (userId: string) => void;
  onUnblock: (userId: string) => void;
  onPromote: (userId: string) => void;
  onViewProfile: (username: string) => void;
}) {
  return (
      <div
        className="fixed z-50 w-44 ColorsS rounded-lg overflow-hidden shadow-lg border-2 border-pink-500"
        style={{ top: y, left: x }}
       >
      <button
        type="button"
        onClick={() => onViewProfile(user.username)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 flex-shrink-0 rounded-full bg-pink-500"></span>
        View Profile
     </button>
      <button
        type="button"
        onClick={() => onAddFriend(user.id)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 flex-shrink-0 rounded-full bg-pink-500"></span>
        Add friend
      </button>
      <button
        type="button"
        onClick={() => onBlock(user.id)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 flex-shrink-0 rounded-full bg-pink-500"></span>
        Block User
      </button>
      <button
        type="button"
        onClick={() => onUnblock(user.id)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 flex-shrink-0 rounded-full bg-pink-500"></span>
        Unblock User
      </button>
      {isAdmin && (
          <button
            type="button"
            onClick={() => onPromote(user.id)}
            className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
          >
            <span className="w-2.5 h-2.5 mr-3 flex-shrink-0 rounded-full bg-pink-500"></span>
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
  onReport,
  onEditMessage,
  onDeleteMessage,
  onReact,
  onOpenGroupMenu,
}: {
  selectedConv: Conversation | null;
  messages: ChatMessage[];
  messageInput: string;
  currentUserId: string | undefined;
  typingUsers: string[];
  onlineCount: number;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onReport: (messageId: string, userId: string) => void;
  onEditMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, type: ReactionType) => void;
  onOpenGroupMenu: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {selectedConv && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {onlineCount} online {selectedConv.type === 'group' ? `- ${selectedConv.name}` : ''}
          </span>
          {selectedConv.type === 'group' && (
            <button
              onClick={onOpenGroupMenu}
              className="text-gray-500 hover:text-gray-700 px-2 cursor-pointer"
            >
              ⋯
            </button>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {selectedConv ? (
          (() => {
            const lastEditableMessage = [...messages]
              .reverse()
              .find((message) => !message.deletedAt);

              return messages.map((msg) => {
		            const isMe = msg.sender.id === currentUserId;
		            const isDeleted = Boolean(msg.deletedAt);
                const isSystemMessage = msg.type === 'SYSTEM';
                const canEditOrDelete =
                  isMe &&
                  !isDeleted &&
                  !isSystemMessage &&
                  lastEditableMessage?.id === msg.id;
                const reactionCounts = (msg.reactions ?? []).reduce(
                  (counts: Record<ReactionType, number>, reaction: { type: ReactionType }) => {
                    counts[reaction.type] = (counts[reaction.type] ?? 0) + 1;
                    return counts;
                  },
                  { THUMBS_UP: 0, HEART: 0 },
                );
		          return (
                <div key={msg.id} className={`flex w-full ${isMe ? "justify-end" : "justify-start items-start"}`}>
                  <div className="flex flex-col max-w-xs min-w-0">
                    {!isMe && (
                      <span className="text-xs text-gray-500 mb-1 ml-1">{msg.sender.username}</span>
                    )}
                    <div className={`px-3 py-2 rounded-lg text-sm font-bold break-words overflow-hidden ${isMe ? "ColorsS text-white" : "bg-gray-300 text-black"} ${isDeleted ? "italic opacity-70" : ""}`}>
                      {isDeleted ? "Message deleted" : msg.content}
                    </div>
                    {!isMe && !isDeleted && (
                      <button
                        onClick={() => onReport(msg.id, msg.sender.id)}
                        className="text-gray-400 hover:text-red-500 text-xs transition mt-1 self-start"
                        title="Report"
                      >
                        ⚑
                      </button>
                    )}
                    <div className={`mt-1 flex gap-2 text-[11px] text-gray-500 ${isMe ? "justify-end" : "justify-start"}`}>
                      {msg.isEdited && !isDeleted && <span>edited</span>}
                      {canEditOrDelete && (
                        <>
                          <button onClick={() => onEditMessage(msg)} className="hover:underline">Edit</button>
                          <button onClick={() => onDeleteMessage(msg)} className="hover:underline">Delete</button>
                        </>
                      )}
	                      {isMe && (msg.reads?.length ?? 0) > 0 && <span>seen by {msg.reads?.length ?? 0}</span>}
	                    </div>
                    {!isDeleted && !isSystemMessage && (
                      <div className={`mt-1 flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                        {(Object.keys(reactionIcons) as ReactionType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => onReact(msg, type)}
                            disabled={isMe}
                            title={type === 'HEART' ? 'Heart' : 'Thumbs up'}
                            className={`flex h-6 items-center gap-1 rounded-full border border-gray-200 cursor-pointer bg-white px-2 text-[11px] shadow-sm transition ${
                              isMe ? "cursor-not-allowed opacity-60" : "hover:bg-gray-100"
                            }`}
                          >
                            <img src={reactionIcons[type]} alt="" className="h-3.5 w-3.5 text-black" />
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const router = useRouter();
  //const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<{ user: SearchUser; x: number; y: number } | null>(null);
  const [reportModal, setReportModal] = useState<{ messageId: string, userId: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [editModal, setEditModal] = useState<{ message: ChatMessage } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ message: ChatMessage } | null>(null);
  const isTypingRef = useRef(false);
  const [groupModal, setGroupModal] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [membersModal, setMembersModal] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [renameModal, setRenameModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);

  const handleOpenMembers = async () => {
    if (!selectedConv) return;
    try {
      const data = await apiGetGroupMembers(selectedConv.id);
      setMembers(data);
      setMembersModal(true);
      setGroupMenuOpen(false);
    } catch (err) {
      console.error("Failed to get members:", err);
    }
  };

  const handleInviteSubmit = async (userIds: string[]) => {
    if (!selectedConv) return;
    try {
      await apiInviteGroupMembers(selectedConv.id, userIds);
      setInviteModal(false);
    } catch (err) {
      console.error("Failed to invite members:", err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedConv) return;
    try {
      await apiRemoveGroupMember(selectedConv.id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const handleRenameSubmit = async (title: string) => {
    if (!selectedConv) return;
    try {
      await apiRenameGroupConversation(selectedConv.id, title);
      setConversations((prev) =>
        prev.map((c) => c.id === selectedConv.id ? { ...c, name: title } : c)
      );
      setSelectedConv((prev) => prev ? { ...prev, name: title } : prev);
      setRenameModal(false);
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  };

  const handleLeaveConfirm = async () => {
    if (!selectedConv) return;
    try {
      await apiLeaveGroupConversation(selectedConv.id);
      setConversations((prev) => prev.filter((c) => c.id !== selectedConv.id));
      setSelectedConv(null);
      setLeaveModal(false);
    } catch (err) {
      console.error("Failed to leave group:", err);
    }
  };

  const handleEditMessage = (message: ChatMessage) => {
    setEditModal({ message });
  };

  const handleDeleteMessage = (message: ChatMessage) => {
    setDeleteModal({ message });
  };

  const handleCreateGroup = async (title: string, userIds: string[]) => {
    try {
      const res = await apiCreateGroupConversation(title, userIds);
      const raw = res.conversation;

      const conv: Conversation = {
        id: raw.id,
        type: 'group',
        name: raw.title ?? 'Group chat',
        avatarUrl: null,
        lastMessage: null,
        unreadCount: 0,
      };

      setConversations((prev) => [conv, ...prev]);
      setSelectedConv(conv);
      setGroupModal(false);
    } catch (err) {
      console.error("Failed to create group:", err);
    }
  };

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
  }, [user]);

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
      queueMicrotask(() => {
        setConversations([]);
        setMessages([]);
        setSelectedConv(null);
        setSearchResults([]);
        setSearchQuery("");
      });
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

  const handleEditSubmit = (content: string) => {
    if (!selectedConv || !socketRef.current) return;
    socketRef.current.emit('chat.editMessage', {
      conversationId: selectedConv.id,
      messageId: editModal?.message.id,
      content,
    });
    setEditModal(null);
  };

  const handleDeleteConfirm = () => {
    if (!selectedConv || !socketRef.current) return;
    socketRef.current.emit('chat.deleteMessage', {
      conversationId: selectedConv.id,
      messageId: deleteModal?.message.id,
    });
    setDeleteModal(null);
  };

  const handleReact = async (message: ChatMessage, type: ReactionType) => {
    if (!selectedConv || !user?.id || message.sender.id === user.id || message.deletedAt) return;
    const currentUserId = user.id;

    try {
      const result = await apiAddMessageReaction(selectedConv.id, message.id, type);

      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== message.id) return item;

          const reactions = item.reactions ?? [];
          const alreadyExists = reactions.some(
            (reaction) => reaction.userId === user?.id && reaction.type === result.reaction.type,
          );

          if (alreadyExists) return item;

          return {
            ...item,
            reactions: [
              ...reactions,
              {
                ...(result.reaction as MessageReaction),
                userId: currentUserId,
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
  if (!socket) return;
  socketRef.current = socket;

  socket.on('chat.message.created', (msg: ChatMessage) => {
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

  socket.on('chat.message.updated', (msg: ChatMessage) => {
    setMessages((prev) => prev.map((item) => item.id === msg.id ? msg : item));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastMessage: msg.content }
          : c
      )
    );
  });

  socket.on('chat.message.deleted', (msg: ChatMessage) => {
    setMessages((prev) => prev.map((item) => item.id === msg.id ? msg : item));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === msg.conversationId
          ? { ...c, lastMessage: "Message deleted" }
          : c
      )
    );
  });

  socket.on('chat.moderation.warning', (warning) => {
    if (warning?.isBanned) return;

    const pointsLeft = warning?.pointsLeftBeforeBan ?? 0;
    const penalty = warning?.penaltyPointsToSubtract ?? 0;
    const message = warning?.message ?? 'Your message was flagged by automatic moderation.';
    window.alert(
      `${message} You lost ${penalty} points. You have ${pointsLeft} points left before being banned.`,
    );
  });

  socket.on('chat.moderation.banned', (payload) => {
    const reason = payload?.reason ?? 'harmful message';

    window.alert(`Your account was banned by automatic moderation. Cause: ${reason}`);
    useAuthStore.getState().clear();
    resetChatSocket();
    window.setTimeout(() => window.location.reload(), 100);
  });

  socket.on('chat.conversation.read', (payload) => {
    if (payload?.userId === user.id) return;

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.sender.id !== user.id || msg.deletedAt) return msg;
        if (payload?.messageId && msg.id !== payload.messageId) return msg;

        const reads = msg.reads ?? [];
        if (reads.some((read) => read.userId === payload.userId)) return msg;

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

  const handlePresenceChanged = (payload: { userId?: string; isOnline?: boolean }) => {
    const userId = payload.userId;
    if (!userId) return;

    setOnlineUserIds((prev) => {
      const next = new Set(prev);
      if (payload.isOnline) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  socket.on('presence.changed', handlePresenceChanged);

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
    socket.off('chat.moderation.warning');
    socket.off('chat.moderation.banned');
    socket.off('chat.conversation.read');
    socket.off('chat.typing');
    socket.off('presence.changed', handlePresenceChanged);
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

  queueMicrotask(() => setTypingUsers({}));
  socket.emit('chat.joinConversation', { conversationId: selectedConv.id });

  return () => {
    socket.emit('chat.typing.stop', { conversationId: selectedConv.id });
    isTypingRef.current = false;
    socket.emit('chat.leaveConversation', { conversationId: selectedConv.id });
  };
}, [selectedConv]);

const handleReport = async (messageId: string, _userId: string, reason: string) => {
  try {
    await apiReportMessage(messageId, reason);
    setReportModal(null);
  } catch (err) {
    console.error("Failed to report:", err);
  }
};

  return (
    <section className="flex flex-1 h-full relative overflow-hidden">
      <SidebarSearch
        searchQuery={searchQuery}
        conversations={conversations}
        selectedConvId={selectedConv?.id ?? null}
        onSearchChange={handleSearch}
        onSelectConv={setSelectedConv}
        onOpenGroupModal={() => setGroupModal(true)}
        onDeleteConv={(convId) => {
          setConversations((prev) => prev.filter((c) => c.id !== convId));
          if (selectedConv?.id === convId) setSelectedConv(null);
        }}
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
          onPromote={(id) => { apiPromoteUser(id).catch(console.error); setMenu(null); }}
          //onPromote={(id) => { console.log('promote', id); setMenu(null); }}
          onViewProfile={(username) => { router.push(`/profils/${username}`); setMenu(null); }}
        />
      )}
      {reportModal && (
        <ReportModal
          onSubmit={(reason) => handleReport(reportModal.messageId, reportModal.userId, reason)}
          onClose={() => setReportModal(null)}
        />
      )}
      {editModal && (
        <EditModal
          message={editModal.message}
          onSubmit={handleEditSubmit}
          onClose={() => setEditModal(null)}
        />
      )}
      {deleteModal && (
        <DeleteModal
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModal(null)}
        />
      )}
      {groupModal && (
        <CreateGroupModal
          onSubmit={handleCreateGroup}
          onClose={() => setGroupModal(false)}
        />
      )}
      {groupMenuOpen && selectedConv?.type === 'group' && (
        <GroupMenuModal
          onInvite={() => { setInviteModal(true); setGroupMenuOpen(false); }}
          onMembers={handleOpenMembers}
          onRename={() => { setRenameModal(true); setGroupMenuOpen(false); }}
          onLeave={() => { setLeaveModal(true); setGroupMenuOpen(false); }}
          onClose={() => setGroupMenuOpen(false)}
        />
      )}
      {inviteModal && (
        <InviteMembersModal
          onSubmit={handleInviteSubmit}
          onClose={() => setInviteModal(false)}
        />
      )}
      {membersModal && (
        <MembersModal
          members={members}
          currentUserId={user?.id}
          currentUserRole={members.find((m) => m.userId === user?.id)?.role}
          onRemove={handleRemoveMember}
          onClose={() => setMembersModal(false)}
        />
      )}
      {renameModal && selectedConv && (
        <RenameModal
          currentName={selectedConv.name}
          onSubmit={handleRenameSubmit}
          onClose={() => setRenameModal(false)}
        />
      )}
      {leaveModal && (
        <LeaveModal
          onConfirm={handleLeaveConfirm}
          onClose={() => setLeaveModal(false)}
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
          onReport={(messageId, userId) => setReportModal({ messageId, userId })}
          onOpenGroupMenu={() => setGroupMenuOpen(true)}
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
