"use client";

import { X } from '@phosphor-icons/react';
import { PHONE_FIELDS } from './phoneViewUtils';

export default function PhoneEditorDialog({ state, setters, actions, dialogA11y }) {
  const {
    isOpen,
    tab: addTab,
    phone: newPhone,
    parseFormat,
    batchItems,
    batchCommonSmsUrl,
    batchCommonExpireDate,
    batchRawInput,
    existingSmsUrlTemplates: existingSmsUrls,
  } = state;
  const {
    setTab,
    setPhone,
    setParseFormat,
  } = setters;

  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto p-4 md:items-start md:py-8">
          <div
            ref={dialogA11y.ref}
            role={dialogA11y.role}
            aria-modal={dialogA11y['aria-modal']}
            aria-labelledby={dialogA11y['aria-labelledby']}
            tabIndex={dialogA11y.tabIndex}
            className="bg-background w-full max-w-4xl rounded-xl shadow-2xl border border-border p-6 md:p-8 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h2 id={dialogA11y.titleId} className="text-lg font-bold text-foreground">{newPhone.id ? '详情 / 编辑手机' : '录入手机资源'}</h2>
              {!newPhone.id && (
                <div className="flex bg-muted/60 p-1 rounded-lg border border-border/50 text-xs font-medium">
                  <button
                    className={`px-3 py-1.5 rounded-md transition-all ${addTab === 'single' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setTab('single')}
                  >
                    单条录入
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-md transition-all ${addTab === 'batch' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setTab('batch')}
                  >
                    ⚡ 批量导入 (多号同批)
                  </button>
                </div>
              )}
            </div>

            {/* HTML Datalist 智能下拉建议 */}
            <datalist id="phone-existing-sms-urls">
              {existingSmsUrls.map((url, i) => (
                <option key={i} value={url} />
              ))}
            </datalist>

            {addTab === 'single' || newPhone.id ? (
              <div className="flex flex-col md:flex-row gap-8">
                {/* === 左侧栏: 智能解析 === */}
                <div className="flex flex-1 flex-col">
                  {!newPhone.id && (
                    <section className="mb-6 rounded-xl border border-border bg-muted/40 p-4" aria-labelledby="phone-smart-parse-title">
                      <h3 id="phone-smart-parse-title" className="mb-2 text-sm font-semibold text-foreground">✨ 单条智能解析 (自动填表)</h3>

                      <div className="mb-4">
                        <div className="mb-2 text-xs text-muted-foreground">1. 点击组合格式（留空则盲猜）：</div>
                        <div className="mb-3 flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-border bg-panel p-2">
                          {parseFormat.length === 0 ? <span className="text-xs text-muted-foreground">当前格式为空...</span> : parseFormat.map((fieldId, idx) => {
                              const f = PHONE_FIELDS.find(x => x.id === fieldId);
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
                          {PHONE_FIELDS.map(f => (
                              <button key={f.id} type="button" onClick={() => setParseFormat([...parseFormat, f.id])} className="rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
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

                      <label htmlFor="phone-smart-parse" className="mb-2 block text-xs text-muted-foreground">2. 粘贴数据：</label>
                      <textarea
                        id="phone-smart-parse"
                        className="input min-h-20 resize-y"
                        placeholder="在此粘贴购买的手机号信息..."
                        onChange={(e) => actions.parseSingle(e.target.value)}
                      />
                    </section>
                  )}
                </div>

                {/* === 右侧栏: 表单输入 === */}
                <div className="flex flex-1 flex-col">
                  <h3 className="mb-3 text-base font-semibold text-foreground">基本信息</h3>
                  <div className="mb-4">
                    <label htmlFor="phone-number" className="block mb-1.5 text-xs font-medium text-muted-foreground">手机号码</label>
                    <input id="phone-number" className="input" value={newPhone.number} onChange={e => setPhone({...newPhone, number: e.target.value})} placeholder="例如: +1 202-555-0109 (空则为待提取卡密)" />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="phone-expire-date" className="block mb-1.5 text-xs font-medium text-muted-foreground">到期日期</label>
                    <input id="phone-expire-date" className="input" type="date" value={newPhone.expireDate} onChange={e => setPhone({...newPhone, expireDate: e.target.value})} />
                  </div>

                  <h3 className="mb-3 mt-3 text-base font-semibold text-foreground">短信获取配置</h3>
                  <div className="mb-4">
                    <label htmlFor="phone-sms-url" className="block mb-1.5 text-xs font-medium text-muted-foreground">短信获取地址 (支持选择同订单历史地址)</label>
                    <input
                      id="phone-sms-url"
                      className="input"
                      list="phone-existing-sms-urls"
                      value={newPhone.smsUrl}
                      onChange={e => setPhone({...newPhone, smsUrl: e.target.value})}
                      placeholder="选填: URL 地址或输入框中下拉选择已有地址"
                    />
                    {existingSmsUrls.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-muted-foreground">常用公共模板:</span>
                        {existingSmsUrls.slice(0, 3).map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPhone({ ...newPhone, smsUrl: url })}
                            className="text-[10px] bg-muted/80 hover:bg-muted text-foreground px-2 py-0.5 rounded border border-border/60 truncate max-w-[180px]"
                            title={`点击使用: ${url}`}
                          >
                            {url.replace(/^https?:\/\//, '')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label htmlFor="phone-sms-key" className="block mb-1.5 text-xs font-medium text-muted-foreground">短信凭证(Key)</label>
                    <input id="phone-sms-key" className="input" value={newPhone.smsKey} onChange={e => setPhone({...newPhone, smsKey: e.target.value})} placeholder="选填: 接码凭证" />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="phone-note" className="block mb-1.5 text-xs font-medium text-muted-foreground">备注</label>
                    <textarea id="phone-note" className="input min-h-16 resize-y" value={newPhone.note || ''} onChange={e => setPhone({...newPhone, note: e.target.value})} placeholder="选填: 手机号备注说明" />
                  </div>
                </div>
              </div>
            ) : (
              /* === 批量导入模式 === */
              <div className="flex flex-col gap-5">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 text-xs text-amber-800">
                  💡 <strong>批量导入提示：</strong>同一批购买的手机号可共用相同的【短信获取地址】。若导入无手机号的【卡密/提取凭证】，系统将自动标记为<strong>待提取</strong>。
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                  <div>
                    <label htmlFor="phone-batch-sms-url" className="block mb-1.5 text-xs font-semibold text-foreground">
                      同批次公共默认【短信获取地址】
                    </label>
                    <input
                      id="phone-batch-sms-url"
                      className="input w-full"
                      list="phone-existing-sms-urls"
                      value={batchCommonSmsUrl}
                      onChange={e => actions.changeBatchSmsUrl(e.target.value)}
                      placeholder="选填: 此批手机号共用的 SMS 接收地址"
                    />
                    {existingSmsUrls.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-muted-foreground">常用公共模板:</span>
                        {existingSmsUrls.slice(0, 3).map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => actions.changeBatchSmsUrl(url)}
                            className="text-[10px] bg-background hover:bg-muted text-foreground px-2 py-0.5 rounded border border-border/60 truncate max-w-[180px]"
                            title={`点击使用: ${url}`}
                          >
                            {url.replace(/^https?:\/\//, '')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone-batch-expire-date" className="block mb-1.5 text-xs font-semibold text-foreground">
                      同批次公共默认【到期日期】
                    </label>
                    <input
                      id="phone-batch-expire-date"
                      className="input w-full"
                      type="date"
                      value={batchCommonExpireDate}
                      onChange={e => actions.changeBatchExpireDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="phone-batch-raw-input" className="text-xs font-semibold text-foreground">粘贴多行手机号/卡密数据 (支持多行批量解析)：</label>
                    <span className="text-[11px] text-muted-foreground">每行一个手机号/卡密</span>
                  </div>
                  <textarea
                    id="phone-batch-raw-input"
                    className="input h-28 w-full resize-y font-mono text-xs"
                    placeholder={`粘贴多行手机号或接码地址卡密，例：\n+1 202-555-0105----TEST-SMS-KEY\nhttps://sms.example.invalid----TEST-SMS-KEY (自动识别为待提取)\n或每行一个卡密`}
                    value={batchRawInput}
                    onChange={e => actions.parseBatch(e.target.value)}
                  />
                </div>

                {/* 批量解析预览清单 */}
                {batchItems.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="bg-muted/60 px-4 py-2 text-xs font-semibold text-foreground flex justify-between items-center">
                      <span>批量解析预览清单 ({batchItems.length} 个项目)</span>
                      <button
                        className="text-[11px] text-red-500 hover:underline"
                        onClick={actions.clearBatch}
                      >
                        清空
                      </button>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto divide-y divide-border">
                      {batchItems.map((item, idx) => (
                        <div key={idx} className="p-2.5 px-4 text-xs flex items-center justify-between hover:bg-muted/20">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-medium text-foreground">
                              {item.number ? item.number : <span className="text-amber-600 font-semibold">🔑 [待提取卡密]</span>}
                            </span>
                            {item.smsKey && <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Key: {item.smsKey}</span>}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="truncate max-w-[220px]" title={item.smsUrl || '未指定'}>
                              {item.smsUrl ? `🌐 ${item.smsUrl}` : '无地址'}
                            </span>
                            <span>📅 {item.expireDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3 border-t border-border pt-5">
              {addTab === 'batch' && !newPhone.id ? (
                <button
                  className="btn btn-primary flex-1"
                  onClick={actions.saveBatch}
                  disabled={batchItems.length === 0}
                >
                  一键批量导入这 {batchItems.length} 个记录
                </button>
              ) : (
                <button className="btn btn-primary flex-1" onClick={actions.save}>保存</button>
              )}
              <button className="btn btn-default flex-1" onClick={actions.close}>取消</button>
            </div>
          </div>
        </div>
  );
}
