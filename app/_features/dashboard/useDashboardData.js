'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeDataPayload } from './dashboardData';

function requiresAuthentication(response, payload) {
  return response.status === 401 || (
    response.status === 403 && payload.code === 'PASSWORD_CHANGE_REQUIRED'
  );
}

export default function useDashboardData({
  status,
  isAdmin,
  onUnauthorized,
  onDialogChange,
}) {
  const [data, setData] = useState(normalizeDataPayload());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const dataSessionEpochRef = useRef(0);
  const activeDataRequestRef = useRef(null);

  const invalidateDataSession = useCallback(() => {
    dataSessionEpochRef.current += 1;
    activeDataRequestRef.current?.controller.abort();
    activeDataRequestRef.current = null;
  }, []);

  const handleDataUnauthorized = useCallback((payload) => {
    invalidateDataSession();
    setData(normalizeDataPayload());
    setLoading(true);
    setLoadError('');
    onDialogChange({ isOpen: false });
    onUnauthorized(payload?.code ?? payload);
  }, [invalidateDataSession, onDialogChange, onUnauthorized]);

  const loadData = useCallback(async () => {
    activeDataRequestRef.current?.controller.abort();
    const request = {
      controller: new AbortController(),
      epoch: dataSessionEpochRef.current,
    };
    activeDataRequestRef.current = request;
    const isCurrentRequest = () => (
      activeDataRequestRef.current === request
      && dataSessionEpochRef.current === request.epoch
      && !request.controller.signal.aborted
    );

    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/data', { signal: request.controller.signal });
      if (!isCurrentRequest()) return;
      const json = await res.json();
      if (!isCurrentRequest()) return;
      if (requiresAuthentication(res, json)) {
        handleDataUnauthorized(json);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(normalizeDataPayload(json));
    } catch (err) {
      if (err.name === 'AbortError' || !isCurrentRequest()) return;
      console.error('加载账号数据失败:', err);
      setLoadError('数据加载失败，请检查服务状态后重试。');
    } finally {
      if (isCurrentRequest()) {
        activeDataRequestRef.current = null;
        setLoading(false);
      }
    }
  }, [handleDataUnauthorized]);

  useEffect(() => {
    if (status !== 'authenticated') {
      invalidateDataSession();
      setData(normalizeDataPayload());
      onDialogChange({ isOpen: false });
      return undefined;
    }
    loadData();
    return invalidateDataSession;
  }, [invalidateDataSession, loadData, onDialogChange, status]);

  const handleDataChange = useCallback(async (newData) => {
    if (!isAdmin) {
      onDialogChange({
        isOpen: true,
        type: 'alert',
        message: '权限不足：当前账号为只读成员，无法执行增删改操作',
      });
      loadData();
      return;
    }

    const mutationEpoch = dataSessionEpochRef.current;
    const isCurrentMutation = () => dataSessionEpochRef.current === mutationEpoch;
    setData(newData);
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      const responsePayload = await res.json().catch(() => ({}));
      if (!isCurrentMutation()) return;
      if (requiresAuthentication(res, responsePayload)) {
        handleDataUnauthorized(responsePayload);
        return;
      }
      if (!res.ok) {
        onDialogChange({
          isOpen: true,
          type: 'alert',
          message: responsePayload.error || '保存失败，请检查网络或管理员认证状态',
        });
        loadData();
      } else if (responsePayload.data) {
        setData(normalizeDataPayload(responsePayload.data));
      }
    } catch (err) {
      if (!isCurrentMutation()) return;
      console.error('保存数据发生错误:', err);
      onDialogChange({ isOpen: true, type: 'alert', message: '保存数据发生异常' });
      loadData();
    }
  }, [handleDataUnauthorized, isAdmin, loadData, onDialogChange]);

  const prepareLogout = useCallback(() => {
    invalidateDataSession();
    setData(normalizeDataPayload());
    setLoading(true);
    setLoadError('');
    onDialogChange({ isOpen: false });
  }, [invalidateDataSession, onDialogChange]);

  return {
    state: { data, loading, loadError },
    actions: {
      load: loadData,
      change: handleDataChange,
      handleUnauthorized: handleDataUnauthorized,
      prepareLogout,
    },
  };
}
