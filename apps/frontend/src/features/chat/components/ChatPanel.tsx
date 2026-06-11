"use client";

import type { RefObject } from "react";
import type {
  ChatMessage,
  Conversation,
  ReactionType,
} from "@/features/chat/types/chat.types";
import { reactionIcons } from "@/features/chat/types/chat.types";

type ChatPanelProps = {
  selectedConv: Conversation | null;
  messages: ChatMessage[];
  messageInput: string;
  currentUserId: string | undefined;
  typingUsers: string[];
  onlineCount: number;
  bottomRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onReport: (messageId: string, userId: string) => void;
  onEditMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, type: ReactionType) => void;
  onOpenGroupMenu: () => void;
};

function MessageBubble({
  msg,
  currentUserId,
  lastEditableMessageId,
  onReport,
  onEditMessage,
  onDeleteMessage,
  onReact,
}: {
  msg: ChatMessage;
  currentUserId: string | undefined;
  lastEditableMessageId?: string;
  onReport: (messageId: string, userId: string) => void;
  onEditMessage: (message: ChatMessage) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, type: ReactionType) => void;
}) {
  const isMe = msg.sender.id === currentUserId;
  const isDeleted = Boolean(msg.deletedAt);
  const isSystemMessage = msg.type === "SYSTEM";
  const canEditOrDelete =
    isMe && !isDeleted && !isSystemMessage && lastEditableMessageId === msg.id;
  const reactionCounts = (msg.reactions ?? []).reduce(
    (counts: Record<ReactionType, number>, reaction) => {
      counts[reaction.type] = (counts[reaction.type] ?? 0) + 1;
      return counts;
    },
    { THUMBS_UP: 0, HEART: 0 },
  );

  return (
    <div
      className={`flex w-full ${isMe ? "justify-end" : "justify-start items-start"}`}
    >
      <div className="flex flex-col max-w-xs min-w-0">
        {!isMe && (
          <span className="text-xs text-gray-500 mb-1 ml-1">
            {msg.sender.username}
          </span>
        )}
        <div
          className={`px-3 py-2 rounded-lg text-sm font-bold wrap-break-word overflow-hidden ${isMe ? "ColorsS text-white" : "bg-gray-300 text-black"} ${isDeleted ? "italic opacity-70" : ""}`}
        >
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
        <div
          className={`mt-1 flex gap-2 text-[11px] text-gray-500 ${isMe ? "justify-end" : "justify-start"}`}
        >
          {msg.isEdited && !isDeleted && <span>edited</span>}
          {canEditOrDelete && (
            <>
              <button
                onClick={() => onEditMessage(msg)}
                className="hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => onDeleteMessage(msg)}
                className="hover:underline"
              >
                Delete
              </button>
            </>
          )}
          {isMe && (msg.reads?.length ?? 0) > 0 && (
            <span>seen by {msg.reads?.length ?? 0}</span>
          )}
        </div>
        {!isDeleted && !isSystemMessage && (
          <div
            className={`mt-1 flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}
          >
            {(Object.keys(reactionIcons) as ReactionType[]).map((type) => (
              <button
                key={type}
                onClick={() => onReact(msg, type)}
                disabled={isMe}
                title={type === "HEART" ? "Heart" : "Thumbs up"}
                className={`flex h-6 items-center gap-1 rounded-full border border-gray-200 cursor-pointer bg-white px-2 text-[11px] shadow-sm transition ${isMe ? "cursor-not-allowed opacity-60" : "hover:bg-gray-100"}`}
              >
                <img
                  src={reactionIcons[type]}
                  alt=""
                  className="h-3.5 w-3.5 text-black"
                />
                {reactionCounts[type] > 0 && (
                  <span>{reactionCounts[type]}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
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
}: ChatPanelProps) {
  const lastEditableMessageId = [...messages]
    .reverse()
    .find((message) => !message.deletedAt)?.id;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {selectedConv && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {onlineCount} online{" "}
            {selectedConv.type === "group" ? `- ${selectedConv.name}` : ""}
          </span>
          {selectedConv.type === "group" && (
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
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              currentUserId={currentUserId}
              lastEditableMessageId={lastEditableMessageId}
              onReport={onReport}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onReact={onReact}
            />
          ))
        ) : (
          <div className="text-gray-500 text-center mt-10">
            Select a conversation
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {selectedConv && (
        <div className="border-t border-gray-300 p-4 flex flex-col gap-2 bg-white">
          {typingUsers.length > 0 && (
            <p className="text-xs text-gray-500 px-4">
              {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"}{" "}
              typing...
            </p>
          )}
          <div className="flex gap-2 items-center">
            <input
              value={messageInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSend();
                }
              }}
              type="text"
              placeholder="Enter a message..."
              className="flex-1 border border-gray-300 text-black rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onSend}
              className="bg-pink-500 text-white px-6 py-2 rounded-full hover:bg-green-500 cursor-pointer transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
