'use client';

import { useState } from 'react';
import { isInvalid, toggleListItem } from '@/lib/utils';
import CustomDialog from '../../_components/CustomDialog';
import AccountDetailModal from '../accounts/AccountDetailModal';
import InvalidAccountsSection from './InvalidAccountsSection';
import InvalidPhonesSection from './InvalidPhonesSection';

export default function InvalidView({ data, onChange, isAdmin = false }) {
  const [dialog, setDialog] = useState({ isOpen: false });
  const [viewDetailModal, setViewDetailModal] = useState({ isOpen: false, account: null });
  const [selectedAccIds, setSelectedAccIds] = useState([]);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState([]);

  const invalidAccounts = data.accounts.filter(isInvalid);
  const invalidPhones = data.phones.filter(isInvalid);

  const handleToggleAccSelect = (id) => {
    setSelectedAccIds((current) => toggleListItem(current, id));
  };

  const handleToggleAccSelectAll = () => {
    if (selectedAccIds.length === invalidAccounts.length && invalidAccounts.length > 0) {
      setSelectedAccIds([]);
    } else {
      setSelectedAccIds(invalidAccounts.map((account) => account.id));
    }
  };

  const handleTogglePhoneSelect = (id) => {
    setSelectedPhoneIds((current) => toggleListItem(current, id));
  };

  const handleTogglePhoneSelectAll = () => {
    if (selectedPhoneIds.length === invalidPhones.length && invalidPhones.length > 0) {
      setSelectedPhoneIds([]);
    } else {
      setSelectedPhoneIds(invalidPhones.map((phone) => phone.id));
    }
  };

  const handleBatchRestoreAccounts = () => {
    if (selectedAccIds.length === 0) return;
    const count = selectedAccIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `确定要批量重新激活选中的 ${count} 个账号吗？\n状态将重置为“使用中”（如果已过期请及时修改到期日）。`,
      onConfirm: () => {
        const selectedSet = new Set(selectedAccIds);
        const newAccounts = data.accounts.map((account) => (
          selectedSet.has(account.id) ? { ...account, status: 'active' } : account
        ));
        onChange({ ...data, accounts: newAccounts });
        setSelectedAccIds([]);
      },
    });
  };

  const handleBatchDeleteAccounts = () => {
    if (selectedAccIds.length === 0) return;
    const count = selectedAccIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `⚠️ 确定彻底删除选中的 ${count} 个账号吗？此操作不可逆！`,
      danger: true,
      onConfirm: () => {
        const selectedSet = new Set(selectedAccIds);
        const newAccounts = data.accounts.filter((account) => !selectedSet.has(account.id));
        const newPhones = data.phones.map((phone) => (
          selectedSet.has(phone.boundAccountId) ? { ...phone, boundAccountId: null } : phone
        ));
        onChange({ ...data, accounts: newAccounts, phones: newPhones });
        setSelectedAccIds([]);
      },
    });
  };

  const handleBatchRestorePhones = () => {
    if (selectedPhoneIds.length === 0) return;
    const count = selectedPhoneIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `确定要批量重新激活选中的 ${count} 个手机号吗？\n状态将重置为“使用中”。`,
      onConfirm: () => {
        const selectedSet = new Set(selectedPhoneIds);
        const newPhones = data.phones.map((phone) => (
          selectedSet.has(phone.id) ? { ...phone, status: 'active' } : phone
        ));
        onChange({ ...data, phones: newPhones });
        setSelectedPhoneIds([]);
      },
    });
  };

  const handleBatchDeletePhones = () => {
    if (selectedPhoneIds.length === 0) return;
    const count = selectedPhoneIds.length;
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: `⚠️ 确定彻底删除选中的 ${count} 个手机号吗？此操作不可逆！`,
      danger: true,
      onConfirm: () => {
        const selectedSet = new Set(selectedPhoneIds);
        const newPhones = data.phones.filter((phone) => !selectedSet.has(phone.id));
        onChange({ ...data, phones: newPhones });
        setSelectedPhoneIds([]);
      },
    });
  };

  const deleteAccount = (id) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: '确定彻底从系统中删除该账号吗？',
      danger: true,
      onConfirm: () => {
        onChange({
          ...data,
          accounts: data.accounts.filter((account) => account.id !== id),
          phones: data.phones.map((phone) => (
            phone.boundAccountId === id ? { ...phone, boundAccountId: null } : phone
          )),
        });
      },
    });
  };

  const deletePhone = (id) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      message: '确定彻底从系统中删除该手机号吗？',
      danger: true,
      onConfirm: () => {
        onChange({ ...data, phones: data.phones.filter((phone) => phone.id !== id) });
      },
    });
  };

  const restoreAccount = (id) => {
    onChange({
      ...data,
      accounts: data.accounts.map((account) => (
        account.id === id ? { ...account, status: 'active' } : account
      )),
    });
    setDialog({
      isOpen: true,
      type: 'alert',
      message: '账号状态已重置为“使用中”。\n如果它是因为日期过期而进入这里的，请修改一下到期日期。',
    });
  };

  const restorePhone = (id) => {
    onChange({
      ...data,
      phones: data.phones.map((phone) => (
        phone.id === id ? { ...phone, status: 'active' } : phone
      )),
    });
    setDialog({
      isOpen: true,
      type: 'alert',
      message: '手机号状态已重置为“使用中”。',
    });
  };

  return (
    <div>
      <div className="flex flex-col justify-between items-start mb-10 gap-4">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-foreground mb-3">失效与过期资源库</h1>
          <p className="text-muted-foreground">所有已过期的、或被手动停用的账号和手机号</p>
        </div>
      </div>

      <InvalidAccountsSection
        accounts={invalidAccounts}
        phones={data.phones}
        selectedIds={selectedAccIds}
        isAdmin={isAdmin}
        onToggle={handleToggleAccSelect}
        onToggleAll={handleToggleAccSelectAll}
        onBatchRestore={handleBatchRestoreAccounts}
        onBatchDelete={handleBatchDeleteAccounts}
        onOpenDetail={(account) => setViewDetailModal({ isOpen: true, account })}
        onRestore={restoreAccount}
        onDelete={deleteAccount}
      />
      <InvalidPhonesSection
        phones={invalidPhones}
        selectedIds={selectedPhoneIds}
        isAdmin={isAdmin}
        onToggle={handleTogglePhoneSelect}
        onToggleAll={handleTogglePhoneSelectAll}
        onBatchRestore={handleBatchRestorePhones}
        onBatchDelete={handleBatchDeletePhones}
        onRestore={restorePhone}
        onDelete={deletePhone}
      />

      {viewDetailModal.isOpen && (
        <AccountDetailModal
          isOpen={viewDetailModal.isOpen}
          account={viewDetailModal.account}
          onClose={() => setViewDetailModal({ isOpen: false, account: null })}
          readOnly={true}
          onShowAlert={(message) => setDialog({ isOpen: true, type: 'alert', message })}
        />
      )}

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
