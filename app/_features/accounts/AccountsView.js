"use client";

import { useState } from 'react';
import CustomDialog from '../../_components/CustomDialog';
import AccountDetailModal from './AccountDetailModal';
import PhoneAccountHistoryModal from '../bindings/PhoneAccountHistoryModal';
import { TOTP } from 'totp-generator';
import {
  SquaresFour, Plus, Copy, Check,
  ArrowSquareOut
} from '@phosphor-icons/react';

import EmptyState from '../../_components/EmptyState';
import { ensureHttpProtocol, isInvalid, toggleListItem } from '@/lib/utils';
import AccountsHeader, { AccountsSelectionDock } from './AccountsHeader';
import AccountCollection from './AccountCollection';
import AccountEditorDialog from './AccountEditorDialog';
import useAccountEditor from './useAccountEditor';
import AccountPhoneBindingDialog from './AccountPhoneBindingDialog';
import useAccountPhoneBinding from './useAccountPhoneBinding';

export default function AccountsView({ data, onChange, isAdmin = false, onUnauthorized }) {
  const [dialog, setDialog] = useState({ isOpen: false });
  const editor = useAccountEditor({
    data,
    onChange,
    onDialogChange: setDialog,
  });
  const phoneBinding = useAccountPhoneBinding({
    data,
    onChange,
    onDialogChange: setDialog,
  });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordId, setShowPasswordId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [fetchingCodeFor, setFetchingCodeFor] = useState(null);
  const [codeResult, setCodeResult] = useState(null);
  const [copiedToast, setCopiedToast] = useState(null);

  const copyToClipboard = async (text, id) => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      return true;
    } catch {
      return false;
    }
  };

  const retryToastCopy = async () => {
    const copySucceeded = await copyToClipboard(copiedToast?.text, 'toast-copy');
    setCopiedToast((current) => current ? { ...current, copySucceeded } : current);
  };

  const validAccounts = data.accounts.filter(a => !isInvalid(a));

  const handleToggleSelect = (id) => {
    setSelectedIds((current) => toggleListItem(current, id));
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredAccounts.length && filteredAccounts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map(a => a.id));
    }
  };

  const getArchivedPhoneSnapshot = (accountId) => {
    const phone = data.phones.find((item) => item.boundAccountId === accountId);
    if (!phone) return '';
    return JSON.stringify({
      number: phone.number || '',
      smsUrl: phone.smsUrl || '',
      smsKey: phone.smsKey || '',
    });
  };

  const handleBatchArchive = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `确定要批量停用选中的 ${count} 个账号吗？\n（停用后它们将转入“失效与停用”库，并自动解绑手机）`,
      onConfirm: () => {
        const selectedSet = new Set(selectedIds);
        const newAccs = data.accounts.map(a => selectedSet.has(a.id)
          ? { ...a, status: 'archived', archivedPhoneSnapshot: getArchivedPhoneSnapshot(a.id) }
          : a);
        const newPhones = data.phones.map(p => selectedSet.has(p.boundAccountId) ? { ...p, boundAccountId: null } : p);
        onChange({ ...data, accounts: newAccs, phones: newPhones });
        setSelectedIds([]);
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `⚠️ 确定彻底从系统中删除选中的 ${count} 个账号吗？此操作不可逆！`,
      danger: true,
      onConfirm: () => {
        const selectedSet = new Set(selectedIds);
        const newAccs = data.accounts.filter(a => !selectedSet.has(a.id));
        const newPhones = data.phones.map(p => selectedSet.has(p.boundAccountId) ? { ...p, boundAccountId: null } : p);
        onChange({ ...data, accounts: newAccs, phones: newPhones });
        setSelectedIds([]);
      }
    });
  };

  const markArchived = (id) => {
    setDialog({
      isOpen: true, type: 'confirm', message: '确定要停用该账号吗？（停用后它将在列表中被隐藏，且自动解绑手机）',
      onConfirm: () => {
        const newAccs = data.accounts.map(a => a.id === id
          ? { ...a, status: 'archived', archivedPhoneSnapshot: getArchivedPhoneSnapshot(id) }
          : a);
        const newPhones = data.phones.map(p => p.boundAccountId === id ? { ...p, boundAccountId: null } : p);
        onChange({ ...data, accounts: newAccs, phones: newPhones });
      }
    });
  };

  const handleDelete = (id) => {
    setDialog({
      isOpen: true, type: 'confirm', message: '确定彻底删除该账号吗？此操作不可逆。', danger: true,
      onConfirm: () => {
        const newAccs = data.accounts.filter(a => a.id !== id);
        const newPhones = data.phones.map(p => p.boundAccountId === id ? { ...p, boundAccountId: null } : p);
        onChange({ ...data, accounts: newAccs, phones: newPhones });
      }
    });
  };

  const fetchCode = async (serviceType, acc, boundPhone = null) => {
    setFetchingCodeFor(acc.id + '-' + serviceType);
    setCodeResult(null);
    try {
      const res = await fetch('/api/fetch-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType, account: acc, phone: boundPhone })
      });
      const json = await res.json();

      if (res.status === 401 || (res.status === 403 && json.code === 'PASSWORD_CHANGE_REQUIRED')) {
        setFetchingCodeFor(null);
        setCodeResult(null);
        setCopiedToast(null);
        setCopiedId(null);
        editor.actions.close();
        phoneBinding.actions.close();
        setDialog({ isOpen: false });
        onUnauthorized?.(json);
        return;
      }

      setFetchingCodeFor(null);
      if (res.ok) {
        const resultId = acc.id + '-' + serviceType;
        setCodeResult({ id: resultId, type: 'code', code: json.code });
        if (json.code) {
          const copySucceeded = await copyToClipboard(json.code, resultId);
          setCopiedToast({ text: json.code, label: `${serviceType.toUpperCase()} 验证码`, urlOpened: false, copySucceeded });
        }
      } else {
        setDialog({ isOpen: true, type: 'alert', message: json.error || json.details || '获取失败' });
      }
    } catch (err) {
      setFetchingCodeFor(null);
      setDialog({ isOpen: true, type: 'alert', message: "请求失败" });
    }
  };

  const handleCheckEmail = async (acc) => {
    if (acc.emailUrl) {
      let url = acc.emailUrl;
      url = ensureHttpProtocol(url);
      window.open(url, '_blank');
      if (acc.emailKey) {
        const copySucceeded = await copyToClipboard(acc.emailKey, acc.id + '-email-key');
        setCopiedToast({ text: acc.emailKey, label: '邮箱凭证/Key', urlOpened: true, copySucceeded });
      } else {
        setCopiedToast({ text: null, label: '邮箱验证网页', urlOpened: true });
      }
    } else {
      fetchCode('email', acc);
    }
  };

  const handleCheck2Fa = async (acc) => {
    if (acc.twoFaKey) {
      try {
        const cleanKey = acc.twoFaKey.replace(/\s+/g, '').toUpperCase();
        const { otp, expires } = await TOTP.generate(cleanKey);
        const resultId = acc.id + '-2fa';
        setCodeResult({ id: resultId, type: 'code', code: otp, expires, twoFaKey: cleanKey });
        const copySucceeded = await copyToClipboard(otp, resultId);
        setCopiedToast({ text: otp, label: '2FA 验证码', urlOpened: false, copySucceeded });
      } catch (err) {
        if (acc.twoFaUrl) {
          let url = acc.twoFaUrl;
          url = ensureHttpProtocol(url);
          window.open(url, '_blank');
          const copySucceeded = await copyToClipboard(acc.twoFaKey, acc.id + '-2fa-key');
          setCopiedToast({ text: acc.twoFaKey, label: '2FA Key 密钥', urlOpened: true, copySucceeded });
        } else {
          setDialog({ isOpen: true, type: 'alert', message: "2FA生成失败，请检查 Key 是否正确" });
        }
      }
    } else if (acc.twoFaUrl) {
      let url = acc.twoFaUrl;
      url = ensureHttpProtocol(url);
      window.open(url, '_blank');
      setCopiedToast({ text: null, label: '2FA 验证网页', urlOpened: true });
    } else {
      fetchCode('2fa', acc);
    }
  };

  const handleCheckSms = async (acc, boundPhone) => {
    if (boundPhone && boundPhone.smsUrl) {
      let url = boundPhone.smsUrl;
      let copyText = boundPhone.smsKey || boundPhone.number;
      if (url.includes('[KEY]') && boundPhone.smsKey) {
        url = url.replace(/\[KEY\]/g, boundPhone.smsKey);
      } else if (url.includes('[PHONE]') && boundPhone.number) {
        url = url.replace(/\[PHONE\]/g, boundPhone.number);
      }
      url = ensureHttpProtocol(url);

      window.open(url, '_blank');
      if (copyText) {
        const resultId = acc.id + '-sms';
        const copySucceeded = await copyToClipboard(copyText, resultId);
        setCodeResult({ id: resultId, type: 'notice', rawText: copyText, copySucceeded });
        setCopiedToast({
          text: copyText,
          label: boundPhone.smsKey ? '接码凭证(Key)' : '绑定手机号',
          urlOpened: true,
          copySucceeded,
        });
      } else {
        setCopiedToast({ text: null, label: '接码页面', urlOpened: true });
      }
    } else {
      fetchCode('sms', acc, boundPhone);
    }
  };

  // 搜索和统计逻辑
  const filteredAccounts = validAccounts.filter(acc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const boundPhone = data.phones.find(p => p.boundAccountId === acc.id);
    return (
      (acc.site && acc.site.toLowerCase().includes(q)) ||
      (acc.username && acc.username.toLowerCase().includes(q)) ||
      (acc.note && acc.note.toLowerCase().includes(q)) ||
      (boundPhone && boundPhone.number.includes(q))
    );
  });

  const expiringCount = validAccounts.filter(a => {
    if (!a.expireDate) return false;
    const msDiff = new Date(a.expireDate).getTime() - new Date().getTime();
    return msDiff < 3 * 24 * 60 * 60 * 1000;
  }).length;

  const boundValidPhonesCount = validAccounts.filter(a => data.phones.some(p => p.boundAccountId === a.id && !isInvalid(p))).length;
  const boundExpiredPhonesCount = validAccounts.filter(a => data.phones.some(p => p.boundAccountId === a.id && isInvalid(p))).length;
  const idlePhones = data.phones.filter(p => !p.boundAccountId && !isInvalid(p));

  return (
    <div className="pb-16 relative">
      <h1 className="sr-only">账号资源</h1>
      {/* 全局醒目 Toast 提示条 (消除跳转页面与复制动作的信息断层) */}
      {copiedToast && (
        <div className={`fixed top-20 right-6 z-50 max-w-md bg-panel/95 backdrop-blur-md border rounded-xl p-3.5 shadow-xl flex items-start gap-3 transition-all duration-200 ${copiedToast.text && !copiedToast.copySucceeded ? 'border-amber-500/50' : 'border-emerald-500/40'}`}>
          <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${copiedToast.text && !copiedToast.copySucceeded ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
            {copiedToast.text && !copiedToast.copySucceeded ? <Copy size={16} /> : <Check size={16} weight="bold" />}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>{copiedToast.urlOpened ? '已在新窗口打开' : '提取成功'}</span>
                {copiedToast.urlOpened && <ArrowSquareOut size={13} className="text-muted-foreground" />}
              </h4>
              <button onClick={() => setCopiedToast(null)} className="text-muted-foreground hover:text-foreground text-xs p-0.5 rounded">✕</button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {copiedToast.text ? (
                copiedToast.copySucceeded ? (
                  <>系统已自动复制 <span className="font-semibold text-foreground">{copiedToast.label}</span>：<span className="font-mono bg-muted/80 px-1.5 py-0.5 rounded text-foreground font-medium select-all">{copiedToast.text}</span></>
                ) : (
                  <>自动复制 <span className="font-semibold text-foreground">{copiedToast.label}</span> 失败，请手动复制：<span className="font-mono bg-muted/80 px-1.5 py-0.5 rounded text-foreground font-medium select-all">{copiedToast.text}</span></>
                )
              ) : (
                <>已成功为您打开 <span className="font-semibold text-foreground">{copiedToast.label}</span>。</>
              )}
            </p>
            {copiedToast.text && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={retryToastCopy}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors flex items-center gap-1 shadow-2xs"
                >
                  {copiedId === 'toast-copy' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedId === 'toast-copy' ? '重新复制成功' : copiedToast.copySucceeded ? '重新复制' : '点击复制'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AccountsHeader
        counts={{
          validAccounts: validAccounts.length,
          expiringAccounts: expiringCount,
          validPhoneBindings: boundValidPhonesCount,
          expiredPhoneBindings: boundExpiredPhonesCount,
          idlePhones: idlePhones.length,
        }}
        search={{
          query: searchQuery,
          onChange: setSearchQuery,
          onClear: () => setSearchQuery(''),
        }}
        view={{ mode: viewMode, onChange: setViewMode }}
        selection={{
          isAdmin,
          selectedCount: selectedIds.length,
          filteredCount: filteredAccounts.length,
          onToggleAll: handleToggleSelectAll,
        }}
        onAddAccount={editor.actions.openAdd}
      />

      <AccountCollection
        state={{
          accounts: filteredAccounts,
          phones: data.phones,
          viewMode,
          selectedIds,
          isAdmin,
          copiedId,
          showPasswordId,
          codeResult,
          fetchingCodeFor,
        }}
        actions={{
          toggleSelect: handleToggleSelect,
          toggleSelectAll: handleToggleSelectAll,
          viewAccount: editor.actions.openView,
          openPhoneBinding: phoneBinding.actions.open,
          archiveAccount: markArchived,
          deleteAccount: handleDelete,
          copyValue: copyToClipboard,
          togglePassword: (accountId) => {
            setShowPasswordId((currentId) => currentId === accountId ? null : accountId);
          },
          checkEmail: handleCheckEmail,
          checkTwoFactor: handleCheck2Fa,
          checkSms: handleCheckSms,
          dismissCodeResult: () => setCodeResult(null),
          refreshTwoFactor: async (result) => {
            try {
              const { otp, expires } = await TOTP.generate(result.twoFaKey);
              setCodeResult((currentResult) => ({
                ...currentResult,
                type: 'code',
                code: otp,
                expires,
              }));
              copyToClipboard(otp, result.id);
            } catch {}
          },
        }}
      />

      {filteredAccounts.length === 0 && (
        <EmptyState
          icon={<SquaresFour size={20} />}
          title={searchQuery ? '没有匹配的账号' : '还没有有效账号'}
          description={searchQuery ? '尝试缩短关键词，或检查账号、站点、手机号和备注内容。' : '账号添加后会显示在这里，并自动汇总绑定和到期状态。'}
          action={!searchQuery && isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={editor.actions.openAdd}>
              <Plus size={15} weight="bold" />
              添加账号
            </button>
          ) : null}
        />
      )}

      {isAdmin && selectedIds.length > 0 && (
        <AccountsSelectionDock
          selectedCount={selectedIds.length}
          filteredCount={filteredAccounts.length}
          onToggleAll={handleToggleSelectAll}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
          onClear={() => setSelectedIds([])}
        />
      )}

      {isAdmin && (
        <button
          onClick={editor.actions.openAdd}
          className="fixed bottom-6 right-6 z-40 bg-foreground text-background shadow-xl hover:shadow-2xl rounded-full px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all duration-200 group"
          title="滑动再深也能随时点击添加"
        >
          <Plus size={20} weight="bold" className="group-hover:rotate-90 transition-transform duration-300" />
          <span>添加账号</span>
        </button>
      )}

      {editor.state.isOpen && editor.state.mode === 'view' && editor.state.account.id ? (
        <AccountDetailModal
          account={editor.state.account}
          isOpen={true}
          onClose={editor.actions.close}
          readOnly={!isAdmin}
          onEdit={editor.actions.switchToEdit}
          onBindPhone={(accId) => {
            editor.actions.close();
            phoneBinding.actions.open(accId);
          }}
          onShowAlert={(msg) => setDialog({ isOpen: true, type: 'alert', message: msg })}
        />
      ) : editor.state.isOpen && (
        <AccountEditorDialog {...editor} />
      )}

      {/* 手机绑定弹窗 BindPhoneModal */}
      <AccountPhoneBindingDialog data={data} {...phoneBinding} />

      <PhoneAccountHistoryModal
        phone={phoneBinding.state.historyPhone}
        history={phoneBinding.state.phoneAccountHistory}
        accounts={data.accounts}
        isOpen={!!phoneBinding.state.historyPhone && !phoneBinding.state.historyAccountDetail}
        onClose={phoneBinding.actions.closeHistory}
        onViewAccount={phoneBinding.actions.viewHistoryAccount}
      />

      <AccountDetailModal
        account={phoneBinding.state.historyAccountDetail}
        phones={data.phones}
        isOpen={!!phoneBinding.state.historyAccountDetail}
        onClose={phoneBinding.actions.closeHistoryAccount}
        readOnly={true}
        onShowAlert={(message) => setDialog({ isOpen: true, type: 'alert', message })}
      />

      <CustomDialog
        {...dialog}
        onConfirm={() => {
          if (dialog.onConfirm) dialog.onConfirm();
          setDialog({ isOpen: false });
        }}
        onCancel={() => setDialog({ isOpen: false })}
      />
</div>
  );
}
