"use client";

import { useRef, useState } from 'react';

import useDialogA11y from '../../_hooks/useDialogA11y';
import { getDefaultExpireDate, isInvalid } from '@/lib/utils';
import { parseAccountLine } from './accountViewUtils';

export default function useAccountEditor({ data, onChange, onDialogChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('view');
  const [account, setAccount] = useState({
    site: 'OpenAI',
    username: '',
    password: '',
    expireDate: getDefaultExpireDate(),
    twoFaUrl: '',
    twoFaKey: '',
    emailUrl: '',
    emailKey: '',
    note: '',
  });
  const [batchItems, setBatchItems] = useState([]);
  const [smartParseInput, setSmartParseInput] = useState('');
  const [parseFormat, setParseFormat] = useState([]);
  const dialogRef = useRef(null);

  const close = () => setIsOpen(false);
  const dialogA11y = useDialogA11y({
    isOpen: isOpen && !(mode === 'view' && account.id),
    onClose: close,
    dialogRef,
  });

  const openViewDetail = (acc) => {
    const boundPhone = data.phones.find(p => p.boundAccountId === acc.id);
    setAccount({ ...acc, phone: boundPhone ? boundPhone.number : '' });
    setMode('view');
    setIsOpen(true);
  };

  const openEditAcc = (acc) => {
    const boundPhone = data.phones.find(p => p.boundAccountId === acc.id);
    setAccount({ ...acc, phone: boundPhone ? boundPhone.number : '' });
    setMode('edit');
    setIsOpen(true);
  };

  const openAdd = () => {
    setAccount({
      site: 'OpenAI', username: '', password: '', expireDate: getDefaultExpireDate(),
      twoFaUrl: '', twoFaKey: '', emailUrl: '', emailKey: '', phone: '', note: ''
    });
    setBatchItems([]);
    setSmartParseInput('');
    setMode('edit');
    setIsOpen(true);
  };

  const handleSave = (andNext = false) => {
    if(!account.site) {
      onDialogChange({ isOpen: true, type: 'alert', message: "保存失败：请至少选择【账号类型】！" });
      return;
    }

    const proceedSave = () => {
      let newData;
      const accId = account.id || Date.now().toString();
      const saveAcc = { ...account };
      delete saveAcc.phone;

      let updatedPhones = [...data.phones];
      if (account.phone && account.phone.trim()) {
        const existingPhone = updatedPhones.find(p => p.number === account.phone.trim());
        if (existingPhone) {
          updatedPhones = updatedPhones.map(p => {
            if (p.id === existingPhone.id) return { ...p, boundAccountId: accId };
            if (p.boundAccountId === accId) return { ...p, boundAccountId: null };
            return p;
          });
        } else {
          const phoneId = Date.now().toString() + "_p";
          const np = {
            id: phoneId,
            number: account.phone.trim(),
            expireDate: account.expireDate || getDefaultExpireDate(),
            smsUrl: '', smsKey: '', boundAccountId: accId, status: 'active'
          };
          updatedPhones = updatedPhones.map(p => p.boundAccountId === accId ? { ...p, boundAccountId: null } : p);
          updatedPhones.push(np);
        }
      }

      if (account.id) {
        newData = {
          ...data,
          accounts: data.accounts.map(a => a.id === accId ? saveAcc : a),
          phones: account.phone ? updatedPhones : data.phones
        };
      } else {
        newData = {
          ...data,
          accounts: [...data.accounts, { ...saveAcc, id: accId, status: 'active' }],
          phones: account.phone ? updatedPhones : data.phones
        };
      }

      onChange(newData);
      if (account.id) {
        setMode('view');
      } else if (andNext) {
        // 清空单账号独特信息，但精细保留同批次公共参数（密码、2FA地址、邮箱地址、站点、到期日）
        setSmartParseInput('');
        setBatchItems([]);
        setAccount(prev => ({
          ...prev,
          id: undefined,
          username: '',
          twoFaKey: '',
          emailKey: '',
          phone: '',
          note: ''
        }));
      } else {
        setIsOpen(false);
      }
    };

    if (account.username && account.username.trim()) {
      const duplicate = data.accounts.find(a => a.username === account.username.trim() && a.id !== account.id);
      if (duplicate) {
        const statusStr = isInvalid(duplicate) ? '（已失效/停用）' : '（使用中）';
        onDialogChange({
          isOpen: true,
          type: 'confirm',
          message: `系统中已存在相同的账号 [${account.username}] ${statusStr}。\n\n确认要继续保存吗？（建议先检查列表避免重复）`,
          onConfirm: proceedSave
        });
        return;
      }
    }

    proceedSave();
  };

  const handleBatchSave = () => {
    if (!batchItems || batchItems.length === 0) return;

    const validItems = batchItems.filter(item => item.username || item.twoFaKey);
    if (validItems.length === 0) {
      onDialogChange({ isOpen: true, type: 'alert', message: "批量卡密数据中未包含有效的账号或 2FA Key！" });
      return;
    }

    const baseTimestamp = Date.now();
    const newAccountsList = validItems.map((item, idx) => {
      const accId = (baseTimestamp + idx).toString();
      const { phone, ...accData } = item;
      return {
        ...accData,
        id: accId,
        site: item.site || account.site || 'OpenAI',
        password: item.password || account.password || '',
        twoFaUrl: item.twoFaUrl || account.twoFaUrl || '',
        emailUrl: item.emailUrl || account.emailUrl || '',
        expireDate: item.expireDate || account.expireDate || getDefaultExpireDate(),
        status: 'active'
      };
    });

    const newData = {
      ...data,
      accounts: [...data.accounts, ...newAccountsList]
    };

    onChange(newData);
    setBatchItems([]);
    setSmartParseInput('');
    setIsOpen(false);
  };

  const handleSmartParse = (text) => {
    setSmartParseInput(text);
    if (!text.trim()) {
      setBatchItems([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 以表单中已存在的非空值（公共配置）作为缺省补齐参数
    const defaults = {
      password: account.password || '',
      twoFaUrl: account.twoFaUrl || '',
      emailUrl: account.emailUrl || '',
      site: account.site || 'OpenAI',
      expireDate: account.expireDate || getDefaultExpireDate()
    };

    if (lines.length > 1) {
      const batch = lines.map(line => parseAccountLine(line, parseFormat, defaults)).filter(Boolean);
      setBatchItems(batch);
    } else {
      setBatchItems([]);
      const parsed = parseAccountLine(lines[0], parseFormat, defaults);
      if (parsed) {
        setAccount(prev => ({
          ...prev,
          ...parsed,
          // 如果解析出来的字段为空，但之前的表单中填有（比如同批次公共密码/2FA地址），优先保留之前的非空值
          password: parsed.password || prev.password,
          twoFaUrl: parsed.twoFaUrl || prev.twoFaUrl,
          emailUrl: parsed.emailUrl || prev.emailUrl,
          site: prev.site || parsed.site
        }));
      }
    }
  };

  return {
    state: {
      isOpen,
      mode,
      account,
      batchItems,
      smartParseInput,
      parseFormat,
    },
    setters: {
      setAccount,
      setBatchItems,
      setParseFormat,
    },
    actions: {
      openView: openViewDetail,
      openEdit: openEditAcc,
      openAdd,
      close,
      switchToEdit: () => setMode('edit'),
      save: handleSave,
      saveBatch: handleBatchSave,
      parseInput: handleSmartParse,
    },
    dialogA11y,
  };
}
