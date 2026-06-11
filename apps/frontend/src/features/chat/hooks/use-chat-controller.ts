"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Socket } from "socket.io-client";
import {
  addFriendRequest,
  apiPromoteUser,
  apiSearchUsers,
  blockUser,
  unblockUser,
} from "@/features/auth/api/auth.api";
import {
  apiAddMessageReaction,
  apiCreateGroupConversation,
  apiGetConversations,
  apiGetGroupMembers,
  apiGetMessages,
  apiInviteGroupMembers,
  apiLeaveGroupConversation,
  apiRemoveGroupMember,
  apiRenameGroupConversation,
  apiReportMessage,
  createOrGetDirectConversation,
} from "@/features/chat/api/chat.api";
import {
  getChatSocket,
  resetChatSocket,
} from "@/features/chat/socket/chat-socket";
import type {
  ChatMessage,
  Conversation,
  GroupMember,
  MessageReaction,
  ReactionType,
  SearchUser,
} from "@/features/chat/types/chat.types";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useNotificationsStore } from "@/features/notifications/stores/notifications.store";
import { NotificationItem } from "@/lib/types";

export function useChatController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("conversation");

  const socketRef = useRef<Socket | null>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const membersRef = useRef<GroupMember[]>([]);
  const selectedConvRef = useRef<Conversation | null>(null);

  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id;

  const userIdRef = useRef(currentUserId);
  const convTypeRef = useRef<Conversation["type"] | undefined>(undefined);

  const setActiveConversationId = useNotificationsStore(
    (state) => state.setActiveConversationId,
  );

  const markConversationAsRead = useNotificationsStore(
    (state) => state.markConversationAsRead,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConvState] = useState<Conversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const [menu, setMenu] = useState<{
    user: SearchUser;
    x: number;
    y: number;
  } | null>(null);

  const [reportModal, setReportModal] = useState<{
    messageId: string;
    userId: string;
  } | null>(null);

  const [editModal, setEditModal] = useState<{ message: ChatMessage } | null>(
    null,
  );

  const [deleteModal, setDeleteModal] = useState<{
    message: ChatMessage;
  } | null>(null);

  const [groupModal, setGroupModal] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [membersModal, setMembersModal] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const currentUserRole = members.find(
    (member) => member.userId === user?.id,
  )?.role;

  const isOwner = currentUserRole === "OWNER";

  const convId = selectedConv?.id;
  const convType = selectedConv?.type;

  const updateConversationQuery = useCallback(
    (conversationId: string | null) => {
      const currentConversationId = searchParams.get("conversation");

      if (currentConversationId === conversationId) return;

      const params = new URLSearchParams(searchParams.toString());

      if (conversationId) {
        params.set("conversation", conversationId);
      } else {
        params.delete("conversation");
      }

      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;

      router.push(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const resetConversationUnreadCount = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv,
      ),
    );
  }, []);

  const markConversationNotificationsAsRead = useCallback(
    async (conversationId: string) => {
      try {
        await markConversationAsRead(conversationId);
      } catch (err) {
        console.error(
          "Failed to mark conversation notifications as read:",
          err,
        );
      }
    },
    [markConversationAsRead],
  );

  const handleSelectConversation = useCallback(
    (conversation: Conversation | null) => {
      setSelectedConvState(conversation);
      setActiveConversationId(conversation?.id ?? null);

      updateConversationQuery(conversation?.id ?? null);

      if (!conversation) return;

      resetConversationUnreadCount(conversation.id);

      void markConversationNotificationsAsRead(conversation.id);
    },
    [
      setActiveConversationId,
      updateConversationQuery,
      resetConversationUnreadCount,
      markConversationNotificationsAsRead,
    ],
  );

  useEffect(() => {
    const handleClick = () => setMenu(null);

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  useEffect(() => {
    userIdRef.current = currentUserId;
    convTypeRef.current = selectedConv?.type;
  }, [currentUserId, selectedConv?.type]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user || conversations.length !== 0) return;

    apiGetConversations()
      .then((convs: Conversation[]) => {
        setConversations(convs);

        const conversationFromQuery = queryConversationId
          ? convs.find((conv) => conv.id === queryConversationId)
          : null;

        const conversationToSelect = conversationFromQuery ?? convs[0] ?? null;

        handleSelectConversation(conversationToSelect);
      })
      .catch((err) => console.error("Failed to load conversations:", err));
  }, [
    user,
    queryConversationId,
    handleSelectConversation,
    conversations.length,
  ]);

  useEffect(() => {
    if (!queryConversationId || conversations.length === 0) return;

    const conversationFromQuery = conversations.find(
      (conv) => conv.id === queryConversationId,
    );

    if (!conversationFromQuery) return;

    if (selectedConvRef.current?.id === conversationFromQuery.id) return;

    queueMicrotask(() => {
      handleSelectConversation(conversationFromQuery);
    });
  }, [queryConversationId, conversations, handleSelectConversation]);

  useEffect(() => {
    if (!convId || !currentUserId) return;

    const fetchData = async () => {
      try {
        const [rawMessages, groupMembers] = await Promise.all([
          apiGetMessages(convId),
          convType === "group"
            ? apiGetGroupMembers(convId)
            : Promise.resolve([]),
        ]);

        setMembers(groupMembers);
        setMessages(rawMessages);

        const lastMessage = rawMessages[rawMessages.length - 1];

        if (lastMessage && socketRef.current) {
          socketRef.current.emit("chat.markRead", {
            conversationId: convId,
            messageId: lastMessage.id,
          });
        }

        void markConversationNotificationsAsRead(convId);
      } catch (err) {
        console.error("Failed to load chat data:", err);
      }
    };

    void fetchData();

    return () => {
      setMessages([]);
      setMembers([]);
    };
  }, [convId, currentUserId, convType, markConversationNotificationsAsRead]);

  const filteredMessages = useMemo(() => {
    if (!selectedConv || !messages.length) return [];

    if (selectedConv.type !== "group") return messages;

    const myMembership = members.find(
      (member) => member.userId === currentUserId,
    );

    if (!myMembership) return [];

    const joinTime = new Date(myMembership.joinedAt ?? 0).getTime();

    const leaveTime = myMembership.leftAt
      ? new Date(myMembership.leftAt).getTime()
      : Infinity;

    return messages.filter((message) => {
      const msgTime = new Date(message.createdAt ?? 0).getTime();

      return msgTime >= joinTime && msgTime <= leaveTime;
    });
  }, [currentUserId, members, messages, selectedConv]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setConversations([]);
        setMessages([]);
        handleSelectConversation(null);
        setSearchResults([]);
        setSearchQuery("");
      });
    }
  }, [user, handleSelectConversation]);

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

      setConversations((prev) =>
        prev.find((item) => item.id === conv.id) ? prev : [conv, ...prev],
      );

      handleSelectConversation(conv);
      setSearchResults([]);
      setSearchQuery("");
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const emitTypingStop = useCallback((conversationId?: string) => {
    const targetConversationId =
      conversationId ?? selectedConvRef.current?.id ?? null;

    if (!targetConversationId || !socketRef.current || !isTypingRef.current) {
      return;
    }

    socketRef.current.emit("chat.typing.stop", {
      conversationId: targetConversationId,
    });

    isTypingRef.current = false;
  }, []);

  const handleSend = () => {
    if (!messageInput.trim() || !selectedConv || !socketRef.current) return;

    socketRef.current.emit("chat.sendMessage", {
      conversationId: selectedConv.id,
      content: messageInput,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    emitTypingStop(selectedConv.id);
    setMessageInput("");
  };

  const TYPING_STOP_DELAY = 1500;

  const handleInputChange = (value: string) => {
    setMessageInput(value);

    if (!selectedConv || !socketRef.current) return;

    const hasText = value.trim().length > 0;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (hasText && !isTypingRef.current) {
      socketRef.current.emit("chat.typing.start", {
        conversationId: selectedConv.id,
      });

      isTypingRef.current = true;
    }

    if (hasText) {
      const conversationId = selectedConv.id;

      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop(conversationId);
      }, TYPING_STOP_DELAY);
    }

    if (!hasText) {
      emitTypingStop(selectedConv.id);
    }
  };

  const handleEditSubmit = (content: string) => {
    if (!selectedConv || !socketRef.current || !editModal?.message.id) return;

    socketRef.current.emit("chat.editMessage", {
      conversationId: selectedConv.id,
      messageId: editModal.message.id,
      content,
    });

    setEditModal(null);
  };

  const handleDeleteConfirm = () => {
    if (!selectedConv || !socketRef.current || !deleteModal?.message.id) return;

    socketRef.current.emit("chat.deleteMessage", {
      conversationId: selectedConv.id,
      messageId: deleteModal.message.id,
    });

    setDeleteModal(null);
  };

  const handleReact = async (message: ChatMessage, type: ReactionType) => {
    if (
      !selectedConv ||
      !user?.id ||
      message.sender.id === user.id ||
      message.deletedAt
    ) {
      return;
    }

    try {
      const result = await apiAddMessageReaction(
        selectedConv.id,
        message.id,
        type,
      );

      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== message.id) return item;

          const reactions = item.reactions ?? [];

          const alreadyExists = reactions.some(
            (reaction) =>
              reaction.userId === user.id &&
              reaction.type === result.reaction.type,
          );

          if (alreadyExists) return item;

          return {
            ...item,
            reactions: [
              ...reactions,
              {
                ...(result.reaction as MessageReaction),
                userId: currentUserId as string,
              } as MessageReaction,
            ],
          };
        }),
      );
    } catch (err) {
      console.error("Failed to react:", err);
    }
  };

  const handleReport = async (
    messageId: string,
    _userId: string,
    reason: string,
  ) => {
    try {
      await apiReportMessage(messageId, reason);
      setReportModal(null);
    } catch (err) {
      console.error("Failed to report:", err);
    }
  };

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

      setMembers((prev) => prev.filter((member) => member.userId !== userId));
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const handleRenameSubmit = async (title: string) => {
    if (!selectedConv) return;

    try {
      await apiRenameGroupConversation(selectedConv.id, title);

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConv.id ? { ...conv, name: title } : conv,
        ),
      );

      handleSelectConversation({
        ...selectedConv,
        name: title,
      });

      setRenameModal(false);
    } catch (err) {
      console.error("Failed to rename:", err);
    }
  };

  const handleLeaveConfirm = async () => {
    if (!selectedConv) return;

    try {
      await apiLeaveGroupConversation(selectedConv.id);

      setConversations((prev) =>
        prev.filter((conv) => conv.id !== selectedConv.id),
      );

      handleSelectConversation(null);
      setLeaveModal(false);
    } catch (err) {
      console.error("Failed to leave group:", err);
    }
  };

  const handleCreateGroup = async (_title: string, userIds: string[]) => {
    try {
      const res = await apiCreateGroupConversation(_title, userIds);
      const raw = res.conversation;

      const conv: Conversation = {
        id: raw.id,
        type: "group",
        name: raw.title ?? "Group chat",
        avatarUrl: null,
        lastMessage: null,
        unreadCount: 0,
      };

      setConversations((prev) => [conv, ...prev]);
      handleSelectConversation(conv);
      setGroupModal(false);
    } catch (err) {
      console.error("Failed to create group:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    const token = useAuthStore.getState().accessToken;
    const socket = getChatSocket(token);

    if (!socket) return;

    socketRef.current = socket;

    const handleMessageCreated = (msg: ChatMessage) => {
      const activeConversationId = selectedConvRef.current?.id ?? null;

      const isCurrentConversation = activeConversationId === msg.conversationId;

      const isFromCurrentUser = msg.sender?.id === userIdRef.current;

      if (isCurrentConversation) {
        setMessages((prev) => {
          const myMembership = membersRef.current.find(
            (member) => member.userId === userIdRef.current,
          );

          if (myMembership && convTypeRef.current === "group") {
            const joinTime = new Date(myMembership.joinedAt ?? 0).getTime();
            const msgTime = new Date(msg.createdAt ?? 0).getTime();

            const leaveTime = myMembership.leftAt
              ? new Date(myMembership.leftAt).getTime()
              : Infinity;

            if (msgTime < joinTime || msgTime > leaveTime) return prev;
          }

          if (prev.some((item) => item.id === msg.id)) return prev;

          return [...prev, msg];
        });

        socket.emit("chat.markRead", {
          conversationId: msg.conversationId,
          messageId: msg.id,
        });

        void markConversationNotificationsAsRead(msg.conversationId);
      }

      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id !== msg.conversationId) return conv;

          return {
            ...conv,
            lastMessage: msg.content,
            unreadCount:
              isCurrentConversation || isFromCurrentUser
                ? 0
                : (conv.unreadCount ?? 0) + 1,
          };
        });

        const index = updated.findIndex(
          (conv) => conv.id === msg.conversationId,
        );

        if (index > 0) {
          const [conv] = updated.splice(index, 1);
          updated.unshift(conv);
        }

        return updated;
      });
    };

    const handleMessageUpdated = (msg: ChatMessage) => {
      const isCurrentConversation =
        selectedConvRef.current?.id === msg.conversationId;

      if (isCurrentConversation) {
        setMessages((prev) =>
          prev.map((item) => (item.id === msg.id ? msg : item)),
        );
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === msg.conversationId
            ? { ...conv, lastMessage: msg.content }
            : conv,
        ),
      );
    };

    const handleMessageDeleted = (msg: ChatMessage) => {
      const isCurrentConversation =
        selectedConvRef.current?.id === msg.conversationId;

      if (isCurrentConversation) {
        setMessages((prev) =>
          prev.map((item) => (item.id === msg.id ? msg : item)),
        );
      }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === msg.conversationId
            ? { ...conv, lastMessage: "Message deleted" }
            : conv,
        ),
      );
    };

    const handleModerationWarning = (warning: {
      isBanned?: boolean;
      pointsLeftBeforeBan?: number;
      penaltyPointsToSubtract?: number;
      message?: string;
    }) => {
      if (warning?.isBanned) return;

      const pointsLeft = warning?.pointsLeftBeforeBan ?? 0;
      const penalty = warning?.penaltyPointsToSubtract ?? 0;

      const message =
        warning?.message ?? "Your message was flagged by automatic moderation.";

      window.alert(
        `${message} You lost ${penalty} points. You have ${pointsLeft} points left before being banned.`,
      );
    };

    const handleModerationBanned = (payload: { reason?: string }) => {
      const reason = payload?.reason ?? "harmful message";

      window.alert(
        `Your account was banned by automatic moderation. Cause: ${reason}`,
      );

      useAuthStore.getState().clear();
      resetChatSocket();

      window.setTimeout(() => window.location.reload(), 100);
    };

    const handleConversationRead = (payload: {
      userId?: string;
      messageId?: string;
    }) => {
      if (payload?.userId === user.id) return;

      setMessages((prev) =>
        prev.map((message) => {
          if (message.sender.id !== user.id || message.deletedAt) {
            return message;
          }

          if (payload?.messageId && message.id !== payload.messageId) {
            return message;
          }

          const reads = message.reads ?? [];

          if (reads.some((read) => read.userId === payload.userId)) {
            return message;
          }

          return {
            ...message,
            reads: [
              ...reads,
              {
                userId: payload.userId as string,
                readAt: new Date().toISOString(),
              },
            ],
          };
        }),
      );
    };

    const handleTyping = (payload: {
      userId?: string;
      username?: string;
      isTyping?: boolean;
    }) => {
      if (!payload?.userId || payload.userId === user.id) return;

      setTypingUsers((prev) => {
        const next = { ...prev };

        if (payload.isTyping) {
          next[payload.userId as string] = payload.username ?? "Someone";
        } else {
          delete next[payload.userId as string];
        }

        return next;
      });
    };

    const handlePresenceChanged = (payload: {
      userId?: string;
      isOnline?: boolean;
    }) => {
      const userId = payload.userId;

      if (!userId) return;

      setOnlineUserIds((prev) => {
        const next = new Set(prev);

        if (payload.isOnline) {
          next.add(userId);
        } else {
          next.delete(userId);
        }

        return next;
      });
    };

    const handleConversationCreated = (conv: Conversation) => {
      setConversations((prev) =>
        prev.find((item) => item.id === conv.id) ? prev : [conv, ...prev],
      );

      if (queryConversationId && conv.id === queryConversationId) {
        handleSelectConversation(conv);
      }
    };

    const handleNotificationCreated = (notif: NotificationItem) => {
      if (
        notif.type !== "MESSAGE" ||
        notif.entityType !== "CONVERSATION" ||
        selectedConv?.id === notif.entityId
      )
        return;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === notif.entityId
            ? {
                ...conv,
                lastMessage: notif.body,
                unreadCount: (conv.unreadCount ?? 0) + 1,
              }
            : conv,
        ),
      );
    };

    socket.on("notification.created", handleNotificationCreated);
    socket.on("chat.message.created", handleMessageCreated);
    socket.on("chat.message.updated", handleMessageUpdated);
    socket.on("chat.message.deleted", handleMessageDeleted);
    socket.on("chat.moderation.warning", handleModerationWarning);
    socket.on("chat.moderation.banned", handleModerationBanned);
    socket.on("chat.conversation.read", handleConversationRead);
    socket.on("chat.typing", handleTyping);
    socket.on("presence.changed", handlePresenceChanged);
    socket.on("chat.conversation.created", handleConversationCreated);

    socket.emit(
      "presence.list",
      {},
      (payload: { onlineUserIds?: string[] }) => {
        setOnlineUserIds(new Set(payload?.onlineUserIds ?? []));
      },
    );

    return () => {
      socket.off("chat.message.created", handleMessageCreated);
      socket.off("chat.message.updated", handleMessageUpdated);
      socket.off("chat.message.deleted", handleMessageDeleted);
      socket.off("chat.moderation.warning", handleModerationWarning);
      socket.off("chat.moderation.banned", handleModerationBanned);
      socket.off("chat.conversation.read", handleConversationRead);
      socket.off("chat.typing", handleTyping);
      socket.off("presence.changed", handlePresenceChanged);
      socket.off("chat.conversation.created", handleConversationCreated);
    };
  }, [
    user,
    queryConversationId,
    handleSelectConversation,
    markConversationNotificationsAsRead,
    selectedConv?.id,
  ]);

  useEffect(() => {
    if (!user) {
      resetChatSocket();
      socketRef.current = null;
    }
  }, [user]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket || !selectedConv) return;

    queueMicrotask(() => {
      setTypingUsers({});
    });

    socket.emit("chat.joinConversation", {
      conversationId: selectedConv.id,
    });

    void markConversationNotificationsAsRead(selectedConv.id);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      socket.emit("chat.typing.stop", {
        conversationId: selectedConv.id,
      });

      isTypingRef.current = false;

      socket.emit("chat.leaveConversation", {
        conversationId: selectedConv.id,
      });
    };
  }, [selectedConv, markConversationNotificationsAsRead]);

  return {
    user,
    searchQuery,
    searchResults,
    conversations,
    selectedConv,
    filteredMessages,
    messageInput,
    typingUserNames: Object.values(typingUsers),
    onlineCount: onlineUserIds.size,
    bottomRef,
    menu,
    reportModal,
    editModal,
    deleteModal,
    groupModal,
    groupMenuOpen,
    inviteModal,
    membersModal,
    renameModal,
    leaveModal,
    members,
    currentUserRole,
    isOwner,

    setMenu,
    setSelectedConv: handleSelectConversation,
    setReportModal,
    setEditModal,
    setDeleteModal,
    setGroupModal,
    setGroupMenuOpen,
    setInviteModal,
    setMembersModal,
    setRenameModal,
    setLeaveModal,
    setSearchResults,

    handleSearch,
    handleSelectUser,
    handleSend,
    handleInputChange,
    handleEditSubmit,
    handleDeleteConfirm,
    handleReact,
    handleReport,
    handleOpenMembers,
    handleInviteSubmit,
    handleRemoveMember,
    handleRenameSubmit,
    handleLeaveConfirm,
    handleCreateGroup,

    handleAddFriend: (id: string) => {
      addFriendRequest(id);
      setMenu(null);
    },

    handleBlock: (id: string) => {
      blockUser(id);
      setMenu(null);
    },

    handleUnblock: (id: string) => {
      unblockUser(id);
      setMenu(null);
    },

    handlePromote: (id: string) => {
      apiPromoteUser(id).catch(console.error);
      setMenu(null);
    },

    handleViewProfile: (username: string) => {
      router.push(`/profiles/${username}`);
      setMenu(null);
    },

    handleDeleteConversationLocally: (conversationId: string) => {
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId),
      );

      if (selectedConv?.id === conversationId) {
        handleSelectConversation(null);
      }
    },
  };
}
