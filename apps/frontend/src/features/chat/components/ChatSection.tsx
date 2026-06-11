"use client";

import { ChatPanel } from "./ChatPanel";
import { SearchDropdown } from "./SearchDropdown";
import { SidebarSearch } from "./SidebarSearch";
import { UserContextMenu } from "./UserContextMenu";
import { GroupMenuModal } from "./modals/GroupMenuModal";
import { CreateGroupModal, UserPickerModal } from "./modals/UserPickerModal";
import {
  DeleteModal,
  EditModal,
  LeaveModal,
  MembersModal,
  RenameModal,
  ReportModal,
} from "./modals/GroupModals";
import { useChatController } from "@/features/chat/hooks/use-chat-controller";

export function ChatSection() {
  const chat = useChatController();

  const handleCloseSearchDropdown = () => {
    chat.setSearchResults([]);
  };

  return (
    <section className="flex flex-1 h-full relative overflow-hidden">
      {chat.searchResults.length > 0 && (
        <div
          className="fixed inset-0 z-0"
          onClick={handleCloseSearchDropdown}
        />
      )}
      <SidebarSearch
        searchQuery={chat.searchQuery}
        conversations={chat.conversations}
        selectedConvId={chat.selectedConv?.id ?? null}
        onSearchChange={chat.handleSearch}
        onSelectConv={chat.setSelectedConv}
        onOpenGroupModal={() => chat.setGroupModal(true)}
        onDeleteConv={chat.handleDeleteConversationLocally}
      />
      <SearchDropdown
        results={chat.searchResults}
        onSelectUser={chat.handleSelectUser}
        onOpenMenu={(user, x, y) => chat.setMenu({ user, x, y })}
      />
      {chat.menu && (
        <UserContextMenu
          user={chat.menu.user}
          x={chat.menu.x}
          y={chat.menu.y}
          isAdmin={chat.user?.globalRole === "ADMIN"}
          onAddFriend={chat.handleAddFriend}
          onBlock={chat.handleBlock}
          onUnblock={chat.handleUnblock}
          onPromote={chat.handlePromote}
          onViewProfile={chat.handleViewProfile}
        />
      )}
      {chat.reportModal && (
        <ReportModal
          onSubmit={(reason) =>
            chat.handleReport(
              chat.reportModal!.messageId,
              chat.reportModal!.userId,
              reason,
            )
          }
          onClose={() => chat.setReportModal(null)}
        />
      )}
      {chat.editModal && (
        <EditModal
          message={chat.editModal.message}
          onSubmit={chat.handleEditSubmit}
          onClose={() => chat.setEditModal(null)}
        />
      )}
      {chat.deleteModal && (
        <DeleteModal
          onConfirm={chat.handleDeleteConfirm}
          onClose={() => chat.setDeleteModal(null)}
        />
      )}
      {chat.groupModal && (
        <CreateGroupModal
          onSubmit={chat.handleCreateGroup}
          onClose={() => chat.setGroupModal(false)}
        />
      )}
      {chat.groupMenuOpen && chat.selectedConv?.type === "group" && (
        <GroupMenuModal
          onInvite={() => {
            chat.setInviteModal(true);
            chat.setGroupMenuOpen(false);
          }}
          onMembers={chat.handleOpenMembers}
          onRename={() => {
            chat.setRenameModal(true);
            chat.setGroupMenuOpen(false);
          }}
          onLeave={() => {
            chat.setLeaveModal(true);
            chat.setGroupMenuOpen(false);
          }}
          onClose={() => chat.setGroupMenuOpen(false)}
          isOwner={chat.isOwner}
        />
      )}
      {chat.inviteModal && (
        <UserPickerModal
          title="Add members"
          submitLabel="Add"
          minUsers={1}
          onSubmit={chat.handleInviteSubmit}
          onClose={() => chat.setInviteModal(false)}
        />
      )}
      {chat.membersModal && (
        <MembersModal
          members={chat.members}
          currentUserId={chat.user?.id}
          currentUserRole={chat.currentUserRole}
          onRemove={chat.handleRemoveMember}
          onClose={() => chat.setMembersModal(false)}
        />
      )}
      {chat.renameModal && chat.selectedConv && (
        <RenameModal
          currentName={chat.selectedConv.name}
          onSubmit={chat.handleRenameSubmit}
          onClose={() => chat.setRenameModal(false)}
        />
      )}
      {chat.leaveModal && (
        <LeaveModal
          onConfirm={chat.handleLeaveConfirm}
          onClose={() => chat.setLeaveModal(false)}
        />
      )}
      <ChatPanel
        selectedConv={chat.selectedConv}
        messages={chat.filteredMessages}
        messageInput={chat.messageInput}
        currentUserId={chat.user?.id}
        typingUsers={chat.typingUserNames}
        onlineCount={chat.onlineCount}
        bottomRef={chat.bottomRef}
        onInputChange={chat.handleInputChange}
        onSend={chat.handleSend}
        onEditMessage={(message) => chat.setEditModal({ message })}
        onDeleteMessage={(message) => chat.setDeleteModal({ message })}
        onReact={chat.handleReact}
        onReport={(messageId, userId) =>
          chat.setReportModal({ messageId, userId })
        }
        onOpenGroupMenu={() => chat.setGroupMenuOpen(true)}
      />
    </section>
  );
}
