'use client';

import { Archive, ArrowCounterClockwise, Eye, Trash } from '@phosphor-icons/react';
import EmptyState from '../../_components/EmptyState';

export default function InvalidAccountsSection({
  accounts,
  phones,
  selectedIds,
  isAdmin,
  onToggle,
  onToggleAll,
  onBatchRestore,
  onBatchDelete,
  onOpenDetail,
  onRestore,
  onDelete,
}) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-foreground">失效账号 ({accounts.length})</h2>
          {isAdmin && accounts.length > 0 && (
            <button
              onClick={onToggleAll}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-panel hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
            >
              <input
                type="checkbox"
                checked={selectedIds.length === accounts.length && accounts.length > 0}
                onChange={() => {}}
                className="w-3.5 h-3.5 rounded accent-foreground pointer-events-none"
              />
              <span>{selectedIds.length === accounts.length ? '取消全选' : '全选账号'}</span>
            </button>
          )}
        </div>
      </div>

      {isAdmin && selectedIds.length > 0 && (
        <div className="mb-6 p-3 bg-foreground text-background rounded-xl flex items-center justify-between shadow-lg animate-fade-in">
          <span className="text-xs font-semibold">已选择 {selectedIds.length} 个失效账号</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onBatchRestore}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shadow-2xs"
            >
              <ArrowCounterClockwise size={14} />
              <span>批量重新激活 ({selectedIds.length})</span>
            </button>
            <button
              onClick={onBatchDelete}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shadow-2xs"
            >
              <Trash size={14} />
              <span>批量彻底删除 ({selectedIds.length})</span>
            </button>
            <button
              onClick={() => selectedIds.forEach(onToggle)}
              className="px-2.5 py-1.5 text-background/80 hover:text-background text-xs font-medium"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => {
          const boundPhone = phones.find((phone) => phone.boundAccountId === account.id);
          const fullAccount = { ...account, phone: boundPhone ? boundPhone.number : '' };
          const isSelected = selectedIds.includes(account.id);

          return (
            <div key={account.id} className={`bg-panel border rounded-xl p-6 hover:bg-muted/40 transition-colors duration-300 animate-fade-up relative group opacity-90 ${isSelected ? 'border-foreground ring-1 ring-foreground/20 bg-muted/40' : 'border-border'}`}>
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        event.stopPropagation();
                        onToggle(account.id);
                      }}
                      className={`w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer shrink-0 transition-opacity duration-200 ${
                        isSelected || selectedIds.length > 0
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                      }`}
                    />
                  )}
                  <h3
                    className="font-medium text-lg cursor-pointer hover:text-primary transition-colors text-foreground truncate"
                    title="点击查看只读完整详情"
                    onClick={() => onOpenDetail(fullAccount)}
                  >
                    <span>{account.site}</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenDetail(fullAccount)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1 text-xs"
                    title="查看完整只读详情"
                  >
                    <Eye size={18} />
                  </button>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest whitespace-nowrap shrink-0 text-danger bg-rose-50 border border-rose-100">
                    {account.status === 'archived' ? '手动停用' : '已过期'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mb-3 text-[13px]">
                <span className="text-muted-foreground">账号</span>
                <span className="font-mono text-[11px] text-foreground bg-muted/60 px-2 py-1 rounded border border-border break-all">{account.username || '-'}</span>
              </div>
              <div className="flex justify-between items-center mb-3 text-[13px]">
                <span className="text-muted-foreground">设置的过期日</span>
                <span className="font-mono text-[11px] text-foreground bg-muted/60 px-2 py-1 rounded border border-border">{account.expireDate || '无'}</span>
              </div>
              {account.note && (
                <div className="flex justify-between items-center mb-3 text-[13px]" title={account.note}>
                  <span className="text-muted-foreground">备注</span>
                  <span className="font-sans text-[11px] text-foreground bg-muted/60 px-2 py-1 rounded border border-border truncate max-w-[200px]">{account.note}</span>
                </div>
              )}
              {isAdmin ? (
                <div className="flex items-center gap-1 mt-6">
                  <button className="text-muted-foreground hover:text-foreground transition-colors p-2 text-sm rounded hover:bg-muted flex-1" onClick={() => onRestore(account.id)}>重新激活</button>
                  <button className="text-muted-foreground hover:text-danger transition-colors p-2 text-sm rounded hover:bg-rose-50 flex-1" onClick={() => onDelete(account.id)}>彻底删除</button>
                </div>
              ) : (
                <div className="mt-6 text-xs text-muted-foreground font-mono text-center">只读视角</div>
              )}
            </div>
          );
        })}
        {accounts.length === 0 && (
          <EmptyState
            icon={<Archive size={20} />}
            title="没有失效账号"
            description="停用或过期的账号会集中显示在这里。"
            compact
          />
        )}
      </div>
    </div>
  );
}
