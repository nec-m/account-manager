import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Archive,
  ArrowSquareOut,
  Check,
  Copy,
  DeviceMobile,
  Eye,
  EyeSlash,
  Trash,
} from '@phosphor-icons/react';

import TotpCountdown from './TotpCountdown';
import { getSecretDisplayValue, isInvalid } from '@/lib/utils';

function getStatusBadge(dateString) {
  if (!dateString) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">永久</span>;

  const date = new Date(dateString);
  const msDiff = date.getTime() - new Date().getTime();
  if (msDiff < 3 * 24 * 60 * 60 * 1000) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800">即将过期</span>;

  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">使用中</span>;
}

function getDaysLeft(dateString) {
  if (!dateString) return '永久有效';

  const date = new Date(dateString);
  return formatDistanceToNow(date, { locale: zhCN }) + '后';
}

function getEmailActionTitle(account, compact = false) {
  if (!account.emailUrl) {
    return compact ? '提取邮箱码' : '提取邮箱验证码';
  }
  if (account.emailKey) {
    return '自动复制凭证并在新窗口打开邮箱网页';
  }
  return compact ? '在新窗口打开邮箱网页' : '在新窗口打开邮箱验证网页';
}

function getTwoFactorActionTitle(account, compact = false) {
  if (account.twoFaKey) {
    return compact ? '生成并复制 2FA 码' : '生成并复制 2FA 动态验证码';
  }
  if (account.twoFaUrl) {
    return compact ? '在新窗口打开 2FA 网页' : '在新窗口打开 2FA 验证网页';
  }
  return '获取 2FA 码';
}

