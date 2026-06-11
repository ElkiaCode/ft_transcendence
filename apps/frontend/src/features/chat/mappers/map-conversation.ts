import { Conversation } from "../types/chat.types";

type User = {
  id: string;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
};

type ConversationParticipant = {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  leftAt?: string | null;
  user?: User | null;
};

type RawConversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  title?: string | null;
  participants: ConversationParticipant[];
};

export function mapConversation(
  conversation: RawConversation,
  searchUser: { id: string },
): Conversation {
  const selectedParticipant = conversation.participants.find(
    (participant) => participant.userId === searchUser.id,
  );

  const selectedUser = selectedParticipant?.user;

  const isDm = conversation.type === "DIRECT";

  return {
    id: conversation.id,
    type: isDm ? "dm" : "group",

    name: isDm
      ? (selectedUser?.username ?? selectedUser?.email ?? "Utilisateur inconnu")
      : (conversation.title ?? "Groupe sans nom"),

    avatarUrl: selectedUser?.avatarUrl ?? null,

    lastMessage: null,
    unreadCount: 0,
  };
}
