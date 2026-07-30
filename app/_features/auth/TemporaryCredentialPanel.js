'use client';

import { Check, Copy } from '@phosphor-icons/react';

export default function TemporaryCredentialPanel({ credential, copied, onCopy }) {
  return (
    <div role="status" className="rounded-lg border border-border bg-muted/50 p-4">
      <p className="text-sm font-semibold text-foreground">请立即保存临时密码</p>
      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
        关闭弹窗后不会再次显示。成员首次登录后必须修改密码。
      </p>
      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <span className="block text-xs text-muted-foreground">{credential.username}</span>
          <code className="mt-1 block break-all rounded-md border border-border bg-panel px-3 py-2 font-mono text-sm text-foreground">
            {credential.password}
          </code>
        </div>
        <button type="button" onClick={onCopy} className="btn btn-default w-full sm:w-auto">
          {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
          {copied ? '已复制' : '复制密码'}
        </button>
      </div>
    </div>
  );
}
