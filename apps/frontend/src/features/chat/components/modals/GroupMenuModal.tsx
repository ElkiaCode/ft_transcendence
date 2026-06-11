export function GroupMenuModal({
  onInvite,
  onMembers,
  onRename,
  onLeave,
  onClose,
  isOwner,
}: {
  onInvite: () => void;
  onMembers: () => void;
  onRename: () => void;
  onLeave: () => void;
  onClose: () => void;
  isOwner: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute right-4 top-12 bg-white rounded-lg shadow-lg w-44 flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isOwner && (
          <button
            onClick={onInvite}
            className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            Add members
          </button>
        )}
        <button
          onClick={onMembers}
          className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
        >
          View members
        </button>
        {isOwner && (
          <button
            onClick={onRename}
            className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            Rename group
          </button>
        )}
        <button
          onClick={onLeave}
          className="text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 transition"
        >
          Leave group
        </button>
      </div>
    </div>
  );
}
