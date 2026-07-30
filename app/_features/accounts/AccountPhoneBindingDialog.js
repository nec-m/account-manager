"use client";

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowSquareOut,
  X,
} from '@phosphor-icons/react';

import { ensureHttpProtocol, getDefaultExpireDate, isInvalid } from '@/lib/utils';

const PHONE_FIELDS = [
  { id: 'number', label: '手机号' },
  { id: 'smsUrl', label: '接码地址' },
  { id: 'smsKey', label: '接码凭证' },
  { id: 'note', label: '备注' },
  { id: 'ignore', label: '忽略此项' },
];

function getDaysLeft(dateString) {
  if (!dateString) return '永久有效';

  const date = new Date(dateString);
  return formatDistanceToNow(date, { locale: zhCN }) + '后';
}

export default function AccountPhoneBindingDialog({ data, state, setters, actions, dialogA11y }) {
  const {
    accountId: bindAccId,
    mode: bindMode,
    phone: newPhone,
    parseFormat: phoneParseFormat,
    isDialogOpen: isBindPhoneDialogOpen,
    existingSmsUrlTemplates: existingSmsUrls,
  } = state;
  const {
    setMode: setBindMode,
    setPhone: setNewPhone,
    setParseFormat: setPhoneParseFormat,
  } = setters;
  const {
    close: closeBindPhoneDialog,
    save: handleBindPhoneSave,
    bindExisting: handleBindExistingPhone,
    unbind: handleUnbindPhone,
    parseInput: handlePhoneSmartParse,
    getHistoryCount,
    openHistory,
  } = actions;

  const renderPhoneHistoryButton = (phone) => {
    const historyCount = getHistoryCount(phone);

    return (
      <button
        type="button"
        disabled={historyCount === 0}
        onClick={(event) => openHistory(phone, event.currentTarget)}
        aria-label={`查看 ${phone.number || '待提取手机号'} 的 ${historyCount} 个历史关联账号`}
        className="btn btn-default px-3 py-1 text-xs"
      >
        历史关联 {historyCount} 个
      </button>
    );
  };

  return (
    <>
      {bindAccId && (
        <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 items-center justify-center p-4 overflow-y-auto ${isBindPhoneDialogOpen ? 'flex' : 'hidden'}`}>
          <div
            ref={dialogA11y.ref}
            role={isBindPhoneDialogOpen ? dialogA11y.role : undefined}
            aria-modal={isBindPhoneDialogOpen ? dialogA11y['aria-modal'] : undefined}
            aria-labelledby={isBindPhoneDialogOpen ? dialogA11y['aria-labelledby'] : undefined}
            aria-hidden={isBindPhoneDialogOpen ? undefined : 'true'}
            tabIndex={isBindPhoneDialogOpen ? dialogA11y.tabIndex : undefined}
            className={`relative w-full rounded-xl border border-border bg-background p-6 shadow-2xl md:p-8 ${bindMode === 'existing' ? 'max-w-3xl' : 'max-w-xl'}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeBindPhoneDialog}
              aria-label="关闭手机关联弹窗"
              className="absolute right-6 top-6 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="关闭"
            >
              <X size={20} />
            </button>
            <h2 id={isBindPhoneDialogOpen ? dialogA11y.titleId : undefined} className="mb-4 pr-10 text-xl font-semibold tracking-tight text-foreground">关联手机</h2>
            {data.phones.find(p => p.boundAccountId === bindAccId) && (() => {
              const curPhone = data.phones.find(p => p.boundAccountId === bindAccId);
              return (
                <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
                  <div>
                    <div className="text-xs text-muted-foreground">当前绑定</div>
                    <div className="text-lg font-semibold text-foreground">{curPhone.number}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      到期时间：{curPhone.expireDate ? `${curPhone.expireDate} (${getDaysLeft(curPhone.expireDate)})` : '永久有效'}
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={handleUnbindPhone}>解除绑定</button>
                </div>
              );
            })()}

            <div className="mb-6 flex border-b border-border" role="tablist" aria-label="手机关联方式">
              {data.phones.find(p => p.boundAccountId === bindAccId) ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={bindMode === 'edit'}
                  className={`flex-1 border-b-2 px-3 py-3 text-center text-sm transition-colors ${bindMode === 'edit' ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => {
                    setBindMode('edit');
                    setNewPhone({ ...data.phones.find(p => p.boundAccountId === bindAccId) });
                  }}
                >编辑当前手机</button>
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={bindMode === 'new'}
                  className={`flex-1 border-b-2 px-3 py-3 text-center text-sm transition-colors ${bindMode === 'new' ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => {
                    setBindMode('new');
                    setNewPhone({ number: '', expireDate: getDefaultExpireDate(), smsUrl: '', smsKey: '' });
                  }}
                >新建手机并绑定</button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={bindMode === 'existing'}
                className={`flex-1 border-b-2 px-3 py-3 text-center text-sm transition-colors ${bindMode === 'existing' ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setBindMode('existing')}
              >从已有号池中选择</button>
            </div>

            {(bindMode === 'new' || bindMode === 'edit') && (
              <div>
                <section className="mb-4 rounded-xl border border-border bg-muted/40 p-3" aria-labelledby="bind-phone-smart-parse-title">
                  <h4 id="bind-phone-smart-parse-title" className="mb-2 text-sm font-semibold text-foreground">✨ 手机信息快捷解析</h4>
                  <div className="mb-2 flex min-h-8 flex-wrap items-center gap-2 rounded-md border border-border bg-panel p-1.5">
                    {phoneParseFormat.length === 0 ? <span className="text-[11px] text-muted-foreground">盲猜模式...</span> : phoneParseFormat.map((fieldId, idx) => {
                        const f = PHONE_FIELDS.find(x => x.id === fieldId);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPhoneParseFormat(phoneParseFormat.filter((_, i) => i !== idx))}
                            className="inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background transition-opacity hover:opacity-80"
                            aria-label={`移除${f ? f.label : fieldId}格式`}
                          >
                            {f ? f.label : fieldId} <X size={9} weight="bold" />
                          </button>
                        )
                    })}
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {PHONE_FIELDS.map(f => (
                        <button key={f.id} type="button" onClick={() => setPhoneParseFormat([...phoneParseFormat, f.id])} className="rounded border border-border bg-panel px-1.5 py-1 text-[10px] text-foreground transition-colors hover:bg-muted">
                          + {f.label}
                        </button>
                    ))}
                    {phoneParseFormat.length > 0 && (
                      <button type="button" onClick={() => setPhoneParseFormat([])} className="ml-auto rounded border border-danger/25 px-1.5 py-1 text-[10px] text-danger transition-colors hover:bg-danger-foreground">清空</button>
                    )}
                  </div>
                  <textarea
                    aria-label="粘贴待关联手机号信息"
                    className="input min-h-12 resize-y"
                    placeholder="粘贴手机号信息..."
                    onChange={(e) => handlePhoneSmartParse(e.target.value)}
                  />
                </section>

                <div className="mb-4 flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="bind-phone-number" className="block mb-2 text-sm font-medium text-muted-foreground">新手机号码</label>
                    <input id="bind-phone-number" className="input" value={newPhone.number} onChange={e => setNewPhone({...newPhone, number: e.target.value})} placeholder="例如: +1 202-555-0108" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="bind-phone-expire-date" className="block mb-2 text-sm font-medium text-muted-foreground">手机到期日</label>
                    <input id="bind-phone-expire-date" className="input" type="date" value={newPhone.expireDate} onChange={e => setNewPhone({...newPhone, expireDate: e.target.value})} />
                  </div>
                </div>

                <datalist id="acc-phone-existing-sms-urls">
                  {existingSmsUrls.map((url, i) => (
                    <option key={i} value={url} />
                  ))}
                </datalist>

                <div className="mb-4 flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="bind-phone-sms-url" className="block mb-1 text-sm font-medium text-muted-foreground">接码地址</label>
                    <div className="flex gap-2">
                      <input id="bind-phone-sms-url" className="input min-w-0 flex-1" list="acc-phone-existing-sms-urls" value={newPhone.smsUrl} onChange={e => setNewPhone({...newPhone, smsUrl: e.target.value})} placeholder="选填: URL" />
                      <button type="button" className="btn btn-default size-10 shrink-0 p-0" disabled={!newPhone.smsUrl} title="在新窗口打开" aria-label="在新窗口打开接码地址" onClick={() => {
                        let url = newPhone.smsUrl;
                        url = ensureHttpProtocol(url);
                        window.open(url, '_blank');
                      }}>
                        <ArrowSquareOut size={15} />
                      </button>
                    </div>
                    {existingSmsUrls.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-muted-foreground">常用公共模板:</span>
                        {existingSmsUrls.slice(0, 3).map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setNewPhone({ ...newPhone, smsUrl: url })}
                            className="text-[10px] bg-muted/80 hover:bg-muted text-foreground px-2 py-0.5 rounded border border-border/60 truncate max-w-[180px]"
                            title={`点击使用: ${url}`}
                          >
                            {url.replace(/^https?:\/\//, '')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label htmlFor="bind-phone-sms-key" className="block mb-1 text-sm font-medium text-muted-foreground">接码凭证(Key)</label>
                    <input id="bind-phone-sms-key" className="input" value={newPhone.smsKey} onChange={e => setNewPhone({...newPhone, smsKey: e.target.value})} placeholder="选填: 凭证" />
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="bind-phone-note" className="block mb-2 text-sm font-medium text-muted-foreground">备注</label>
                  <input id="bind-phone-note" className="input" value={newPhone.note || ''} onChange={e => setNewPhone({...newPhone, note: e.target.value})} placeholder="选填: 手机号备注说明" />
                </div>

                <div className="flex gap-3">
                  <button className="btn btn-primary flex-1" onClick={handleBindPhoneSave}>{bindMode === 'edit' ? '保存修改' : '新建并绑定'}</button>
                  {bindMode === 'edit' && (
                    <button className="btn btn-danger flex-1" onClick={handleUnbindPhone}>解除绑定</button>
                  )}
                  <button className="btn btn-default flex-1" onClick={closeBindPhoneDialog}>取消</button>
                </div>
              </div>
            )}

            {bindMode === 'existing' && (
              <>
                <div className="max-h-[min(48vh,26rem)] space-y-2 overflow-y-auto pr-1">
                {data.phones.filter(p => !p.boundAccountId && !isInvalid(p)).map(p => (
                  <div key={p.id} data-phone-selection-row className="grid gap-3 rounded-lg border border-border bg-panel p-3 transition-colors hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-4">
                    <div data-phone-selection-info className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold tabular-nums text-foreground" title={p.number}>{p.number}</div>
                      <div className="mt-1 text-xs font-medium text-muted-foreground">闲置可用</div>
                    </div>
                    <div data-phone-selection-expiry className="whitespace-nowrap text-xs text-muted-foreground sm:text-right">
                      {p.expireDate ? (
                        <>
                          <div className="font-mono tabular-nums text-foreground">{p.expireDate}</div>
                          <div className="mt-0.5">{getDaysLeft(p.expireDate)}</div>
                        </>
                      ) : '永久有效'}
                    </div>
                    <div data-phone-selection-actions className="flex items-center gap-2 sm:justify-end">
                      {renderPhoneHistoryButton(p)}
                      <button aria-label={`绑定 ${p.number}`} className="btn btn-primary px-3 py-1 text-xs" onClick={() => handleBindExistingPhone(p.id)}>绑定</button>
                    </div>
                  </div>
                ))}
                {data.phones.filter(p => p.boundAccountId && p.boundAccountId !== bindAccId && !isInvalid(p)).map(p => {
                  const bindAcc = data.accounts.find(a => a.id === p.boundAccountId);
                  return (
                    <div key={p.id} data-phone-selection-row className="grid gap-3 rounded-lg border border-border bg-muted/35 p-3 transition-colors hover:bg-muted/55 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-4">
                      <div data-phone-selection-info className="min-w-0">
                        <div className="truncate font-mono text-sm font-semibold tabular-nums text-foreground" title={p.number}>{p.number}</div>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="shrink-0 font-medium text-foreground">已绑定</span>
                          <span aria-hidden="true" className="text-border">/</span>
                          <span className="truncate" title={bindAcc ? bindAcc.username || bindAcc.site : '未知账号'}>
                            {bindAcc ? bindAcc.username || bindAcc.site : '未知账号'}
                          </span>
                        </div>
                      </div>
                      <div data-phone-selection-expiry className="whitespace-nowrap text-xs text-muted-foreground sm:text-right">
                        {p.expireDate ? (
                          <>
                            <div className="font-mono tabular-nums text-foreground">{p.expireDate}</div>
                            <div className="mt-0.5">{getDaysLeft(p.expireDate)}</div>
                          </>
                        ) : '永久有效'}
                      </div>
                      <div data-phone-selection-actions className="flex items-center gap-2 sm:justify-end">
                        {renderPhoneHistoryButton(p)}
                        <button aria-label={`抢占绑定 ${p.number}`} className="btn btn-default px-3 py-1 text-xs" onClick={() => handleBindExistingPhone(p.id)}>抢占绑定</button>
                      </div>
                    </div>
                  )
                })}
                {data.phones.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">号池为空</div>
                )}
              </div>
              <div className="mt-4 flex gap-3">
                <button className="btn btn-default flex-1" onClick={closeBindPhoneDialog}>取消</button>
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