export default function AccountCollection({ state, actions }) {
  const {
    accounts: filteredAccounts,
    phones,
    viewMode,
    selectedIds,
    isAdmin,
    copiedId,
    showPasswordId,
    codeResult,
    fetchingCodeFor,
  } = state;
  const {
    toggleSelect: handleToggleSelect,
    toggleSelectAll: handleToggleSelectAll,
    viewAccount: openViewDetail,
    openPhoneBinding: openBindPhone,
    archiveAccount: markArchived,
    deleteAccount: handleDelete,
    copyValue: copyToClipboard,
    togglePassword,
    checkEmail: handleCheckEmail,
    checkTwoFactor: handleCheck2Fa,
    checkSms: handleCheckSms,
    dismissCodeResult,
    refreshTwoFactor,
  } = actions;
  return (
    <>
      {/* 卡片 View (Grid View) */}
      {viewMode === 'grid' && (
        <div data-testid="accounts-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredAccounts.map(acc => {
            const boundPhone = phones.find(p => p.boundAccountId === acc.id);
            const isSelected = selectedIds.includes(acc.id);

            return (
              <div key={acc.id} className={`group bg-panel border rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-foreground ring-1 ring-foreground/20 bg-muted/40' : 'border-border'}`}>
                <div>
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-border gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(acc.id);
                          }}
                          className={`w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer shrink-0 transition-opacity duration-200 ${
                            isSelected || selectedIds.length > 0
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                          }`}
                        />
                      )}
                      <h3 className="font-semibold text-sm min-w-0">
                        <button
                          type="button"
                          aria-label={`通过站点标题查看 ${acc.site} 详情`}
                          aria-haspopup="dialog"
                          className="block max-w-full truncate rounded-sm text-left cursor-pointer hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          title={`点击查看详情：${acc.site}`}
                          onClick={() => openViewDetail(acc)}
                        >
                          {acc.site}
                        </button>
                      </h3>
                      <div className="shrink-0 flex items-center">
                        {getStatusBadge(acc.expireDate)}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors" title={boundPhone ? '管理绑定手机' : '绑定手机'} onClick={() => openBindPhone(acc.id)}>
                          <DeviceMobile size={16} weight={boundPhone ? "fill" : "regular"} className={boundPhone ? 'text-amber-600' : ''} />
                        </button>
                        <button className="text-muted-foreground hover:text-amber-600 p-1 rounded hover:bg-amber-50 transition-colors" title="停用" onClick={() => markArchived(acc.id)}><Archive size={16} /></button>
                        <button className="text-muted-foreground hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors" title="删除" onClick={() => handleDelete(acc.id)}><Trash size={16} /></button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">账号</span>
                      <div className="font-mono bg-muted/60 px-2 py-1 rounded border border-border flex items-center justify-between group">
                        <span className="truncate break-all">{acc.username || '-'}</span>
                        {acc.username && (
                          <button
                            onClick={() => copyToClipboard(acc.username, acc.id + '-usr')}
                            aria-label="复制账号"
                            title="复制账号"
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-foreground text-muted-foreground transition-opacity"
                          >
                            {copiedId === acc.id + '-usr' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground shrink-0">密码</span>
                      <div className="font-mono bg-muted/60 px-2 py-0.5 rounded border border-border flex items-center gap-1.5">
                        <span>{getSecretDisplayValue(acc.password, showPasswordId === acc.id)}</span>
                        {acc.password && (
                          <>
                            <button onClick={() => togglePassword(acc.id)} className="text-muted-foreground hover:text-foreground" title={showPasswordId === acc.id ? "隐藏密码" : "显示密码"}>
                              {showPasswordId === acc.id ? <EyeSlash size={12} /> : <Eye size={12} />}
                            </button>
                            <button onClick={() => copyToClipboard(acc.password, acc.id + '-pwd')} className="text-muted-foreground hover:text-foreground" title="复制密码">
                              {copiedId === acc.id + '-pwd' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-muted-foreground shrink-0">绑定手机号</span>
                      {boundPhone ? (
                        <div className={`font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 min-w-0 max-w-[175px] ${
                          isInvalid(boundPhone)
                            ? 'bg-rose-50/80 text-rose-600 border-rose-200/80 font-semibold'
                            : 'bg-muted/60 border-border'
                        }`}>
                          <span className="truncate flex items-center gap-1">
                            <span>{boundPhone.number}</span>
                            {isInvalid(boundPhone) && <span className="font-sans font-normal text-[11px] text-rose-600">(已到期)</span>}
                          </span>
                          <button onClick={() => copyToClipboard(boundPhone.number, acc.id + '-phone')} className="text-muted-foreground hover:text-foreground shrink-0" title="复制手机号">
                            {copiedId === acc.id + '-phone' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="font-sans text-[11px] bg-muted/60 px-2 py-0.5 rounded border border-border text-muted-foreground">无</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground shrink-0">剩余时间</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{getDaysLeft(acc.expireDate)}</span>
                    </div>

                    {acc.note && (
                      <div className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border/50 truncate" title={acc.note}>
                        📝 {acc.note}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 mt-4 pt-2 border-t border-border">
                  <button
                    type="button"
                    className="btn btn-default flex-1 text-[11px] py-1 px-1.5 flex items-center justify-center gap-1 active:scale-95 transition-all"
                    aria-label={`查看 ${acc.site} 详情`}
                    aria-haspopup="dialog"
                    onClick={() => openViewDetail(acc)}
                  >
                    <Eye size={12} className="shrink-0" />
                    <span>详情</span>
                  </button>
                  <button
                    className="btn btn-default flex-1 text-[11px] py-1 px-1.5 flex items-center justify-center gap-1 active:scale-95 transition-all"
                    disabled={!(acc.emailKey || acc.emailUrl) || fetchingCodeFor === acc.id + '-email'}
                    title={getEmailActionTitle(acc)}
                    onClick={() => handleCheckEmail(acc)}
                  >
                    <span>{fetchingCodeFor === acc.id + '-email' ? '获取中...' : '查邮箱'}</span>
                    {acc.emailUrl && <ArrowSquareOut size={12} className="text-muted-foreground shrink-0" />}
                  </button>
                  <button
                    className="btn btn-default flex-1 text-[11px] py-1 px-1.5 flex items-center justify-center gap-1 active:scale-95 transition-all"
                    disabled={!(acc.twoFaKey || acc.twoFaUrl) || fetchingCodeFor === acc.id + '-2fa'}
                    title={getTwoFactorActionTitle(acc)}
                    onClick={() => handleCheck2Fa(acc)}
                  >
                    <span>{fetchingCodeFor === acc.id + '-2fa' ? '获取中...' : '查2FA'}</span>
                    {(!acc.twoFaKey && acc.twoFaUrl) && <ArrowSquareOut size={12} className="text-muted-foreground shrink-0" />}
                  </button>
                  <button
                    className="btn btn-default flex-1 text-[11px] py-1 px-1.5 flex items-center justify-center gap-1 active:scale-95 transition-all"
                    disabled={!boundPhone || fetchingCodeFor === acc.id + '-sms'}
                    title={boundPhone?.smsUrl ? "复制凭证/手机号并在新窗口打开接码网站" : "提取短信验证码"}
                    onClick={() => handleCheckSms(acc, boundPhone)}
                  >
                    <span>{fetchingCodeFor === acc.id + '-sms' ? '获取中...' : '查短信'}</span>
                    {boundPhone?.smsUrl && <ArrowSquareOut size={12} className="text-muted-foreground shrink-0" />}
                  </button>
                </div>

                {codeResult && codeResult.id.startsWith(acc.id + '-') && (
                  codeResult.type === 'notice' ? (
                    <div className="code-display mt-3 p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-lg flex items-center justify-between gap-2 relative transition-all shadow-2xs text-xs">
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
                          onClick={() => copyToClipboard(codeResult.rawText, codeResult.id)}
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
                    <div className="code-display mt-3 p-3 bg-muted/40 border border-border/80 rounded-lg flex flex-col items-center justify-center relative transition-all shadow-2xs">
                      <button
                        onClick={() => dismissCodeResult()}
                        className="absolute top-1.5 right-2 text-muted-foreground hover:text-foreground text-xs p-1 rounded hover:bg-muted/80 transition-colors"
                        title="关闭"
                      >✕</button>
                      <div
                        onClick={() => copyToClipboard(codeResult.code, codeResult.id)}
                        className="group flex items-center justify-center gap-2 cursor-pointer py-1 px-3 rounded-md hover:bg-muted/80 active:scale-95 transition-all select-none border border-transparent hover:border-border/60 my-0.5"
                        title="点击复制验证码"
                      >
                        <span className="font-mono font-bold text-xl tracking-wider text-foreground">{codeResult.code}</span>
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
                      {codeResult.expires && (
                        <TotpCountdown
                          expires={codeResult.expires}
                          onRefresh={codeResult.twoFaKey ? () => refreshTwoFactor(codeResult) : null}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 表格 View (Table View) - 高密度高效视图 */}
      {viewMode === 'table' && (
        <div data-testid="accounts-table" className="bg-panel border border-border rounded-xl shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground font-medium">
                {isAdmin && (
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={filteredAccounts.length > 0 && selectedIds.length === filteredAccounts.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-2.5 px-3">站点</th>
                <th className="py-2.5 px-3">账号</th>
                <th className="py-2.5 px-3">密码</th>
                <th className="py-2.5 px-3">绑定手机</th>
                <th className="py-2.5 px-3">有效期</th>
                <th className="py-2.5 px-3">备注</th>
                <th className="py-2.5 px-3 text-center">快捷验证码</th>
                <th className="py-2.5 px-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAccounts.map(acc => {
                const boundPhone = phones.find(p => p.boundAccountId === acc.id);
                const isSelected = selectedIds.includes(acc.id);
                return (
                  <tr key={acc.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-muted/40' : ''}`}>
                    {isAdmin && (
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(acc.id)}
                          className="w-4 h-4 rounded border-border text-foreground accent-foreground cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {acc.site}
                        {getStatusBadge(acc.expireDate)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="flex items-center gap-1.5 max-w-[200px] truncate">
                        <span className="truncate">{acc.username || '-'}</span>
                        {acc.username && (
                          <button onClick={() => copyToClipboard(acc.username, acc.id + '-usr-tbl')} className="text-muted-foreground hover:text-foreground shrink-0" title="复制账号">
                            {copiedId === acc.id + '-usr-tbl' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span>{getSecretDisplayValue(acc.password, showPasswordId === acc.id)}</span>
                        {acc.password && (
                          <>
                            <button onClick={() => togglePassword(acc.id)} className="text-muted-foreground hover:text-foreground" title={showPasswordId === acc.id ? "隐藏密码" : "显示密码"}>
                              {showPasswordId === acc.id ? <EyeSlash size={12} /> : <Eye size={12} />}
                            </button>
                            <button onClick={() => copyToClipboard(acc.password, acc.id + '-pwd-tbl')} className="text-muted-foreground hover:text-foreground" title="复制密码">
                              {copiedId === acc.id + '-pwd-tbl' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {boundPhone ? (
                        <div className="flex items-center gap-1.5">
                          {isInvalid(boundPhone) ? (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold inline-flex items-center gap-1" title="关联的手机号已过期失效">
                              <span>{boundPhone.number}</span>
                              <span className="font-sans font-normal text-xs">(已到期)</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {boundPhone.number}
                            </span>
                          )}
                          <button onClick={() => copyToClipboard(boundPhone.number, acc.id + '-phone-tbl')} className="text-muted-foreground hover:text-foreground" title="复制手机号">
                            {copiedId === acc.id + '-phone-tbl' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">未绑定</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap text-muted-foreground">
                      {getDaysLeft(acc.expireDate)}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground max-w-[150px] truncate" title={acc.note}>
                      {acc.note || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="btn btn-default text-[10px] py-0.5 px-2 flex items-center gap-0.5 active:scale-95 transition-all"
                          disabled={!(acc.emailKey || acc.emailUrl)}
                          title={getEmailActionTitle(acc, true)}
                          onClick={() => handleCheckEmail(acc)}
                        >
                          <span>邮箱</span>
                          {acc.emailUrl && <ArrowSquareOut size={10} className="text-muted-foreground shrink-0" />}
                        </button>
                        <button
                          className="btn btn-default text-[10px] py-0.5 px-2 flex items-center gap-0.5 active:scale-95 transition-all"
                          disabled={!(acc.twoFaKey || acc.twoFaUrl)}
                          title={getTwoFactorActionTitle(acc, true)}
                          onClick={() => handleCheck2Fa(acc)}
                        >
                          <span>2FA</span>
                          {(!acc.twoFaKey && acc.twoFaUrl) && <ArrowSquareOut size={10} className="text-muted-foreground shrink-0" />}
                        </button>
                        <button
                          className="btn btn-default text-[10px] py-0.5 px-2 flex items-center gap-0.5 active:scale-95 transition-all"
                          disabled={!boundPhone}
                          title={boundPhone?.smsUrl ? "复制凭证/手机号并在新窗口打开接码平台" : "提取短信码"}
                          onClick={() => handleCheckSms(acc, boundPhone)}
                        >
                          <span>短信</span>
                          {boundPhone?.smsUrl && <ArrowSquareOut size={10} className="text-muted-foreground shrink-0" />}
                        </button>
                      </div>
                      {codeResult && codeResult.id.startsWith(acc.id + '-') && (
                        codeResult.type === 'notice' ? (
                          <div className="mt-1.5 p-1.5 bg-blue-50/60 border border-blue-200/80 rounded flex items-center justify-between gap-1 text-[11px] shadow-2xs">
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              <Check size={12} className="text-emerald-600 shrink-0" />
                              <span className="font-mono font-medium text-foreground truncate" title={codeResult.rawText}>{codeResult.rawText}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => copyToClipboard(codeResult.rawText, codeResult.id)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/80 hover:bg-muted font-medium transition-colors"
                              >
                                {copiedId === codeResult.id ? '已复制' : '复制'}
                              </button>
                              <button onClick={() => dismissCodeResult()} className="text-muted-foreground hover:text-foreground text-[10px] p-0.5">✕</button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1.5 p-1.5 bg-muted/60 border border-border/80 rounded flex flex-col items-center gap-1 text-xs shadow-2xs">
                            <div className="flex items-center justify-between w-full border-b border-border/40 pb-1">
                              <div
                                onClick={() => copyToClipboard(codeResult.code, codeResult.id)}
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
                            {codeResult.expires && (
                              <TotpCountdown
                                expires={codeResult.expires}
                                onRefresh={codeResult.twoFaKey ? () => refreshTwoFactor(codeResult) : null}
                              />
                            )}
                          </div>
                        )
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted" title="查看详情" onClick={() => openViewDetail(acc)}>
                          <Eye size={15} />
                        </button>
                        {isAdmin && (
                          <>
                            <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted" title={boundPhone ? '管理绑定手机' : '绑定手机'} onClick={() => openBindPhone(acc.id)}>
                              <DeviceMobile size={15} weight={boundPhone ? "fill" : "regular"} className={boundPhone ? 'text-amber-600' : ''} />
                            </button>
                            <button className="text-muted-foreground hover:text-amber-600 p-1 rounded hover:bg-amber-50" title="停用" onClick={() => markArchived(acc.id)}><Archive size={15} /></button>
                            <button className="text-muted-foreground hover:text-rose-600 p-1 rounded hover:bg-rose-50" title="删除" onClick={() => handleDelete(acc.id)}><Trash size={15} /></button>
                          </>
                        )}
                      </div>
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
