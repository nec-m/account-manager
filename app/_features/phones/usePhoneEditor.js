"use client";

import { useRef, useState } from 'react';
import { getDefaultExpireDate, isInvalid } from '@/lib/utils';
import useDialogA11y from '../../_hooks/useDialogA11y';
import { getNormalizedSmsUrlTemplates } from '../bindings/smsUrlTemplates';
import {
  parsePhoneBatch,
  parsePhoneLine,
} from './phoneViewUtils';

function mergeNotes(existingNote, nextNote) {
  if (!nextNote) return existingNote;
  if (!existingNote) return nextNote;
  return `${existingNote}; ${nextNote}`;
}

export default function usePhoneEditor({ data, onChange, onDialogChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState('single');
  const [newPhone, setNewPhone] = useState({
    number: '',
    expireDate: getDefaultExpireDate(),
    smsUrl: '',
    smsKey: '',
    note: '',
  });
  const [parseFormat, setParseFormat] = useState([]);
  const [batchItems, setBatchItems] = useState([]);
  const [batchCommonSmsUrl, setBatchCommonSmsUrl] = useState('');
  const [batchCommonExpireDate, setBatchCommonExpireDate] = useState(getDefaultExpireDate());
  const [batchRawInput, setBatchRawInput] = useState('');
  const dialogRef = useRef(null);

  const existingSmsUrlTemplates = getNormalizedSmsUrlTemplates(data.phones);
  const close = () => setShowAdd(false);
  const dialogA11y = useDialogA11y({
    isOpen: showAdd,
    onClose: close,
    dialogRef,
  });

  const openAdd = () => {
    const defaultSmsUrl = existingSmsUrlTemplates[0] || '';
    setNewPhone({ number: '', expireDate: getDefaultExpireDate(), smsUrl: defaultSmsUrl, smsKey: '', note: '' });
    setBatchCommonSmsUrl(defaultSmsUrl);
    setBatchCommonExpireDate(getDefaultExpireDate());
    setBatchRawInput('');
    setBatchItems([]);
    setAddTab('single');
    setShowAdd(true);
  };

  const findExistingPhone = (targetPhone, currentPhones = data.phones) => {
    if (!targetPhone) return null;
    const num = targetPhone.number ? targetPhone.number.trim() : '';
    const url = targetPhone.smsUrl ? targetPhone.smsUrl.trim() : '';
    const key = targetPhone.smsKey ? targetPhone.smsKey.trim() : '';

    return currentPhones.find(p => {
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

  const save = () => {
    if (!newPhone.number && !newPhone.smsKey && !newPhone.smsUrl) {
      onDialogChange({ isOpen: true, type: 'alert', message: "保存失败：请至少填写【手机号码】或【短信获取地址/凭证】！" });
      return;
    }

    if (!newPhone.id) {
      const existing = findExistingPhone(newPhone);
      if (existing) {
        const updatedNum = newPhone.number ? newPhone.number.trim() : existing.number;
        const updatedStatus = updatedNum ? 'active' : existing.status || 'pending';
        const mergedPhone = {
          ...existing,
          ...newPhone,
          id: existing.id,
          number: updatedNum,
          status: updatedStatus
        };
        const newData = {
          ...data,
          phones: data.phones.map(p => p.id === existing.id ? mergedPhone : p)
        };
        onChange(newData);
        setShowAdd(false);
        const label = updatedNum || existing.smsKey;
        onDialogChange({ isOpen: true, type: 'alert', message: `号池中已存在相同的记录 (${label})，已自动合并更新！` });
        return;
      }
    }

    const computedStatus = !newPhone.number ? 'pending' : (newPhone.status || 'active');
    const phoneToSave = { ...newPhone, status: computedStatus };

    let newData;
    if (newPhone.id) {
      newData = {
        ...data,
        phones: data.phones.map(p => p.id === newPhone.id ? { ...phoneToSave } : p)
      };
    } else {
      const id = Date.now().toString();
      newData = {
        ...data,
        phones: [...data.phones, { ...phoneToSave, id, boundAccountId: null }]
      };
    }
    onChange(newData);
    setShowAdd(false);
  };

  const parseSingle = (text) => {
    const parsed = parsePhoneLine(text, parseFormat, newPhone);
    if (parsed) setNewPhone(parsed);
  };

  const parseBatch = (text, commonSmsUrl = batchCommonSmsUrl, commonExpire = batchCommonExpireDate) => {
    setBatchRawInput(text);
    setBatchItems(parsePhoneBatch(text, parseFormat, {
      smsUrl: commonSmsUrl || '',
      expireDate: commonExpire || getDefaultExpireDate(),
    }));
  };

  const saveBatch = () => {
    const validItems = batchItems.filter(item => (item.number && item.number.trim()) || (item.smsKey && item.smsKey.trim()) || (item.smsUrl && item.smsUrl.trim()));
    if (validItems.length === 0) {
      onDialogChange({ isOpen: true, type: 'alert', message: "批量保存失败：解析列表中未包含有效的【手机号码】或【卡密地址】！" });
      return;
    }

    let currentPhones = [...data.phones];
    let addedCount = 0;
    let mergedCount = 0;
    const baseId = Date.now();

    validItems.forEach((item, index) => {
      const existing = findExistingPhone(item, currentPhones);
      if (existing) {
        const updatedNum = item.number ? item.number.trim() : existing.number;
        const updatedStatus = updatedNum ? 'active' : existing.status || 'pending';
        currentPhones = currentPhones.map(p => {
          if (p.id === existing.id) {
            return {
              ...p,
              smsUrl: item.smsUrl || p.smsUrl,
              smsKey: item.smsKey || p.smsKey,
              expireDate: item.expireDate || p.expireDate,
              note: mergeNotes(p.note, item.note),
              number: updatedNum,
              status: updatedStatus
            };
          }
          return p;
        });
        mergedCount++;
      } else {
        currentPhones.push({
          id: `${baseId}_${index}_p`,
          number: (item.number || '').trim(),
          expireDate: item.expireDate || getDefaultExpireDate(),
          smsUrl: item.smsUrl || '',
          smsKey: item.smsKey || '',
          note: item.note || '',
          boundAccountId: null,
          status: !item.number || !item.number.trim() ? 'pending' : 'active'
        });
        addedCount++;
      }
    });

    const newData = {
      ...data,
      phones: currentPhones
    };

    onChange(newData);
    setShowAdd(false);

    let msg = `成功批量处理 ${validItems.length} 条记录！`;
    if (mergedCount > 0) {
      msg += `（其中新增 ${addedCount} 条，自动识别并合并 ${mergedCount} 条重复卡密记录）`;
    }
    onDialogChange({ isOpen: true, type: 'alert', message: msg });
  };

  const openEdit = (phone) => {
    setNewPhone(phone);
    setShowAdd(true);
  };

  const changeBatchSmsUrl = (value) => {
    setBatchCommonSmsUrl(value);
    if (batchRawInput) parseBatch(batchRawInput, value, batchCommonExpireDate);
  };

  const changeBatchExpireDate = (value) => {
    setBatchCommonExpireDate(value);
    if (batchRawInput) parseBatch(batchRawInput, batchCommonSmsUrl, value);
  };

  const clearBatch = () => {
    setBatchItems([]);
    setBatchRawInput('');
  };

  return {
    state: {
      isOpen: showAdd,
      tab: addTab,
      phone: newPhone,
      parseFormat,
      batchItems,
      batchCommonSmsUrl,
      batchCommonExpireDate,
      batchRawInput,
      existingSmsUrlTemplates,
    },
    setters: {
      setTab: setAddTab,
      setPhone: setNewPhone,
      setParseFormat,
    },
    actions: {
      openAdd,
      openEdit,
      close,
      save,
      saveBatch,
      parseSingle,
      parseBatch,
      changeBatchSmsUrl,
      changeBatchExpireDate,
      clearBatch,
    },
    dialogA11y,
  };
}
