"use client";

import { useRef, useState } from 'react';
import { ensureHttpProtocol } from '@/lib/utils';
import useDialogA11y from '../../_hooks/useDialogA11y';

export default function usePhoneExtraction({ data, onChange, onDialogChange, onCopy }) {
  const [phone, setPhone] = useState(null);
  const [number, setNumber] = useState('');
  const dialogRef = useRef(null);

  const close = () => setPhone(null);
  const dialogA11y = useDialogA11y({ isOpen: !!phone, onClose: close, dialogRef });

  const open = (targetPhone) => {
    setPhone(targetPhone);
    setNumber('');
    if (targetPhone.smsKey) {
      onCopy(targetPhone.smsKey, targetPhone.id + '-key-extract');
    }
    if (targetPhone.smsUrl) {
      let url = targetPhone.smsUrl;
      if (targetPhone.smsKey && url.includes('[KEY]')) {
        url = url.replace(/\[KEY\]/g, targetPhone.smsKey);
      }
      url = ensureHttpProtocol(url);
      window.open(url, '_blank');
    }
  };

  const save = () => {
    if (!number.trim()) {
      onDialogChange({ isOpen: true, type: 'alert', message: "请输入或粘贴在接码页面生成的手机号码！" });
      return;
    }
    const cleanNum = number.trim();
    const newPhones = data.phones.map((item) => {
      if (item.id === phone.id) {
        return { ...item, number: cleanNum, status: 'active' };
      }
      return item;
    });
    onChange({ ...data, phones: newPhones });
    setPhone(null);
    setNumber('');
    onDialogChange({ isOpen: true, type: 'alert', message: `操作成功！已成功录入提取的手机号：${cleanNum}` });
  };

  return {
    state: { isOpen: !!phone, phone, number },
    setters: { setNumber },
    actions: { open, close, save },
    dialogA11y,
  };
}
