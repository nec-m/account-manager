"use client";

import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { TOTP } from 'totp-generator';
import {
  PencilSimple, DeviceMobile, Copy, Check, Eye, EyeSlash,
  ShieldCheck, X, ArrowSquareOut
} from '@phosphor-icons/react';
import { ensureHttpProtocol, getSecretDisplayValue } from '@/lib/utils';
import TotpCountdown from './TotpCountdown';
import useDialogA11y from '../../_hooks/useDialogA11y';

function getStatusBadge(dateString) {
  if (!dateString) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">永久</span>;
  const date = new Date(dateString);
  const msDiff = date.getTime() - new Date().getTime();
  if (msDiff < 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-rose-100 text-rose-800">已到期</span>;
  if (msDiff < 3 * 24 * 60 * 60 * 1000) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800">即将过期</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">使用中</span>;
}

function getDaysLeft(dateString) {
  if (!dateString) return '永久有效';
  const date = new Date(dateString);
  const msDiff = date.getTime() - new Date().getTime();
  if (msDiff < 0) return '已到期';
  return formatDistanceToNow(date, { locale: zhCN }) + '后';
}

function getArchivedPhoneSnapshot(account) {
  if (account.status !== 'archived' || !account.archivedPhoneSnapshot) return null;

  try {
    return JSON.parse(account.archivedPhoneSnapshot);
  } catch {
    return null;
  }
}

export default function AccountDetailModal({
  account,
  phones = [],
  isOpen,
  onClose,
  readOnly = false,
  onEdit,
  onBindPhone,
  onShowAlert
}) {
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [showModal2FAKey, setShowModal2FAKey] = useState(false);
  const [modalCodeResult, setModalCodeResult] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const dialogRef = useRef(null);
  const dialogA11y = useDialogA11y({
    isOpen: isOpen && !!account,
    onClose,
    dialogRef,
  });

  useEffect(() => {
    if (isOpen) {
      setShowModalPassword(false);
      setShowModal2FAKey(false);
      setModalCodeResult(null);
      setCopiedId(null);
    }
  }, [isOpen, account]);

  if (!isOpen || !account) return null;

  const archivedPhoneSnapshot = getArchivedPhoneSnapshot(account);

  const livePhone = phones.find((phone) => phone.boundAccountId === account.id);
  const accountPhone = archivedPhoneSnapshot?.number || account.phone || livePhone?.number || '';

  const copyToClipboard = async (text, id) => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
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
          onClick={onClose}
          aria-label="关闭账号详情弹窗"
          className="absolute right-6 top-6 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="关闭"
        >
          <X size={20} />
        </button>

        <div>
          {/* 顶栏：标题与操作 */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <h2 id={dialogA11y.titleId} className="text-xl font-bold text-foreground flex items-center gap-2">
                {account.site || '账号详情'}
              </h2>
              {getStatusBadge(account.expireDate)}
            </div>
            {!readOnly && onEdit && (
              <div className="flex items-center gap-2 mr-8">
                <button
                  onClick={onEdit}
                  className="btn btn-default flex items-center gap-1.5 text-xs py-1.5 px-3 hover:border-primary hover:text-primary transition-colors"
                >
                  <PencilSimple size={14} />
                  <span>编辑账号</span>
                </button>
              </div>
            )}
          </div>

          {/* 展示主体 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 左列：账号核心鉴权与信息 */}
            <div className="space-y-4">
              {/* 账号 */}
              <div className="bg-muted/30 border border-border p-3.5 rounded-xl space-y-1">
                <div className="text-xs text-muted-foreground font-medium">账号 / 邮箱</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground truncate select-all">
                    {account.username || '-'}
                  </span>
                  {account.username && (
                    <button
                      onClick={() => copyToClipboard(account.username, 'modal-usr')}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors shrink-0"
                      title={copiedId === 'modal-usr' ? "已复制" : "复制账号"}
                    >
                      {copiedId === 'modal-usr' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* 密码 */}
              <div className="bg-muted/30 border border-border p-3.5 rounded-xl space-y-1">
                <div className="text-xs text-muted-foreground font-medium">登录密码</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground select-all">
                    {getSecretDisplayValue(account.password, showModalPassword, '••••••••••••')}
                  </span>
                  {account.password && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setShowModalPassword(!showModalPassword)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                        title={showModalPassword ? "隐藏密码" : "显示密码"}
                      >
                        {showModalPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(account.password, 'modal-pwd')}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors shrink-0"
                        title={copiedId === 'modal-pwd' ? "已复制" : "复制密码"}
                      >
                        {copiedId === 'modal-pwd' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 到期时间 */}
              <div className="bg-muted/30 border border-border p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">服务到期时间</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {account.expireDate ? `${account.expireDate} (${getDaysLeft(account.expireDate)})` : '永不到期'}
                  </div>
                </div>
              </div>

              {/* 关联手机 */}
              <div className="bg-muted/30 border border-border p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">关联手机</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                    <DeviceMobile size={16} className={accountPhone ? 'text-amber-600' : 'text-muted-foreground'} />
                    <span>{accountPhone || (account.status === 'archived' ? '停用前未保存手机号信息' : '未绑定手机号')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {accountPhone && (
                    <button
                      onClick={() => copyToClipboard(accountPhone, 'modal-phone')}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors shrink-0"
                      title={copiedId === 'modal-phone' ? "已复制" : "复制手机号"}
                    >
                      {copiedId === 'modal-phone' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  )}
                  {!readOnly && onBindPhone && (
                    <button
                      onClick={() => {
                        onClose();
                        onBindPhone(account.id);
                      }}
                      className="btn btn-default text-xs py-1 px-2.5 shrink-0"
                    >
                      {accountPhone ? '管理绑定' : '绑定手机'}
                    </button>
                  )}
                </div>
              </div>

              {archivedPhoneSnapshot && (
                <div className="bg-muted/30 border border-border p-3.5 rounded-xl space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">停用时手机接码配置</div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">接码地址:</span>
                    <span className="font-mono text-foreground truncate select-all" title={archivedPhoneSnapshot.smsUrl}>
                      {archivedPhoneSnapshot.smsUrl || '未配置'}
                    </span>
                    {archivedPhoneSnapshot.smsUrl && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copyToClipboard(archivedPhoneSnapshot.smsUrl, 'modal-archived-sms-url')}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                          title="复制接码地址"
                        >
                          {copiedId === 'modal-archived-sms-url' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => window.open(ensureHttpProtocol(archivedPhoneSnapshot.smsUrl), '_blank')}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                          title="打开接码网页"
                        >
                          <ArrowSquareOut size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">短信凭证:</span>
                    <span className="font-mono text-foreground truncate select-all">{archivedPhoneSnapshot.smsKey || '未配置'}</span>
                    {archivedPhoneSnapshot.smsKey && (
                      <button
                        onClick={() => copyToClipboard(archivedPhoneSnapshot.smsKey, 'modal-archived-sms-key')}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors shrink-0"
                        title="复制短信凭证"
                      >
                        {copiedId === 'modal-archived-sms-key' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 右列：验证码及安全获取配置 */}
            <div className="space-y-4">
              {/* 2FA 验证 */}
              <div className="bg-muted/30 border border-border p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-emerald-600" /> 2FA 双重验证
                  </span>
                  {account.twoFaUrl && (
                    <button
                      onClick={() => {
                        window.open(ensureHttpProtocol(account.twoFaUrl), '_blank');
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <span>打开 2FA 网页</span>
                      <ArrowSquareOut size={12} />
                    </button>
                  )}
                </div>

                {account.twoFaKey ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-muted-foreground shrink-0">2FA 密钥:</span>
                        <span className="font-mono text-foreground font-medium truncate select-all">
                          {getSecretDisplayValue(account.twoFaKey, showModal2FAKey, '••••••••••••')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setShowModal2FAKey(!showModal2FAKey)}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                          title={showModal2FAKey ? "隐藏密钥" : "显示密钥"}
                        >
                          {showModal2FAKey ? <EyeSlash size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(account.twoFaKey, 'modal-2fa-key')}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors shrink-0"
                          title={copiedId === 'modal-2fa-key' ? "已复制" : "复制 2FA 密钥"}
                        >
                          {copiedId === 'modal-2fa-key' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={async () => {
                          try {
                            const cleanKey = account.twoFaKey.replace(/\s+/g, '').toUpperCase();
                            const { otp, expires } = await TOTP.generate(cleanKey);
                            setModalCodeResult({ code: otp, expires, twoFaKey: cleanKey });
                            copyToClipboard(otp, 'modal-2fa-code');
                          } catch (e) {
                            if (onShowAlert) {
                              onShowAlert("2FA 密钥解析失败，请检查格式。");
                            }
                          }
                        }}
                        className="w-full btn btn-primary py-2 text-xs flex items-center justify-center gap-2 font-medium"
                      >
                        <ShieldCheck size={16} />
                        <span>生成并复制 2FA 验证码</span>
                      </button>

                      {modalCodeResult && (
                        <div className="mt-2.5 p-2.5 bg-background border border-emerald-500/40 rounded-lg flex flex-col items-center gap-1 text-xs shadow-xs">
                          <div className="flex items-center justify-between w-full border-b border-border/40 pb-1.5">
                            <div
                              onClick={() => copyToClipboard(modalCodeResult.code, 'modal-2fa-code')}
                              className="font-mono font-bold text-lg text-emerald-700 flex items-center gap-2 cursor-pointer hover:opacity-80 select-none"
                              title="点击复制"
                            >
                              <span>{modalCodeResult.code}</span>
                              {copiedId === 'modal-2fa-code' ? (
                                <span className="text-xs text-emerald-600 font-normal flex items-center gap-0.5"><Check size={13} weight="bold" />已复制</span>
                              ) : (
                                <Copy size={13} className="text-muted-foreground" />
                              )}
                            </div>
                            <button onClick={() => setModalCodeResult(null)} className="text-muted-foreground hover:text-foreground text-xs p-1">✕</button>
                          </div>
                          {modalCodeResult.expires && (
                            <TotpCountdown
                              expires={modalCodeResult.expires}
                              onRefresh={async () => {
                                try {
                                  const { otp, expires } = await TOTP.generate(modalCodeResult.twoFaKey);
                                  setModalCodeResult(prev => ({ ...prev, code: otp, expires }));
                                  copyToClipboard(otp, 'modal-2fa-code');
                                } catch (e) {}
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-2 text-center">未配置 2FA 密钥</div>
                )}
              </div>

              {/* 邮箱验证 */}
              <div className="bg-muted/30 border border-border p-3.5 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-foreground border-b border-border/60 pb-2">
                  邮箱验证配置
                </div>
                {account.emailUrl ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[200px]" title={account.emailUrl}>
                      {account.emailUrl}
                    </span>
                    <button
                      onClick={() => {
                        window.open(ensureHttpProtocol(account.emailUrl), '_blank');
                      }}
                      className="btn btn-default text-xs py-1 px-2.5 flex items-center gap-1 shrink-0"
                    >
                      <span>打开邮箱</span>
                      <ArrowSquareOut size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-1">未配置邮箱验证地址</div>
                )}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">邮箱凭证:</span>
                  <span className="font-mono text-foreground truncate select-all">{account.emailKey || '未配置'}</span>
                  {account.emailKey && (
                    <button
                      onClick={() => copyToClipboard(account.emailKey, 'modal-email-key')}
                      className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors shrink-0"
                      title="复制邮箱凭证"
                    >
                      {copiedId === 'modal-email-key' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 备注面板 */}
          <div className="bg-muted/30 border border-border p-4 rounded-xl space-y-1 mb-6">
            <div className="text-xs font-medium text-muted-foreground mb-1">账号备注</div>
            <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
              {account.note ? account.note : <span className="text-muted-foreground italic">暂无备注</span>}
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button className="btn btn-default px-6 py-2 text-xs" onClick={onClose}>关闭</button>
            {!readOnly && onEdit && (
              <button className="btn btn-primary px-6 py-2 text-xs flex items-center gap-1.5" onClick={onEdit}>
                <PencilSimple size={14} />
                <span>编辑账号信息</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
