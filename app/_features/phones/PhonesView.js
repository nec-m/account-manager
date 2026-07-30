"use client";

import { useState, useEffect } from 'react';
import { DeviceMobile, Plus } from '@phosphor-icons/react';
import CustomDialog from '../../_components/CustomDialog';
import AccountDetailModal from '../accounts/AccountDetailModal';
import PhoneAccountHistoryModal from '../bindings/PhoneAccountHistoryModal';
import EmptyState from '../../_components/EmptyState';
import { isPast } from 'date-fns';
import {
  ensureHttpProtocol,
  getTodayStr,
  isInvalid,
  toggleListItem,
} from '@/lib/utils';
import { getPhoneAccountHistoryForPhone } from '@/lib/phoneAccountHistory';
import PhonesHeader, { PhonesSelectionDock } from './PhonesHeader';
import PhoneCollection from './PhoneCollection';
import PhoneEditorDialog from './PhoneEditorDialog';
import usePhoneEditor from './usePhoneEditor';
import PhoneExtractionDialog from './PhoneExtractionDialog';
import usePhoneExtraction from './usePhoneExtraction';

export default function PhonesView({ data, onChange, isAdmin = false, onUnauthorized }) {
  const [dialog, setDialog] = useState({ isOpen: false });
  const editor = usePhoneEditor({
    data,
    onChange,
    onDialogChange: setDialog,
  });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [searchQuery, setSearchQuery] = useState('');
  const [idleOnly, setIdleOnly] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [viewAccDetail, setViewAccDetail] = useState(null);
  const [historyPhone, setHistoryPhone] = useState(null);

  const [fetchingCodeFor, setFetchingCodeFor] = useState(null);
  const [codeResult, setCodeResult] = useState(null);
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

  const extraction = usePhoneExtraction({
    data,
    onChange,
    onDialogChange: setDialog,
    onCopy: copyToClipboard,
  });

  const validPhones = data.phones.filter(p => !isInvalid(p));

  const getHistoryCount = (phone) => getPhoneAccountHistoryForPhone({
    phoneId: phone.id,
    history: data.phoneAccountHistory || [],
    accounts: data.accounts,
  }).length;

  const openAccountDetail = (account, phone) => {
    setViewAccDetail({ ...account, phone: phone?.number });
  };

  const bindPhone = (phoneId, accId) => {
    const newPhones = data.phones.map(p => {
      if (p.id === phoneId) return { ...p, boundAccountId: accId };
      if (p.boundAccountId === accId) return { ...p, boundAccountId: null };
      return p;
    });
    onChange({ ...data, phones: newPhones });
  };

  const unbindPhone = (phoneId) => {
    const targetPhone = data.phones.find(p => p.id === phoneId);
    const boundAcc = targetPhone ? data.accounts.find(a => a.id === targetPhone.boundAccountId) : null;
    const accName = boundAcc ? (boundAcc.username || boundAcc.site) : '关联账号';
    const label = targetPhone ? (targetPhone.number || (targetPhone.smsKey ? `卡密[${targetPhone.smsKey}]` : '该手机/卡密')) : '该手机号';

    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `确定要为 ${label} 解除与账号 [${accName}] 的绑定吗？（解绑后该手机号将释放为闲置可用状态）`,
      onConfirm: () => {
        const newPhones = data.phones.map(p => p.id === phoneId ? { ...p, boundAccountId: null } : p);
        onChange({ ...data, phones: newPhones });
      }
    });
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((current) => toggleListItem(current, id));
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredPhones.length && filteredPhones.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPhones.map(p => p.id));
    }
  };

  const handleBatchArchive = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `确定要批量停用选中的 ${count} 个手机号吗？\n（停用后它们将解绑账号并移至“失效与停用”库）`,
      onConfirm: () => {
        const selectedSet = new Set(selectedIds);
        const newPhones = data.phones.map(p => selectedSet.has(p.id) ? { ...p, status: 'archived', boundAccountId: null } : p);
        onChange({ ...data, phones: newPhones });
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
      message: `⚠️ 确定彻底删除选中的 ${count} 个手机号吗？此操作不可逆！`,
      danger: true,
      onConfirm: () => {
        const selectedSet = new Set(selectedIds);
        const newPhones = data.phones.filter(p => !selectedSet.has(p.id));
        onChange({ ...data, phones: newPhones });
        setSelectedIds([]);
      }
    });
  };

  const markArchived = (id) => {
    setDialog({
      isOpen: true, type: 'confirm', message: '确定要停用该手机号吗？（停用后它将被归档）',
      onConfirm: () => {
        const newPhones = data.phones.map(p => p.id === id ? { ...p, status: 'archived', boundAccountId: null } : p);
        onChange({ ...data, phones: newPhones });
      }
    });
  };

  const handleDelete = (id) => {
    setDialog({
      isOpen: true, type: 'confirm', message: '确定彻底删除该手机号吗？', danger: true,
      onConfirm: () => {
        const newPhones = data.phones.filter(p => p.id !== id);
        onChange({ ...data, phones: newPhones });
      }
    });
  };

  const fetchCode = async (phone) => {
    setFetchingCodeFor(phone.id);
    setCodeResult(null);
    try {
      if (phone.smsUrl && !phone.smsUrl.includes('/api/')) {
        let url = phone.smsUrl;
        let copyText = phone.smsKey || phone.number;
        if (url.includes('[KEY]') && phone.smsKey) {
          url = url.replace(/\[KEY\]/g, phone.smsKey);
        } else if (url.includes('[PHONE]') && phone.number) {
          url = url.replace(/\[PHONE\]/g, phone.number);
        }
        url = ensureHttpProtocol(url);

        window.open(url, '_blank');
        if (copyText) {
          const copySucceeded = await copyToClipboard(copyText, phone.id);
          setCodeResult({ id: phone.id, type: 'notice', rawText: copyText, copySucceeded });
        }
        setFetchingCodeFor(null);
        return;
      }

      const res = await fetch('/api/fetch-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: 'sms', phone: phone })
      });
      const json = await res.json();

      if (res.status === 401 || (res.status === 403 && json.code === 'PASSWORD_CHANGE_REQUIRED')) {
        setFetchingCodeFor(null);
        setCodeResult(null);
        setCopiedId(null);
        editor.actions.close();
        setViewAccDetail(null);
        setHistoryPhone(null);
        extraction.actions.close();
        setDialog({ isOpen: false });
        onUnauthorized?.(json);
        return;
      }

      setFetchingCodeFor(null);
      if (res.ok) {
        setCodeResult({ id: phone.id, type: 'code', code: json.code });
      } else {
        setDialog({ isOpen: true, type: 'alert', message: json.error || json.details || '获取失败' });
      }
    } catch (err) {
      setFetchingCodeFor(null);
      setDialog({ isOpen: true, type: 'alert', message: "请求失败" });
    }
  };

  // 过滤与统计逻辑
  const filteredPhones = validPhones.filter(p => {
    const boundAcc = data.accounts.find(a => a.id === p.boundAccountId);
    if (idleOnly && p.boundAccountId) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.number.includes(q) ||
      (p.note && p.note.toLowerCase().includes(q)) ||
      (boundAcc && (
        (boundAcc.site && boundAcc.site.toLowerCase().includes(q)) ||
        (boundAcc.username && boundAcc.username.toLowerCase().includes(q))
      ))
    );
  });

  const idlePhonesCount = validPhones.filter(p => !p.boundAccountId).length;
  const boundPhonesCount = validPhones.filter(p => p.boundAccountId).length;
  const expiringCount = validPhones.filter(p => {
    if (!p.expireDate) return false;
    const msDiff = new Date(p.expireDate).getTime() - new Date().getTime();
    return msDiff < 3 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="pb-16 relative">
      <h1 className="sr-only">手机号资源</h1>
      <PhonesHeader
        counts={{
          validPhones: validPhones.length,
          idlePhones: idlePhonesCount,
          boundPhones: boundPhonesCount,
          expiringPhones: expiringCount,
        }}
        search={{
          query: searchQuery,
          onChange: setSearchQuery,
          onClear: () => setSearchQuery(''),
        }}
        filter={{
          idleOnly,
          onToggleIdle: () => setIdleOnly((current) => !current),
        }}
        view={{ mode: viewMode, onChange: setViewMode }}
        selection={{
          isAdmin,
          selectedCount: selectedIds.length,
          filteredCount: filteredPhones.length,
          onToggleAll: handleToggleSelectAll,
        }}
        onAddPhone={editor.actions.openAdd}
      />

      <PhoneCollection
        state={{
          phones: filteredPhones,
          accounts: data.accounts,
          viewMode,
          selectedIds,
          isAdmin,
          copiedId,
          codeResult,
          fetchingCodeFor,
        }}
        actions={{
          toggleSelect: handleToggleSelect,
          toggleSelectAll: handleToggleSelectAll,
          editPhone: editor.actions.openEdit,
          viewAccount: openAccountDetail,
          openHistory: setHistoryPhone,
          getHistoryCount,
          extractPhone: extraction.actions.open,
          copyValue: copyToClipboard,
          fetchCode,
          bindPhone,
          unbindPhone,
          archivePhone: markArchived,
          deletePhone: handleDelete,
          dismissCodeResult: () => setCodeResult(null),
        }}
      />

      {/* Taste 极客级悬浮灵动控制舱 Dynamic Floating Action Dock */}
      {isAdmin && selectedIds.length > 0 && (
        <PhonesSelectionDock
          selectedCount={selectedIds.length}
          filteredCount={filteredPhones.length}
          onToggleAll={handleToggleSelectAll}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
          onClear={() => setSelectedIds([])}
        />
      )}

      {filteredPhones.length === 0 && (
        <EmptyState
          icon={<DeviceMobile size={20} />}
          title={searchQuery ? '没有匹配的手机号' : '还没有有效手机号'}
          description={searchQuery ? '尝试缩短关键词，或检查手机号、绑定账号和备注内容。' : '手机号录入后会显示在这里，并自动汇总绑定和到期状态。'}
          action={!searchQuery && isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={editor.actions.openAdd}>
              <Plus size={15} weight="bold" />
              录入号码
            </button>
          ) : null}
        />
      )}

      {isAdmin && (
        <button
          onClick={editor.actions.openAdd}
          className="fixed bottom-6 right-6 z-40 bg-foreground text-background shadow-xl hover:shadow-2xl rounded-full px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all duration-200 group"
          title="滑动再深也能随时点击录入"
        >
          <Plus size={20} weight="bold" className="group-hover:rotate-90 transition-transform duration-300" />
          <span>录入号码</span>
        </button>
      )}

      <PhoneEditorDialog {...editor} />

      {/* 提取手机号快捷录入弹窗 */}
      <PhoneExtractionDialog {...extraction} />

      {/* 关联账号只读详情弹窗 */}
      <AccountDetailModal
        account={viewAccDetail}
        phones={data.phones}
        isOpen={!!viewAccDetail}
        onClose={() => setViewAccDetail(null)}
        readOnly={true}
        onShowAlert={(msg) => setDialog({ isOpen: true, type: 'alert', message: msg })}
      />

      <PhoneAccountHistoryModal
        phone={historyPhone}
        history={data.phoneAccountHistory || []}
        accounts={data.accounts}
        isOpen={!!historyPhone && !viewAccDetail}
        onClose={() => setHistoryPhone(null)}
        onViewAccount={(account) => openAccountDetail(account, historyPhone)}
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
