"use client";

import { useEffect, useRef } from 'react';
import { Eye, X } from '@phosphor-icons/react';
import { getPhoneAccountHistoryForPhone, getValidHistoryTimestamp } from '@/lib/phoneAccountHistory';
import { isInvalid } from '@/lib/utils';
import useDialogA11y from '../../_hooks/useDialogA11y';

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

function formatTime(value) {
  const timestamp = getValidHistoryTimestamp(value);
  return timestamp === null ? '-' : timeFormatter.format(new Date(timestamp));
}

function getHistoryStatus(item) {
  if (item.isDeleted) return '已删除';
  if (item.account.status === 'archived') return '停用';
  if (isInvalid(item.account)) return '已过期';
  return '有效';
}

function getHistoryStatusClassName(item, status) {
  if (item.isDeleted) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === '有效') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function PhoneAccountHistoryModal({
  phone,
  history = [],
  accounts = [],
  isOpen,
  onClose,
  onViewAccount,
}) {
  const dialogRef = useRef(null);
  const lastViewedAccountRef = useRef(null);
  const phoneIdRef = useRef(phone?.id ?? null);

  useEffect(() => {
    if (phoneIdRef.current !== (phone?.id ?? null)) {
      lastViewedAccountRef.current = null;
      phoneIdRef.current = phone?.id ?? null;
    }
  }, [phone?.id]);

  const handleClose = () => {
    lastViewedAccountRef.current = null;
    onClose();
  };
  const dialogA11y = useDialogA11y({
    isOpen: isOpen && !!phone,
    onClose: handleClose,
    dialogRef,
    initialFocusRef: lastViewedAccountRef,
  });

  if (!phone) return null;

  const resolvedHistory = getPhoneAccountHistoryForPhone({
    phoneId: phone.id,
    history,
    accounts,
  });
  const dialogProps = isOpen ? {
    role: dialogA11y.role,
    'aria-modal': dialogA11y['aria-modal'],
    'aria-labelledby': dialogA11y['aria-labelledby'],
    tabIndex: dialogA11y.tabIndex,
  } : {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      hidden={!isOpen}
      aria-hidden={isOpen ? undefined : 'true'}
    >
      <div
        ref={dialogA11y.ref}
        {...dialogProps}
        className="relative w-full max-w-2xl rounded-xl border border-border bg-background p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭历史关联账号弹窗"
          className="absolute right-5 top-5 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="关闭"
        >
          <X size={20} />
        </button>

        <div className="mb-5 min-w-0 pr-10">
          <h2 id={isOpen ? dialogA11y.titleId : undefined} className="text-lg font-semibold tracking-tight text-foreground">
            历史关联账号
          </h2>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="truncate font-mono text-sm tabular-nums text-muted-foreground" title={phone.number || '待提取手机号'}>
              {phone.number || '待提取手机号'}
            </p>
            <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {resolvedHistory.length} 个账号
            </span>
          </div>
        </div>

        <div className="max-h-[min(65vh,36rem)] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-panel">
          {resolvedHistory.map((item) => {
            const status = getHistoryStatus(item);
            const statusClassName = getHistoryStatusClassName(item, status);
            const viewLabel = item.isDeleted
              ? `账号 ${item.username || '-'} 已删除，无法查看详情`
              : `查看账号 ${item.username || '-'} 详情`;

            return (
              <article key={item.accountId} data-phone-history-item className="p-4 transition-colors hover:bg-muted/25">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="truncate text-sm font-semibold text-foreground" title={item.site || '-'}>{item.site || '-'}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground" title={item.username || '-'}>{item.username || '-'}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${statusClassName}`}>
                      {status}
                    </span>
                    <button
                      type="button"
                      disabled={item.isDeleted}
                      aria-label={viewLabel}
                      title={item.isDeleted ? '账号已删除' : '查看账号详情'}
                      onClick={(event) => {
                        lastViewedAccountRef.current = event.currentTarget;
                        onViewAccount(item.account);
                      }}
                      className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-all hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Eye size={15} />
                      <span>{item.isDeleted ? '不可查看' : '查看'}</span>
                    </button>
                  </div>
                </div>
                <div data-phone-history-times className="mt-3 grid grid-cols-1 gap-2 border-t border-border/70 pt-3 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <span className="text-muted-foreground">首次关联</span>
                    <span className="mt-0.5 block font-mono tabular-nums text-foreground sm:whitespace-nowrap">{formatTime(item.firstBoundAt)}</span>
                  </div>
                  <div className="min-w-0 sm:text-right">
                    <span className="text-muted-foreground">最近关联</span>
                    <span className="mt-0.5 block font-mono tabular-nums text-foreground sm:whitespace-nowrap">{formatTime(item.lastBoundAt)}</span>
                  </div>
                </div>
              </article>
            );
          })}
          {resolvedHistory.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="text-sm font-medium text-foreground">暂无历史关联账号</div>
              <div className="mt-1 text-xs text-muted-foreground">该手机号还没有可展示的关联记录</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
