'use client';

import { Plus, X } from '@phosphor-icons/react';
import { useRef } from 'react';
import useDialogA11y from '../../_hooks/useDialogA11y';
import MemberCreateForm from './MemberCreateForm';
import MemberList from './MemberList';
import { MEMBER_LIMIT } from './memberViewUtils';
import TemporaryCredentialPanel from './TemporaryCredentialPanel';
import useMemberManagement from './useMemberManagement';

export default function MemberManagementDialog({
  isOpen,
  onClose,
  onUnauthorized,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const memberManagement = useMemberManagement({
    isOpen,
    onClose,
    onUnauthorized,
  });
  const {
    members,
    loading,
    error,
    operation,
    showCreateForm,
    username,
    temporaryCredential,
    copied,
  } = memberManagement.state;
  const {
    close,
    openCreate,
    cancelCreate,
    setUsername,
    create,
    changeStatus,
    resetPassword,
    copyTemporaryPassword,
  } = memberManagement.actions;
  const dialogA11y = useDialogA11y({
    isOpen,
    onClose: close,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!isOpen) return null;

  const atMemberLimit = members.length >= MEMBER_LIMIT;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#111111]/30 p-3 sm:p-6">
      <section
        ref={dialogA11y.ref}
        role={dialogA11y.role}
        aria-modal={dialogA11y['aria-modal']}
        aria-labelledby={dialogA11y['aria-labelledby']}
        aria-busy={Boolean(operation)}
        tabIndex={dialogA11y.tabIndex}
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-panel shadow-xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-panel px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={dialogA11y.titleId} className="text-lg font-semibold tracking-tight text-foreground">
              成员管理
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              创建只读成员，管理登录状态与临时密码
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            disabled={Boolean(operation)}
            aria-label="关闭成员管理弹窗"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">当前成员 {members.length}/{MEMBER_LIMIT}</p>
              {atMemberLimit && (
                <p className="mt-1 text-[13px] text-muted-foreground">成员数量已达 5 人上限</p>
              )}
            </div>
            <button
              type="button"
              aria-label="创建成员"
              disabled={loading || atMemberLimit || Boolean(operation)}
              onClick={openCreate}
              className="btn btn-primary w-full sm:w-auto"
            >
              <Plus size={15} weight="bold" />
              创建成员
            </button>
          </div>

          {showCreateForm && (
            <MemberCreateForm
              username={username}
              creating={operation === 'create'}
              onUsernameChange={setUsername}
              onCancel={cancelCreate}
              onSubmit={create}
            />
          )}

          {temporaryCredential && (
            <TemporaryCredentialPanel
              credential={temporaryCredential}
              copied={copied}
              onCopy={copyTemporaryPassword}
            />
          )}

          <div aria-live="polite" className="min-h-5 text-[13px] leading-5">
            {operation ? (
              <span className="text-muted-foreground">成员操作处理中，请等待完成后关闭</span>
            ) : (
              <span className="text-danger">{error}</span>
            )}
          </div>

          <MemberList
            members={members}
            loading={loading}
            operation={operation}
            onStatusChange={changeStatus}
            onResetPassword={resetPassword}
          />
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-border bg-panel px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={close}
            disabled={Boolean(operation)}
            className="btn btn-default"
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}
