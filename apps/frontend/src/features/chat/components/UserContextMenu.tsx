import type { SearchUser } from "@/features/chat/types/chat.types";

export function UserContextMenu({
  user,
  x,
  y,
  isAdmin,
  onAddFriend,
  onBlock,
  onUnblock,
  onPromote,
  onViewProfile,
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
        <span className="w-2.5 h-2.5 mr-3 shrink-0 rounded-full bg-pink-500" />
        View Profile
      </button>
      <button
        type="button"
        onClick={() => onAddFriend(user.id)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 shrink-0 rounded-full bg-pink-500" />
        Add friend
      </button>
      <button
        type="button"
        onClick={() => onBlock(user.id)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 shrink-0 rounded-full bg-pink-500" />
        Block User
      </button>
      <button
        type="button"
        onClick={() => onUnblock(user.id)}
        className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
      >
        <span className="w-2.5 h-2.5 mr-3 shrink-0 rounded-full bg-pink-500" />
        Unblock User
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={() => onPromote(user.id)}
          className="flex items-center w-full px-4 py-2 text-sm font-bold leading-none text-white hover:bg-white/20 transition"
        >
          <span className="w-2.5 h-2.5 mr-3 shrink-0 rounded-full bg-pink-500" />
          Promote to Moderator
        </button>
      )}
    </div>
  );
}
