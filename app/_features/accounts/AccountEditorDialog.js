"use client";

import {
  ArrowSquareOut,
  Check,
  Plus,
  X,
} from '@phosphor-icons/react';

import { ensureHttpProtocol } from '@/lib/utils';
import { ACCOUNT_FIELDS } from './accountViewUtils';

export default function AccountEditorDialog({ state, setters, actions, dialogA11y }) {
  const {
    account: newAcc,
    batchItems,
    smartParseInput,
    parseFormat,
  } = state;
  const {
    setAccount: setNewAcc,
    setParseFormat,
  } = setters;
  const {
    openView,
    close: closeAccountEditor,
    save: handleSave,
    saveBatch: handleBatchSave,
    parseInput: handleSmartParse,
  } = actions;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto p-4 md:items-start md:py-8">
      <div
        ref={dialogA11y.ref}
        role={dialogA11y.role}
        aria-modal={dialogA11y['aria-modal']}
        aria-labelledby={dialogA11y['aria-labelledby']}
        tabIndex={dialogA11y.tabIndex}
        className="bg-background w-full max-w-3xl rounded-xl shadow-2xl border border-border p-6 md:p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeAccountEditor}
          aria-label="关闭账号编辑弹窗"
          className="absolute right-6 top-6 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="关闭"
        >
          <X size={20} />
        </button>
        <div>
          <h2 id={dialogA11y.titleId} className="mb-5 pr-10 text-xl font-semibold tracking-tight text-foreground">{newAcc.id ? '编辑账号信息' : '添加新账号'}</h2>
            {!newAcc.id && (
              <section className="mb-6 rounded-xl border border-border bg-muted/40 p-4" aria-labelledby="account-smart-parse-title">
                <h3 id="account-smart-parse-title" className="mb-2 text-sm font-semibold text-foreground">✨ 智能解析 (自动填表)</h3>

                <div className="mb-4">
                  <div className="mb-2 text-xs text-muted-foreground">1. 点击组合格式（留空则盲猜）：</div>
                  <div className="mb-3 flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-border bg-panel px-3 py-2">
                    {parseFormat.length === 0 ? <span className="text-xs text-muted-foreground">当前格式为空，请点击下方标签组合...</span> : parseFormat.map((fieldId, idx) => {
                        const f = ACCOUNT_FIELDS.find(x => x.id === fieldId);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setParseFormat(parseFormat.filter((_, i) => i !== idx))}
                            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-opacity hover:opacity-80"
                            aria-label={`移除${f ? f.label : fieldId}格式`}
                          >
                            {f ? f.label : fieldId} <X size={10} weight="bold" />
                          </button>
                        )
                    })}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {ACCOUNT_FIELDS.map(f => (
                        <button key={f.id} type="button" onClick={() => setParseFormat([...parseFormat, f.id])} className="rounded-md border border-border bg-panel px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
                          + {f.label}
                        </button>
                    ))}
                    {parseFormat.length > 0 && (
                      <button type="button" onClick={() => setParseFormat([])} className="ml-auto rounded-md border border-danger/25 px-2 py-1 text-[11px] text-danger transition-colors hover:bg-danger-foreground">
                        清空
                      </button>
                    )}
                  </div>
                </div>

                <label htmlFor="account-smart-parse" className="mb-2 block text-xs text-muted-foreground">2. 粘贴数据（支持多行批量粘贴）：</label>
                <textarea
                  id="account-smart-parse"
                  className="input min-h-20 resize-y"
                  placeholder="在此粘贴购买的账号信息，支持单行或一次性粘贴多行卡密..."
                  value={smartParseInput}
                  onChange={(e) => handleSmartParse(e.target.value)}
                />

                {/* 同批次公共固定配置提醒与补全指示 */}
                <div className="mt-2 p-2 bg-blue-50/50 border border-blue-200/60 rounded flex items-center justify-between text-[11px] text-blue-700">
                  <span>💡 <b>同批共享属性小贴士</b>：密码、2FA获取地址和邮箱验证获取地址均支持同批共享，在下方填好后智能解析将自动继承补齐。</span>
                </div>

                {/* 批量解析预览清单 */}
                {batchItems.length > 0 && (
                  <div className="mt-3 p-3.5 bg-emerald-50/60 border border-emerald-300/80 rounded-xl shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <Check size={16} className="text-emerald-600" />
                        已识别到 {batchItems.length} 个账号数据（缺失项已自动继承公共配置）
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSmartParse('')}
                        className="text-[11px] text-rose-600 hover:underline font-medium"
                      >
                        清空批量
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {batchItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-background p-2 rounded-lg border border-emerald-200/50 text-xs font-mono">
                          <div className="truncate flex items-center gap-2 text-foreground">
                            <span className="font-bold text-emerald-700">#{idx + 1}</span>
                            <span className="font-semibold">{item.username || '(无用户名)'}</span>
                            <span className="text-muted-foreground text-[11px]">密码: {item.password || '空'}</span>
                            <span className="text-muted-foreground text-[11px] truncate">2FAKey: {item.twoFaKey ? item.twoFaKey.slice(0, 10) + '...' : '空'}</span>
                            <span className="text-muted-foreground text-[11px] truncate">2FA地址: {item.twoFaUrl || '空'}</span>
                            {item.emailUrl && <span className="text-muted-foreground text-[11px] truncate">邮箱地址: {item.emailUrl}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleBatchSave}
                      className="w-full btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus size={16} weight="bold" />
                      <span>一键批量导入这 {batchItems.length} 个账号</span>
                    </button>
                  </div>
                )}
              </section>
            )}

            <div className="flex flex-col md:flex-row gap-8">
              {/* 左列：基本信息 */}
              <div className="flex flex-1 flex-col">
                <h3 className="mb-3 text-base font-semibold text-foreground">基本信息</h3>
                <div className="mb-3">
                  <label htmlFor="account-site" className="block mb-2 text-sm font-medium text-muted-foreground">账号类型</label>
                  <select id="account-site" className="input"
                    value={newAcc.site}
                    onChange={e => setNewAcc({...newAcc, site: e.target.value})}
                  >
                    <option value="OpenAI">OpenAI</option>
                    <option value="Claude">Claude</option>
                    <option value="Google">Google</option>
                    <option value="Discord">Discord</option>
                    <option value="Telegram">Telegram</option>
                    <option value="X (Twitter)">X (Twitter)</option>
                    <option value="Apple">Apple</option>
                    <option value="Microsoft">Microsoft</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="account-username" className="block mb-2 text-sm font-medium text-muted-foreground">账号</label>
                  <input id="account-username" className="input" value={newAcc.username} onChange={e => setNewAcc({...newAcc, username: e.target.value})} placeholder="例如: name@example.invalid" />
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="account-password" className="text-sm font-medium text-muted-foreground">密码</label>
                    <span className="text-[11px] text-muted-foreground font-normal">同批可共享</span>
                  </div>
                  <input id="account-password" className="input" value={newAcc.password} onChange={e => setNewAcc({...newAcc, password: e.target.value})} />
                </div>

                <div className="mb-3">
                  <label htmlFor="account-expire-date" className="block mb-2 text-sm font-medium text-muted-foreground">到期日期</label>
                  <input id="account-expire-date" className="input" type="date" value={newAcc.expireDate} onChange={e => setNewAcc({...newAcc, expireDate: e.target.value})} />
                </div>
                <div className="mb-3">
                  <label htmlFor="account-note" className="block mb-2 text-sm font-medium text-muted-foreground">备注</label>
                  <textarea id="account-note" className="input min-h-16 resize-y" value={newAcc.note || ''} onChange={e => setNewAcc({...newAcc, note: e.target.value})} placeholder="选填: 账号备注信息" />
                </div>
              </div>

              {/* 右列：验证码获取配置 */}
              <div className="flex flex-1 flex-col">
                <h3 className="mb-3 text-base font-semibold text-foreground">验证码获取配置</h3>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="account-twofa-url" className="text-sm font-medium text-muted-foreground">2FA 获取地址</label>
                    <span className="text-[11px] text-muted-foreground font-normal">同批可共享</span>
                  </div>
                  <div className="flex gap-2">
                    <input id="account-twofa-url" className="input min-w-0 flex-1" value={newAcc.twoFaUrl} onChange={e => setNewAcc({...newAcc, twoFaUrl: e.target.value})} />
                    <button type="button" className="btn btn-default size-10 shrink-0 p-0" disabled={!newAcc.twoFaUrl} title="在新窗口打开" aria-label="在新窗口打开 2FA 获取地址" onClick={() => {
                      window.open(ensureHttpProtocol(newAcc.twoFaUrl), '_blank');
                    }}>
                      <ArrowSquareOut size={15} />
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="account-twofa-key" className="block mb-2 text-sm font-medium text-muted-foreground">2FA 凭证(Key)</label>
                  <input id="account-twofa-key" className="input" value={newAcc.twoFaKey} onChange={e => setNewAcc({...newAcc, twoFaKey: e.target.value})} placeholder="选填: 密钥" />
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="account-email-url" className="text-sm font-medium text-muted-foreground">邮箱验证获取地址</label>
                    <span className="text-[11px] text-muted-foreground font-normal">同批可共享</span>
                  </div>
                  <div className="flex gap-2">
                    <input id="account-email-url" className="input min-w-0 flex-1" value={newAcc.emailUrl} onChange={e => setNewAcc({...newAcc, emailUrl: e.target.value})} placeholder="选填: URL 地址" />
                    <button type="button" className="btn btn-default size-10 shrink-0 p-0" disabled={!newAcc.emailUrl} title="在新窗口打开" aria-label="在新窗口打开邮箱验证获取地址" onClick={() => {
                      window.open(ensureHttpProtocol(newAcc.emailUrl), '_blank');
                    }}>
                      <ArrowSquareOut size={15} />
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="account-email-key" className="block mb-2 text-sm font-medium text-muted-foreground">邮箱凭证(Key)</label>
                  <input id="account-email-key" className="input" value={newAcc.emailKey} onChange={e => setNewAcc({...newAcc, emailKey: e.target.value})} placeholder="选填: 识别该邮箱的凭证" />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-4 border-t border-border">
              {!newAcc.id && batchItems.length === 0 && (
                <button
                  type="button"
                  className="btn btn-default hover:border-primary hover:text-primary transition-colors flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                  onClick={() => handleSave(true)}
                  title="保存当前账号，并自动保留公共密码与2FA获取地址，方便录入下一个账号"
                >
                  <Plus size={15} weight="bold" />
                  <span>保存并添加下一个</span>
                </button>
              )}
              {batchItems.length === 0 && (
                <button
                  type="button"
                  className="btn btn-primary flex-1 py-2.5 text-xs font-bold"
                  onClick={() => handleSave(false)}
                >
                  保存账号
                </button>
              )}
              <button
                type="button"
                className="btn btn-default flex-1 py-2.5 text-xs"
                onClick={newAcc.id ? () => openView(newAcc) : closeAccountEditor}
              >
                取消
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}
