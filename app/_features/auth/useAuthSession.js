"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

function safeErrorMessage(response, payload, fallback) {
  if (response.status === 401 && payload?.code === 'INVALID_CREDENTIALS') {
    return '用户名或密码不正确';
  }
  if (payload?.code === 'INVALID_CURRENT_PASSWORD') {
    return payload.error || '当前密码不正确';
  }
  if (response.status === 429) return payload?.error || '登录尝试过于频繁，请稍后再试';
  if (response.status === 400) return payload?.error || fallback;
  return fallback;
}

export default function useAuthSession() {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const logoutInFlightRef = useRef(false);
  const sessionExpiryTimerRef = useRef(null);
  const expiresAtRef = useRef(null);
  const authOperationEpochRef = useRef(0);
  const activeAuthRequestRef = useRef(null);

  const beginAuthOperation = useCallback(() => {
    authOperationEpochRef.current += 1;
    activeAuthRequestRef.current?.controller.abort();
    const operation = {
      epoch: authOperationEpochRef.current,
      controller: new AbortController(),
    };
    activeAuthRequestRef.current = operation;
    return operation;
  }, []);

  const isCurrentAuthOperation = useCallback((operation) => (
    activeAuthRequestRef.current === operation
    && authOperationEpochRef.current === operation.epoch
    && !operation.controller.signal.aborted
  ), []);

  const finishAuthOperation = useCallback((operation) => {
    if (activeAuthRequestRef.current === operation) activeAuthRequestRef.current = null;
  }, []);

  const invalidateAuthOperations = useCallback(() => {
    authOperationEpochRef.current += 1;
    activeAuthRequestRef.current?.controller.abort();
    activeAuthRequestRef.current = null;
  }, []);

  const clearSessionExpiry = useCallback(() => {
    if (sessionExpiryTimerRef.current !== null) {
      clearTimeout(sessionExpiryTimerRef.current);
      sessionExpiryTimerRef.current = null;
    }
    expiresAtRef.current = null;
  }, []);

  const handleUnauthorized = useCallback((code) => {
    invalidateAuthOperations();
    clearSessionExpiry();
    if (code === 'PASSWORD_CHANGE_REQUIRED') {
      setUser((currentUser) => (
        currentUser ? { ...currentUser, mustChangePassword: true } : null
      ));
      setError('请先修改临时密码');
      setStatus('password-change-required');
      return;
    }
    setUser(null);
    setError('登录状态已失效，请重新登录');
    setStatus('anonymous');
  }, [clearSessionExpiry, invalidateAuthOperations]);

  const acceptUser = useCallback((nextUser, expiresAt) => {
    clearSessionExpiry();
    const expiryTime = Date.parse(expiresAt);
    if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
      handleUnauthorized();
      return false;
    }
    expiresAtRef.current = expiresAt;
    sessionExpiryTimerRef.current = setTimeout(
      () => handleUnauthorized(),
      expiryTime - Date.now(),
    );
    setUser(nextUser);
    setError('');
    setStatus(nextUser.mustChangePassword ? 'password-change-required' : 'authenticated');
    return true;
  }, [clearSessionExpiry, handleUnauthorized]);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          setUser(null);
          setError('');
          setStatus('anonymous');
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        acceptUser(payload.user, payload.expiresAt);
      } catch (requestError) {
        if (requestError.name === 'AbortError') return;
        setUser(null);
        setError('暂时无法验证登录状态，请稍后重试');
        setStatus('anonymous');
      }
    }

    checkSession();
    return () => controller.abort();
  }, [acceptUser]);

  useEffect(() => () => {
    clearSessionExpiry();
    invalidateAuthOperations();
  }, [clearSessionExpiry, invalidateAuthOperations]);

  const login = useCallback(async ({ username, password }) => {
    if (logoutInFlightRef.current) {
      setError('正在退出，请稍后再试');
      return false;
    }
    const operation = beginAuthOperation();
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: operation.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrentAuthOperation(operation)) return false;
      if (!response.ok) {
        setError(safeErrorMessage(response, payload, '登录失败，请稍后重试'));
        return false;
      }
      return acceptUser(payload.user, payload.expiresAt);
    } catch (requestError) {
      if (requestError.name === 'AbortError' || !isCurrentAuthOperation(operation)) return false;
      setError('登录失败，请稍后重试');
      return false;
    } finally {
      finishAuthOperation(operation);
    }
  }, [acceptUser, beginAuthOperation, finishAuthOperation, isCurrentAuthOperation]);

  const logout = useCallback(async () => {
    if (logoutInFlightRef.current) return false;
    logoutInFlightRef.current = true;
    const operation = beginAuthOperation();
    const previousUser = user;
    const previousExpiresAt = expiresAtRef.current;
    clearSessionExpiry();
    setError('');
    setStatus('checking');
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        signal: operation.controller.signal,
      });
      if (!isCurrentAuthOperation(operation)) return false;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setUser(null);
      setStatus('anonymous');
      return true;
    } catch (requestError) {
      if (requestError.name === 'AbortError' || !isCurrentAuthOperation(operation)) return false;
      acceptUser(previousUser, previousExpiresAt);
      setError('退出失败，请稍后重试');
      return false;
    } finally {
      finishAuthOperation(operation);
      logoutInFlightRef.current = false;
    }
  }, [
    acceptUser,
    beginAuthOperation,
    clearSessionExpiry,
    finishAuthOperation,
    isCurrentAuthOperation,
    user,
  ]);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const operation = beginAuthOperation();
    setError('');
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
        signal: operation.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrentAuthOperation(operation)) return false;
      if (response.status === 401 && payload.code === 'UNAUTHENTICATED') {
        handleUnauthorized(payload.code);
        return false;
      }
      if (!response.ok) {
        setError(safeErrorMessage(response, payload, '密码修改失败，请稍后重试'));
        return false;
      }
      return acceptUser(payload.user, payload.expiresAt);
    } catch (requestError) {
      if (requestError.name === 'AbortError' || !isCurrentAuthOperation(operation)) return false;
      setError('密码修改失败，请稍后重试');
      return false;
    } finally {
      finishAuthOperation(operation);
    }
  }, [
    acceptUser,
    beginAuthOperation,
    finishAuthOperation,
    handleUnauthorized,
    isCurrentAuthOperation,
  ]);

  return {
    status,
    user,
    error,
    login,
    logout,
    changePassword,
    handleUnauthorized,
  };
}
