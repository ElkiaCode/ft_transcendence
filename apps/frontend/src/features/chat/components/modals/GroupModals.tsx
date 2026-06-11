"use client";

import { useState } from "react";
import type {
  ChatMessage,
  GroupMember,
} from "@/features/chat/types/chat.types";

export function MembersModal({
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
  const canRemove = currentUserRole === "OWNER";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-96 flex flex-col gap-4 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Members</h2>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 p-2 rounded-lg"
            >
              <div className="w-8 h-8 ColorsS rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 overflow-hidden">
                {member.user.avatarUrl ? (
                  <img
                    src={member.user.avatarUrl}
                    alt={member.user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  member.user.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member.user.username}
                </p>
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
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function RenameModal({
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
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-black hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
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

export function LeaveModal({
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
        <p className="text-sm text-gray-600">
          Are you sure you want to leave this group?
        </p>
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
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditModal({
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

export function DeleteModal({
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
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this message? This action cannot be
          undone.
        </p>
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

export function ReportModal({
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
            onClick={() => onSubmit(reason)}
            disabled={reason.trim().length < 5}
            className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Report
          </button>
        </div>
      </div>
    </div>
  );
}
