"use client";

import { useCallback, useRef, useState } from 'react';
import {
  Eye,
  Key,
  ShieldCheck,
  SignOut,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import useDialogA11y from '../../_hooks/useDialogA11y';
import MemberManagementDialog from './MemberManagementDialog';
import PasswordChangeForm from './PasswordChangeForm';

function PasswordChangeDialog({
  isOpen,
  error,
  onChangePassword,
  onClose,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogA11y = useDialogA11y({
    isOpen,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#111111]/30 p-3 sm:p-6">
      <section
        ref={dialogA11y.ref}
        role={dialogA11y.role}
        aria-modal={dialogA11y['aria-modal']}
        aria-labelledby={dialogA11y['aria-labelledby']}
        tabIndex={dialogA11y.tabIndex}
        className="my-auto w-full max-w-md rounded-xl border border-border bg-panel p-5 shadow-xl sm:p-6"
      >
        <div className="mb-5 flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="关闭修改密码弹窗"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X size={18} />
          </button>
        </div>
        <PasswordChangeForm
          embedded
          error={error}
          titleId={dialogA11y.titleId}
          onChangePassword={onChangePassword}
          onSuccess={onClose}
        />
      </section>
    </div>
  );
}

export default function SessionControls({
  user,
  error,
  onLogout,
  onChangePassword,
  onUnauthorized,
}) {
  const [dialog, setDialog] = useState(null);
  const isAdmin = user?.role === 'admin';
  const closeDialog = useCallback(() => setDialog(null), []);

  const handleLogout = async () => {
    setDialog(null);
    await onLogout();
  };

  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5">
          {isAdmin ? (
            <ShieldCheck className="shrink-0 text-foreground" size={16} weight="bold" />
          ) : (
            <Eye className="shrink-0 text-muted-foreground" size={16} />
          )}
          <span className="min-w-0 leading-tight">
            <span className="block max-w-20 truncate text-xs font-medium text-foreground sm:max-w-28">
              {user?.username}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {isAdmin ? '管理员' : '只读成员'}
            </span>
          </span>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setDialog('members')}
            title="成员管理"
            className="btn btn-ghost px-2.5"
          >
            <UsersThree size={16} />
            <span className="hidden lg:inline">成员管理</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setDialog('password')}
          title="修改密码"
          className="btn btn-ghost px-2.5"
        >
          <Key size={16} />
          <span className="hidden lg:inline">修改密码</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="退出登录"
          className="btn btn-ghost px-2.5 text-muted-foreground hover:text-danger"
        >
          <SignOut size={16} />
          <span className="hidden lg:inline">退出</span>
        </button>
      </div>

      {isAdmin && (
        <MemberManagementDialog
          isOpen={dialog === 'members'}
          onClose={closeDialog}
          onUnauthorized={onUnauthorized}
        />
      )}
      <PasswordChangeDialog
        isOpen={dialog === 'password'}
        error={error}
        onChangePassword={onChangePassword}
        onClose={closeDialog}
      />
    </>
  );
}
