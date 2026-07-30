"use client";

export default function PhoneExtractionDialog({ state, setters, actions, dialogA11y }) {
  if (!state.isOpen) return null;

  return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            ref={dialogA11y.ref}
            role={dialogA11y.role}
            aria-modal={dialogA11y['aria-modal']}
            aria-labelledby={dialogA11y['aria-labelledby']}
            tabIndex={dialogA11y.tabIndex}
            className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-border p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h2 id={dialogA11y.titleId} className="text-base font-bold text-foreground flex items-center gap-2">
                <span>🔑 提取并录入手机号码</span>
              </h2>
              <button onClick={actions.close} aria-label="关闭手机号提取弹窗" className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
                <p className="font-semibold mb-1">已为你完成以下准备工作：</p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>已自动将卡密 <strong>{state.phone.smsKey || '无'}</strong> 复制到剪贴板。</li>
                  {state.phone.smsUrl ? (
                    <li>已在新标签页打开接码地址网页。</li>
                  ) : (
                    <li className="text-red-500">提示：此记录未配置接码地址 URL。</li>
                  )}
                </ul>
              </div>

              <div>
                <label className="block mb-1.5 font-semibold text-foreground">请在接码网页生成手机号后粘贴在此处：</label>
                <input
                  type="text"
                  className="input w-full font-mono text-sm"
                  placeholder="例如: +1 202-555-0106 或 +1 202-555-0107"
                  value={state.number}
                  onChange={e => setters.setNumber(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') actions.save();
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
              <button className="btn btn-primary flex-1 py-2 text-xs" onClick={actions.save}>
                确认录入手机号
              </button>
              <button className="btn btn-default flex-1 py-2 text-xs" onClick={actions.close}>
                取消
              </button>
            </div>
          </div>
        </div>
  );
}
