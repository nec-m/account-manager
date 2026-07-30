'use client';

import { Key, Power, UserMinus } from '@phosphor-icons/react';
import { formatLastLogin } from './memberViewUtils';

function getStatusActionLabel(status, isChanging) {
  if (isChanging) return '处理中...';
  return status === 'active' ? '停用' : '启用';
}

export default function MemberList({
  members,
  loading,
  operation,
  onStatusChange,
  onResetPassword,
}) {
  if (loading) {
    return (
      <div aria-label="正在加载成员" className="space-y-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="成员列表">
      {members.map((member) => {
        const isViewer = member.role === 'viewer';
        const changingStatus = operation === `status-${member.id}`;
        const resettingPassword = operation === `reset-${member.id}`;
        return (
          <li
            key={member.id}
            data-member-row={member.username}
            className="grid min-w-0 gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(80px,.55fr)_minmax(80px,.55fr)_minmax(140px,.9fr)_auto] md:items-center"
          >
            <div className="min-w-0">
              <span className="block text-xs text-muted-foreground md:hidden">用户名</span>
              <span className="block truncate text-sm font-medium text-foreground" title={member.username}>
                {member.username}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground md:hidden">角色</span>
              <span className="text-[13px] text-foreground">
                {member.role === 'admin' ? '管理员' : '只读成员'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground md:hidden">状态</span>
              <span className="text-[13px] text-foreground">
                {member.status === 'active' ? '已启用' : '已停用'}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground md:hidden">最近登录</span>
              <span className="text-[13px] text-muted-foreground">
                {formatLastLogin(member.lastLoginAt)}
              </span>
            </div>
            {isViewer && (
              <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                <button
                  type="button"
                  aria-label={`${member.status === 'active' ? '停用' : '启用'} ${member.username}`}
                  disabled={Boolean(operation)}
                  onClick={() => onStatusChange(member)}
                  className="btn btn-default px-3"
                >
                  {member.status === 'active' ? <UserMinus size={14} /> : <Power size={14} />}
                  {getStatusActionLabel(member.status, changingStatus)}
                </button>
                <button
                  type="button"
                  aria-label={`重置 ${member.username} 的密码`}
                  disabled={Boolean(operation)}
                  onClick={() => onResetPassword(member)}
                  className="btn btn-default px-3"
                >
                  <Key size={14} />
                  {resettingPassword ? '重置中...' : '重置密码'}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
