"use client";

import {
  PencilSimple,
  Archive,
  Trash,
  Copy,
  Check,
  DeviceMobile,
  Eye,
} from '@phosphor-icons/react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { isInvalid } from '@/lib/utils';
import AccountSelectDropdown from '../bindings/AccountSelectDropdown';

export default function PhoneCollection({ state, actions }) {
  const {
    phones,
    accounts,
    viewMode,
    selectedIds,
    isAdmin,
    copiedId,
    codeResult,
    fetchingCodeFor,
  } = state;
  const {
    toggleSelect,
    toggleSelectAll,
    editPhone,
    viewAccount,
    openHistory,
    getHistoryCount,
    extractPhone,
    copyValue,
    fetchCode,
    bindPhone,
    unbindPhone,
    archivePhone,
    deletePhone,
    dismissCodeResult,
  } = actions;

  const getStatusBadge = (phone) => {
    if (!phone.number || phone.status === 'pending') {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest whitespace-nowrap shrink-0 text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A]">待提取</span>;
    }
    if (phone.boundAccountId) return <span className="inline-flex items-center px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest whitespace-nowrap shrink-0 text-[#956400] bg-[#FBF3DB]">使用中</span>;
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest whitespace-nowrap shrink-0 text-[#1F6C9F] bg-[#E1F3FE]">空闲</span>;
  };

  const getDaysLeft = (dateString) => {
    if (!dateString) return '永久有效';
    const date = new Date(dateString);
    return formatDistanceToNow(date, { locale: zhCN }) + '后';
  };

  return (
    <>
      {viewMode === 'grid' && (
        <div data-testid="phones-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {phones.map(phone => {
            const boundAcc = accounts.find(a => a.id === phone.boundAccountId);
            const historyCount = getHistoryCount(phone);
            const isSelected = selectedIds.includes(phone.id);

            return (
              <div key={phone.id} className={`group bg-panel border rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-foreground ring-1 ring-foreground/20 bg-muted/40' : 'border-border'}`}>
                <div>
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(phone.id);
                          }}
                          className={`w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer shrink-0 transition-opacity duration-200 ${
                            isSelected || selectedIds.length > 0
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                          }`}
                        />
                      )}
                      <span className="font-semibold text-xs text-muted-foreground flex items-center gap-1">
                        <DeviceMobile size={14} className="text-amber-600" /> 手机卡片
                      </span>
                      {getStatusBadge(phone)}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted" title="详情/编辑" onClick={() => editPhone(phone)}><PencilSimple size={16} /></button>
                        <button className="text-muted-foreground hover:text-amber-600 p-1 rounded hover:bg-amber-50" title="停用" onClick={() => archivePhone(phone.id)}><Archive size={16} /></button>
                        <button className="text-muted-foreground hover:text-rose-600 p-1 rounded hover:bg-rose-50" title="删除" onClick={() => deletePhone(phone.id)}><Trash size={16} /></button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground font-medium">手机号码</span>
                      <div className="font-mono bg-muted/60 px-2.5 py-1 rounded border border-border flex items-center justify-between group">
                        {phone.number ? (
                          <>
                            <span className="font-semibold text-sm text-foreground truncate" title={phone.number}>{phone.number}</span>
                            <button
                              onClick={() => copyValue(phone.number, phone.id + '-num-card')}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-foreground text-muted-foreground transition-opacity"
                              title="复制手机号"
                            >
                              {copiedId === phone.id + '-num-card' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => extractPhone(phone)}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 w-full justify-between hover:underline"
                            title="点击去接码页面填写卡密并提取手机号"
                          >
                            <span className="truncate">🔑 {phone.smsKey ? `卡密: ${phone.smsKey}` : '[待提取手机号]'}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300/80 shrink-0">去提取</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground shrink-0">获取配置</span>
                      <span className="font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded border border-border">{phone.smsKey || phone.smsUrl ? '已配置' : '未配置'}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-muted-foreground shrink-0">绑定账号</span>
                      {boundAcc ? (
                        <button
                          onClick={() => viewAccount(boundAcc, phone)}
                          className="font-mono text-[11px] bg-muted/60 hover:bg-muted text-foreground px-2 py-0.5 rounded border border-border truncate max-w-[180px] hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1.5 group/acc"
                          title="点击查看关联账号只读详情"
                        >
                          <span className="truncate">{boundAcc.username || boundAcc.site}</span>
                          <Eye size={12} className="text-muted-foreground group-hover/acc:text-primary shrink-0" />
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded border border-border text-muted-foreground">未绑定</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-muted-foreground shrink-0">历史账号</span>
                      <button
                        type="button"
                        disabled={historyCount === 0}
                        aria-label={`查看 ${phone.number || '待提取手机号'} 的 ${historyCount} 个历史关联账号`}
                        onClick={() => openHistory(phone)}
                        className="font-mono text-[11px] rounded border border-border px-2 py-0.5 transition-colors enabled:bg-muted/60 enabled:text-foreground enabled:hover:border-primary/40 enabled:hover:text-primary disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground"
                      >
                        {historyCount} 个
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground shrink-0">剩余时间</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{getDaysLeft(phone.expireDate)}</span>
                    </div>

                    {phone.note && (
                      <div className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50 truncate" title={phone.note}>
                        📝 {phone.note}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-border flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {phone.boundAccountId ? (
                      <button className="btn btn-danger text-[11px] py-1 px-2 flex-1" onClick={() => unbindPhone(phone.id)}>解绑</button>
                    ) : (
                      <AccountSelectDropdown
                        accounts={accounts.filter(a => !isInvalid(a))}
                        onSelect={(accId) => bindPhone(phone.id, accId)}
                        placeholder="选择绑定账号..."
                      />
                    )}
                    {!phone.number ? (
                      <button
                        className="btn bg-amber-600 hover:bg-amber-700 text-white text-[11px] py-1 px-2.5 whitespace-nowrap flex-1"
                        onClick={() => extractPhone(phone)}
                        title="前往接码页面填写卡密并快捷录入手机号"
                      >
                        🔑 提取手机号
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary text-[11px] py-1 px-2.5 whitespace-nowrap"
                        disabled={fetchingCodeFor === phone.id || (!phone.smsUrl && !phone.smsKey)}
                        onClick={() => fetchCode(phone)}
                      >
                        {fetchingCodeFor === phone.id ? '获取中...' : '查短信'}
                      </button>
                    )}
                  </div>

                  {codeResult && codeResult.id === phone.id && (
                    codeResult.type === 'notice' ? (
                      <div className="mt-3 p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-lg flex items-center justify-between gap-2 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {codeResult.copySucceeded
                            ? <Check size={15} className="text-emerald-600 shrink-0" />
                            : <Copy size={15} className="text-amber-600 shrink-0" />}
                          <div className="text-foreground/90 truncate">
                            <span>{codeResult.copySucceeded ? '已自动复制凭证：' : '自动复制失败，请手动复制：'}</span>
                            <span className="font-mono font-semibold bg-background/80 px-1.5 py-0.5 rounded border border-border/60 text-foreground select-all">{codeResult.rawText}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => copyValue(codeResult.rawText, codeResult.id)}
                            className="text-[11px] px-2 py-0.5 rounded bg-background border border-border/80 hover:bg-muted font-medium transition-colors flex items-center gap-1 shadow-2xs"
                            title="复制凭证"
                          >
                            {copiedId === codeResult.id ? (
                              <span className="text-emerald-600 flex items-center gap-0.5"><Check size={12}/> 已复制</span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground"><Copy size={12}/> 复制凭证</span>
                            )}
                          </button>
                          <button
                            onClick={() => dismissCodeResult()}
                            className="text-muted-foreground hover:text-foreground text-xs p-1 rounded hover:bg-muted/80 transition-colors"
                            title="关闭"
                          >✕</button>
                        </div>
                      </div>
                    ) : (
                      <div className="code-display mt-3 p-2.5 bg-muted/40 border border-border/80 rounded-lg flex items-center justify-between gap-2 text-xs shadow-2xs">
                        <div
                          onClick={() => copyValue(codeResult.code, codeResult.id)}
                          className="group flex items-center gap-2 cursor-pointer py-1 px-3 rounded-md hover:bg-muted/80 active:scale-95 transition-all select-none border border-transparent hover:border-border/60 flex-1 justify-center"
                          title="点击复制验证码"
                        >
                          <span className="font-mono font-bold text-lg tracking-wider text-foreground">{codeResult.code}</span>
                          {copiedId === codeResult.id ? (
                            <span className="text-xs text-emerald-600 font-normal flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Check size={14} weight="bold" /> 已复制
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground group-hover:text-foreground flex items-center gap-1 bg-background border border-border/60 px-2 py-0.5 rounded shadow-2xs transition-colors">
                              <Copy size={13} /> 点击复制
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => dismissCodeResult()}
                          className="text-muted-foreground hover:text-foreground text-xs p-1 rounded hover:bg-muted/80 transition-colors"
                          title="关闭"
                        >✕</button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 表格 View (Table View) */}
      {viewMode === 'table' && (
        <div data-testid="phones-table" className="bg-panel border border-border rounded-xl shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground font-medium">
                {isAdmin && (
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={phones.length > 0 && selectedIds.length === phones.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-2.5 px-3">手机号码</th>
                <th className="py-2.5 px-3">状态</th>
                <th className="py-2.5 px-3">接码配置</th>
                <th className="py-2.5 px-3">绑定账号</th>
                <th className="py-2.5 px-3">有效期</th>
                <th className="py-2.5 px-3">备注</th>
                <th className="py-2.5 px-3 text-center">查收短信</th>
                <th className="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {phones.map(phone => {
                const boundAcc = accounts.find(a => a.id === phone.boundAccountId);
                const historyCount = getHistoryCount(phone);
                const isSelected = selectedIds.includes(phone.id);
                return (
                  <tr key={phone.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-muted/40' : ''}`}>
                    {isAdmin && (
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(phone.id)}
                          className="w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-mono font-semibold text-foreground whitespace-nowrap">
                      {phone.number ? (
                        <div className="flex items-center gap-1.5">
                          {phone.number}
                          <button onClick={() => copyValue(phone.number, phone.id + '-num')} className="text-muted-foreground hover:text-foreground" title="复制号码">
                            {copiedId === phone.id + '-num' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => extractPhone(phone)}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline"
                          title="点击去接码页面填写卡密并提取手机号"
                        >
                          <span>🔑 {phone.smsKey ? `卡密: ${phone.smsKey}` : '[待提取手机号]'}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300/80">去提取</span>
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getStatusBadge(phone)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {phone.smsKey || phone.smsUrl ? '已配置' : '未配置'}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {boundAcc ? (
                        <button
                          onClick={() => viewAccount(boundAcc, phone)}
                          className="text-foreground hover:text-primary flex items-center gap-1.5 transition-colors group/tb text-xs"
                          title="点击查看关联账号只读详情"
                        >
                          <span>{boundAcc.username || boundAcc.site}</span>
                          <Eye size={13} className="text-muted-foreground group-hover/tb:text-primary shrink-0" />
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-medium text-xs">闲置可用</span>
                      )}
                      <button
                        type="button"
                        disabled={historyCount === 0}
                        aria-label={`查看 ${phone.number || '待提取手机号'} 的 ${historyCount} 个历史关联账号`}
                        onClick={() => openHistory(phone)}
                        className="mt-1 block text-[11px] font-mono transition-colors enabled:text-muted-foreground enabled:hover:text-primary disabled:cursor-not-allowed disabled:text-muted-foreground/60"
                      >
                        历史账号：{historyCount} 个
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                      {getDaysLeft(phone.expireDate)}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-[150px] truncate" title={phone.note}>
                      {phone.note || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {!phone.number ? (
                        <button
                          className="btn bg-amber-600 hover:bg-amber-700 text-white text-[10px] py-0.5 px-2.5 whitespace-nowrap"
                          onClick={() => extractPhone(phone)}
                        >
                          🔑 提取手机号
                        </button>
                      ) : (
                        <button
                          className="btn btn-default text-[10px] py-0.5 px-2.5"
                          disabled={fetchingCodeFor === phone.id || (!phone.smsUrl && !phone.smsKey)}
                          onClick={() => fetchCode(phone)}
                        >
                          {fetchingCodeFor === phone.id ? '获取中...' : '查收短信'}
                        </button>
                      )}
                      {codeResult && codeResult.id === phone.id && (
                        codeResult.type === 'notice' ? (
                          <div className="mt-1.5 p-1.5 bg-blue-50/60 border border-blue-200/80 rounded flex items-center justify-between gap-1 text-[11px] shadow-2xs">
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              <Check size={12} className="text-emerald-600 shrink-0" />
                              <span className="font-mono font-medium text-foreground truncate" title={codeResult.rawText}>{codeResult.rawText}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => copyValue(codeResult.rawText, codeResult.id)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/80 hover:bg-muted font-medium transition-colors"
                              >
                                {copiedId === codeResult.id ? '已复制' : '复制'}
                              </button>
                              <button onClick={() => dismissCodeResult()} className="text-muted-foreground hover:text-foreground text-[10px] p-0.5">✕</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1.5 p-1.5 bg-muted/60 border border-border/80 rounded flex items-center justify-between gap-1 text-xs shadow-2xs">
                            <div
                              onClick={() => copyValue(codeResult.code, codeResult.id)}
                              className="font-mono font-bold text-sm text-foreground flex items-center gap-1.5 cursor-pointer hover:opacity-80 select-none"
                              title="点击复制"
                            >
                              <span>{codeResult.code}</span>
                              {copiedId === codeResult.id ? (
                                <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-0.5"><Check size={11} weight="bold" />已复制</span>
                              ) : (
                                <Copy size={11} className="text-muted-foreground" />
                              )}
                            </div>
                            <button onClick={() => dismissCodeResult()} className="text-muted-foreground hover:text-foreground text-[10px] p-0.5">✕</button>
                          </div>
                        )
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1">
                          <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted" title="编辑" onClick={() => editPhone(phone)}><PencilSimple size={15} /></button>
                          <button className="text-muted-foreground hover:text-amber-600 p-1 rounded hover:bg-amber-50" title="停用" onClick={() => archivePhone(phone.id)}><Archive size={15} /></button>
                          <button className="text-muted-foreground hover:text-rose-600 p-1 rounded hover:bg-rose-50" title="删除" onClick={() => deletePhone(phone.id)}><Trash size={15} /></button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">只读</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
