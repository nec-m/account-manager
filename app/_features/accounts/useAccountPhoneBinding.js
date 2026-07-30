"use client";

import { useLayoutEffect, useRef, useState } from 'react';

import useDialogA11y from '../../_hooks/useDialogA11y';
import { findTextSeparator, getDefaultExpireDate, isInvalid } from '@/lib/utils';
import { getPhoneAccountHistoryForPhone } from '@/lib/phoneAccountHistory';
import { getNormalizedSmsUrlTemplates } from '../bindings/smsUrlTemplates';

export default function useAccountPhoneBinding({ data, onChange, onDialogChange }) {
  const [bindAccId, setBindAccId] = useState(null);
  const [bindMode, setBindMode] = useState('new');
  const [historyPhone, setHistoryPhone] = useState(null);
  const [historyAccountDetail, setHistoryAccountDetail] = useState(null);
  const [newPhone, setNewPhone] = useState({
    number: '',
    expireDate: getDefaultExpireDate(),
    smsUrl: '',
    smsKey: '',
    note: '',
  });
  const [phoneParseFormat, setPhoneParseFormat] = useState([]);
  const dialogRef = useRef(null);
  const historyTriggerRef = useRef(null);
  const phoneAccountHistory = data.phoneAccountHistory || [];
  const isBindPhoneDialogOpen = !!bindAccId && !historyPhone && !historyAccountDetail;
  const existingSmsUrls = getNormalizedSmsUrlTemplates(data.phones);

  const closeBindPhoneDialog = () => {
    setHistoryPhone(null);
    setHistoryAccountDetail(null);
    historyTriggerRef.current = null;
    setBindAccId(null);
  };
  const closePhoneAccountHistoryModal = () => {
    setHistoryPhone(null);
    historyTriggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (isBindPhoneDialogOpen && historyTriggerRef.current) {
      historyTriggerRef.current.focus();
    }
  }, [isBindPhoneDialogOpen]);

  const dialogA11y = useDialogA11y({
    isOpen: isBindPhoneDialogOpen,
    onClose: closeBindPhoneDialog,
    dialogRef,
    initialFocusRef: historyTriggerRef,
  });

  const findExistingPhone = (targetPhone) => {
    if (!targetPhone) return null;
    const num = targetPhone.number ? targetPhone.number.trim() : '';
    const url = targetPhone.smsUrl ? targetPhone.smsUrl.trim() : '';
    const key = targetPhone.smsKey ? targetPhone.smsKey.trim() : '';

    return data.phones.find(p => {
      if (isInvalid(p)) return false;
      if (num && p.number && p.number.trim() === num) return true;
      if (key && p.smsKey && p.smsKey.trim() === key) {
        if (!url || !p.smsUrl || url === p.smsUrl || p.smsUrl.includes(url) || url.includes(p.smsUrl)) {
          return true;
        }
      }
      return false;
    });
  };

  // BindPhone Modal handlers
  const openBindPhone = (accId) => {
    setBindAccId(accId);
    const existingPhone = data.phones.find(p => p.boundAccountId === accId);
    if (existingPhone) {
      setBindMode('edit');
      setNewPhone({ ...existingPhone });
    } else {
      const defaultSmsUrl = existingSmsUrls.length > 0 ? existingSmsUrls[0] : '';
      setBindMode('new');
      setNewPhone({ number: '', expireDate: getDefaultExpireDate(), smsUrl: defaultSmsUrl, smsKey: '', note: '' });
    }
    setPhoneParseFormat([]);
  };

  const handleBindPhoneSave = () => {
    if (bindMode === 'new') {
      if (!newPhone.number && !newPhone.smsKey && !newPhone.smsUrl) {
        onDialogChange({ isOpen: true, type: 'alert', message: "请填写手机号码或接码凭证地址！" });
        return;
      }

      const existingActive = findExistingPhone(newPhone);
      if (existingActive) {
        const proceed = () => {
          const newPhones = data.phones.map(p => {
            if (p.id === existingActive.id) {
              const updatedNum = newPhone.number ? newPhone.number.trim() : p.number;
              const updatedStatus = updatedNum ? 'active' : p.status || 'pending';
              return {
                ...p,
                ...newPhone,
                number: updatedNum,
                id: existingActive.id,
                boundAccountId: bindAccId,
                status: updatedStatus
              };
            }
            if (p.boundAccountId === bindAccId) {
              return { ...p, boundAccountId: null };
            }
            return p;
          });
          onChange({ ...data, phones: newPhones });
          closeBindPhoneDialog();
        };

        const targetLabel = existingActive.number || (existingActive.smsKey ? `卡密[${existingActive.smsKey}]` : '已有接码凭证');

        if (existingActive.boundAccountId && existingActive.boundAccountId !== bindAccId) {
          const bindAcc = data.accounts.find(a => a.id === existingActive.boundAccountId);
          const accName = bindAcc ? (bindAcc.username || bindAcc.site) : '未知账号';
          onDialogChange({
            isOpen: true, type: 'confirm', message: `⚠️ 该手机/卡密凭证 (${targetLabel}) 目前正被账号 [${accName}] 使用！\n\n是否确认“抢占”该手机号？（原账号将失去此手机绑定）`,
            onConfirm: proceed
          });
          return;
        } else if (existingActive.boundAccountId === bindAccId) {
          onDialogChange({
            isOpen: true, type: 'confirm', message: `该接码凭证 (${targetLabel}) 已经绑定在当前账号上了。是否要用新输入的信息更新它？`,
            onConfirm: proceed
          });
          return;
        } else {
          const statusText = isInvalid(existingActive) ? '（已失效/过期）' : '（闲置状态）';
          onDialogChange({
            isOpen: true, type: 'confirm', message: `该接码凭证 (${targetLabel}) 已在号池中${statusText}，是否直接复用已有记录进行绑定？`,
            onConfirm: proceed
          });
          return;
        }
      }

      const phoneId = Date.now().toString() + "_p";
      const np = {
        id: phoneId,
        number: (newPhone.number || '').trim(),
        expireDate: newPhone.expireDate || getDefaultExpireDate(),
        smsUrl: newPhone.smsUrl || '',
        smsKey: newPhone.smsKey || '',
        note: newPhone.note || '',
        boundAccountId: bindAccId,
        status: !newPhone.number || !newPhone.number.trim() ? 'pending' : 'active'
      };

      const newPhones = data.phones.map(p => p.boundAccountId === bindAccId ? { ...p, boundAccountId: null } : p);
      newPhones.push(np);
      onChange({ ...data, phones: newPhones });
    } else if (bindMode === 'edit') {
      if (!newPhone.number && !newPhone.smsKey && !newPhone.smsUrl) {
        onDialogChange({ isOpen: true, type: 'alert', message: "请填写手机号码或接码凭证！" });
        return;
      }
      const computedStatus = !newPhone.number ? 'pending' : (newPhone.status || 'active');
      const newPhones = data.phones.map(p => p.id === newPhone.id ? { ...newPhone, status: computedStatus } : p);
      onChange({ ...data, phones: newPhones });
    }
    closeBindPhoneDialog();
  };

  const handleBindExistingPhone = (phoneId) => {
    const newPhones = data.phones.map(p => {
      if (p.id === phoneId) return { ...p, boundAccountId: bindAccId };
      if (p.boundAccountId === bindAccId) return { ...p, boundAccountId: null };
      return p;
    });
    onChange({ ...data, phones: newPhones });
    closeBindPhoneDialog();
  };

  const handleUnbindPhone = () => {
    const boundAcc = data.accounts.find(a => a.id === bindAccId);
    const accName = boundAcc ? (boundAcc.username || boundAcc.site) : '当前账号';
    const boundPhone = data.phones.find(p => p.boundAccountId === bindAccId);
    const phoneLabel = boundPhone ? (boundPhone.number || (boundPhone.smsKey ? `卡密[${boundPhone.smsKey}]` : '绑定的接码凭证')) : '手机号';

    onDialogChange({
      isOpen: true,
      type: 'confirm',
      message: `确定要为账号 [${accName}] 解除 ${phoneLabel} 的绑定吗？（解绑后手机号将释放为闲置可用状态）`,
      onConfirm: () => {
        const newPhones = data.phones.map(p => p.boundAccountId === bindAccId ? { ...p, boundAccountId: null } : p);
        onChange({ ...data, phones: newPhones });
        if (bindMode === 'edit') {
          setBindMode('new');
          setNewPhone({ number: '', expireDate: getDefaultExpireDate(), smsUrl: '', smsKey: '' });
        }
      }
    });
  };

  const handlePhoneSmartParse = (text) => {
    if (!text.trim()) return;

    if (phoneParseFormat.length > 0) {
      const separator = findTextSeparator(text, ['----', '---', ',', '|', ' ']);

      let parts = [text];
      if (separator) {
        const normalizedText = text.replace(/\n+/g, separator);
        parts = normalizedText.split(separator).map((part) => part.trim()).filter(Boolean);
      } else {
        parts = text.split(/[\n\s]+/).filter(Boolean);
      }

      const parsed = { ...newPhone };
      for (let i = 0; i < Math.min(parts.length, phoneParseFormat.length); i++) {
        const field = phoneParseFormat[i];
        if (field !== 'ignore' && parts[i]) {
          parsed[field] = parts[i];
        }
      }
      setNewPhone(parsed);
      return;
    }

    const parsed = { ...newPhone };
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch && !parsed.smsUrl) parsed.smsUrl = urlMatch[0];

    const phoneMatch = text.match(/\+\d{1,4}\s?\d{6,14}|\b1[3-9]\d{9}\b/);
    if (phoneMatch && !parsed.number) parsed.number = phoneMatch[0].trim();

    const separator = findTextSeparator(text, ['----', '---', ',']);
    let partsToScan = [];
    if (separator) {
      const normalizedText = text.replace(/\n+/g, separator);
      partsToScan = normalizedText.split(separator).map((part) => part.trim()).filter(Boolean);
    } else {
      partsToScan = text.split(/[\n\s]+/).filter(Boolean);
    }

    if (partsToScan.length >= 2) {
      partsToScan.forEach(p => {
        if (/https?:\/\//.test(p)) parsed.smsUrl = p;
        else if (p.startsWith('+') || /^\d{11}$/.test(p)) parsed.number = p;
        else if (p.length > 3 && !p.includes('http')) {
          if (!parsed.smsKey) parsed.smsKey = p;
        }
      });
    }
    setNewPhone(parsed);
  };


  const getHistoryCount = (phone) => getPhoneAccountHistoryForPhone({
    phoneId: phone.id,
    history: phoneAccountHistory,
    accounts: data.accounts,
  }).length;

  const openHistory = (phone, trigger) => {
    historyTriggerRef.current = trigger;
    setHistoryPhone(phone);
  };

  return {
    state: {
      accountId: bindAccId,
      mode: bindMode,
      phone: newPhone,
      parseFormat: phoneParseFormat,
      isDialogOpen: isBindPhoneDialogOpen,
      historyPhone,
      historyAccountDetail,
      phoneAccountHistory,
      existingSmsUrlTemplates: existingSmsUrls,
    },
    setters: {
      setMode: setBindMode,
      setPhone: setNewPhone,
      setParseFormat: setPhoneParseFormat,
    },
    actions: {
      open: openBindPhone,
      close: closeBindPhoneDialog,
      save: handleBindPhoneSave,
      bindExisting: handleBindExistingPhone,
      unbind: handleUnbindPhone,
      parseInput: handlePhoneSmartParse,
      getHistoryCount,
      openHistory,
      closeHistory: closePhoneAccountHistoryModal,
      viewHistoryAccount: setHistoryAccountDetail,
      closeHistoryAccount: () => setHistoryAccountDetail(null),
    },
    dialogA11y,
  };
}
