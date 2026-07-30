import {
  Archive,
  DeviceMobile,
  List,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  SquaresFour,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';

export default function AccountsHeader({ counts, search, view, selection, onAddAccount }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-border/80 transition-colors">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>有效账号</span>
            <ShieldCheck size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 text-foreground flex items-baseline gap-1">
            <span>{counts.validAccounts}</span>
            <span className="text-xs font-sans font-normal text-muted-foreground">个</span>
          </div>
        </div>

        <div className="bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-border/80 transition-colors">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>即将/已到期</span>
            <WarningCircle size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 text-amber-600 flex items-baseline gap-1">
            <span>{counts.expiringAccounts}</span>
            <span className="text-xs font-sans font-normal text-muted-foreground">个预警</span>
          </div>
        </div>

        <div className="bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-border/80 transition-colors">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>有效手机绑定</span>
            <DeviceMobile size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 text-foreground flex items-baseline gap-1 flex-wrap">
            <span>{counts.validPhoneBindings}</span>
            <span className="text-xs font-sans font-normal text-muted-foreground">/ {counts.validAccounts}</span>
            {counts.expiredPhoneBindings > 0 && (
              <span
                className="text-[11px] font-sans font-medium text-rose-600 ml-1 px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200/80 inline-flex items-center"
                title={`${counts.expiredPhoneBindings}个账号绑定的手机号已到期`}
              >
                {counts.expiredPhoneBindings}个已到期
              </span>
            )}
          </div>
        </div>

        <div className="bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs hover:border-border/80 transition-colors">
          <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            <span>闲置手机号</span>
            <DeviceMobile size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight mt-2 text-emerald-600 flex items-baseline gap-1">
            <span>{counts.idlePhones}</span>
            <span className="text-xs font-sans font-normal text-muted-foreground">个可用</span>
          </div>
        </div>
      </div>

      <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur-md border-b border-border py-3 mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-xs px-1">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索账号 / 站点 / 手机号 / 备注..."
              value={search.query}
              onChange={(event) => search.onChange(event.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-panel border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
            />
            {search.query && (
              <button onClick={search.onClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">✕</button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end shrink-0">
          {selection.isAdmin && selection.filteredCount > 0 && (
            <button
              onClick={selection.onToggleAll}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-panel hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
            >
              <input
                type="checkbox"
                checked={selection.selectedCount === selection.filteredCount && selection.filteredCount > 0}
                onChange={() => {}}
                className="w-3.5 h-3.5 rounded accent-foreground pointer-events-none"
              />
              <span>{selection.selectedCount === selection.filteredCount ? '取消全选' : '全选项'}</span>
            </button>
          )}

          <div className="flex items-center border border-border rounded-lg bg-panel p-0.5">
            <button
              onClick={() => view.onChange('grid')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all ${view.mode === 'grid' ? 'bg-background text-foreground font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              title="卡片网格视图"
            >
              <SquaresFour size={15} />
              <span className="hidden md:inline">卡片</span>
            </button>
            <button
              onClick={() => view.onChange('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all ${view.mode === 'table' ? 'bg-background text-foreground font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              title="紧凑表格视图"
            >
              <List size={15} />
              <span className="hidden md:inline">表格</span>
            </button>
          </div>

          {selection.isAdmin && (
            <button className="btn btn-primary flex items-center gap-1.5 whitespace-nowrap text-sm px-4 py-1.5" onClick={onAddAccount}>
              <Plus size={16} weight="bold" />
              <span>添加新账号</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function AccountsSelectionDock({ selectedCount, filteredCount, onToggleAll, onArchive, onDelete, onClear }) {
  return (
    <div
      data-testid="accounts-selection-dock"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-panel/85 backdrop-blur-2xl border border-border/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-foreground/5 rounded-full px-4 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-center gap-2.5 pr-3 border-r border-border/60">
        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-foreground hover:opacity-80 select-none">
          <input
            type="checkbox"
            checked={filteredCount > 0 && selectedCount === filteredCount}
            onChange={onToggleAll}
            className="w-3.5 h-3.5 rounded border-border text-foreground accent-foreground cursor-pointer"
          />
          <span>{selectedCount === filteredCount ? '已全选' : '全选'}</span>
        </label>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>已选 {selectedCount} 项</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onArchive}
          className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/20 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.96] shadow-2xs"
        >
          <Archive size={14} weight="bold" />
          <span>批量停用 ({selectedCount})</span>
        </button>
        <button
          onClick={onDelete}
          className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-500/20 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.96] shadow-2xs"
        >
          <Trash size={14} weight="bold" />
          <span>批量删除 ({selectedCount})</span>
        </button>
        <button
          onClick={onClear}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all"
          title="取消选择"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
