'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MEMBER_LIMIT, safeMemberError } from './memberViewUtils';

export default function useMemberManagement({ isOpen, onClose, onUnauthorized }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operation, setOperation] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [username, setUsername] = useState('');
  const [temporaryCredential, setTemporaryCredential] = useState(null);
  const [copied, setCopied] = useState(false);
  const dialogEpochRef = useRef(0);
  const activeMutationRef = useRef(null);
  const mutationInFlightRef = useRef(false);
  const isOpenRef = useRef(isOpen);

  isOpenRef.current = isOpen;

  const clearDialogState = useCallback(() => {
    setMembers([]);
    setLoading(false);
    setOperation('');
    setTemporaryCredential(null);
    setCopied(false);
    setShowCreateForm(false);
    setUsername('');
    setError('');
  }, []);

  const closeDialog = useCallback(() => {
    dialogEpochRef.current += 1;
    activeMutationRef.current = null;
    mutationInFlightRef.current = false;
    clearDialogState();
    onClose();
  }, [clearDialogState, onClose]);

  const close = useCallback(() => {
    if (mutationInFlightRef.current) return;
    closeDialog();
  }, [closeDialog]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    const epoch = dialogEpochRef.current + 1;
    dialogEpochRef.current = epoch;
    activeMutationRef.current = null;
    mutationInFlightRef.current = false;

    setMembers([]);
    setLoading(true);
    setError('');
    setOperation('');
    setShowCreateForm(false);
    setUsername('');
    setTemporaryCredential(null);
    setCopied(false);

    const isCurrentDialog = () => (
      isOpenRef.current
      && dialogEpochRef.current === epoch
      && !controller.signal.aborted
    );

    async function loadMembers() {
      try {
        const response = await fetch('/api/members', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!isCurrentDialog()) return;
        if (response.status === 401) {
          onUnauthorized();
          closeDialog();
          return;
        }
        if (!response.ok) {
          setError(safeMemberError(response, payload, '成员列表加载失败，请稍后重试'));
          return;
        }
        setMembers(Array.isArray(payload.members) ? payload.members : []);
      } catch (requestError) {
        if (requestError.name !== 'AbortError' && isCurrentDialog()) {
          setError('成员列表加载失败，请稍后重试');
        }
      } finally {
        if (isCurrentDialog()) setLoading(false);
      }
    }

    loadMembers();
    return () => {
      controller.abort();
      if (dialogEpochRef.current === epoch) dialogEpochRef.current += 1;
      const activeMutation = activeMutationRef.current;
      if (activeMutation?.epoch === epoch) {
        activeMutationRef.current = null;
        mutationInFlightRef.current = false;
      }
    };
  }, [closeDialog, isOpen, onUnauthorized]);

  const beginMutation = (kind, operationName) => {
    if (mutationInFlightRef.current) return null;
    const request = {
      kind,
      operationName,
      epoch: dialogEpochRef.current,
      controller: new AbortController(),
    };
    activeMutationRef.current = request;
    mutationInFlightRef.current = true;
    setOperation(operationName);
    return request;
  };

  const isCurrentMutation = (request) => (
    isOpenRef.current
    && activeMutationRef.current === request
    && dialogEpochRef.current === request.epoch
    && !request.controller.signal.aborted
  );

  const finishMutation = (request) => {
    if (!isCurrentMutation(request)) return;
    activeMutationRef.current = null;
    mutationInFlightRef.current = false;
    setOperation('');
  };

  const handleUnauthorizedResponse = (response, request) => {
    if (!isCurrentMutation(request)) return true;
    if (response.status !== 401) return false;
    activeMutationRef.current = null;
    mutationInFlightRef.current = false;
    setOperation('');
    onUnauthorized();
    closeDialog();
    return true;
  };

  const create = async (event) => {
    event.preventDefault();
    if (members.length >= MEMBER_LIMIT) return;
    const request = beginMutation('create', 'create');
    if (!request) return;
    setError('');
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
        signal: request.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrentMutation(request)) return;
      if (handleUnauthorizedResponse(response, request)) return;
      if (!response.ok) {
        setError(safeMemberError(response, payload, '成员创建失败，请稍后重试'));
        return;
      }
      setMembers((current) => [...current, payload.member]);
      setTemporaryCredential({
        username: payload.member.username,
        password: payload.temporaryPassword,
      });
      setCopied(false);
      setUsername('');
      setShowCreateForm(false);
    } catch (requestError) {
      if (requestError.name !== 'AbortError' && isCurrentMutation(request)) {
        setError('成员创建失败，请稍后重试');
      }
    } finally {
      finishMutation(request);
    }
  };

  const changeStatus = async (member) => {
    const request = beginMutation('status', `status-${member.id}`);
    if (!request) return;
    const status = member.status === 'active' ? 'disabled' : 'active';
    setError('');
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        signal: request.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrentMutation(request)) return;
      if (handleUnauthorizedResponse(response, request)) return;
      if (!response.ok) {
        setError(safeMemberError(response, payload, '成员状态更新失败，请稍后重试'));
        return;
      }
      setMembers((current) => current.map((item) => (
        item.id === payload.member.id ? payload.member : item
      )));
    } catch (requestError) {
      if (requestError.name !== 'AbortError' && isCurrentMutation(request)) {
        setError('成员状态更新失败，请稍后重试');
      }
    } finally {
      finishMutation(request);
    }
  };

  const resetPassword = async (member) => {
    const request = beginMutation('reset', `reset-${member.id}`);
    if (!request) return;
    setError('');
    try {
      const response = await fetch(`/api/members/${member.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: request.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrentMutation(request)) return;
      if (handleUnauthorizedResponse(response, request)) return;
      if (!response.ok) {
        setError(safeMemberError(response, payload, '密码重置失败，请稍后重试'));
        return;
      }
      setMembers((current) => current.map((item) => (
        item.id === payload.member.id ? payload.member : item
      )));
      setTemporaryCredential({
        username: payload.member.username,
        password: payload.temporaryPassword,
      });
      setCopied(false);
    } catch (requestError) {
      if (requestError.name !== 'AbortError' && isCurrentMutation(request)) {
        setError('密码重置失败，请稍后重试');
      }
    } finally {
      finishMutation(request);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryCredential?.password) return;
    try {
      await navigator.clipboard.writeText(temporaryCredential.password);
      setCopied(true);
    } catch {
      setError('复制失败，请手动复制临时密码');
    }
  };

  const openCreate = () => {
    setShowCreateForm(true);
    setTemporaryCredential(null);
    setCopied(false);
    setError('');
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setUsername('');
  };

  return {
    state: {
      members,
      loading,
      error,
      operation,
      showCreateForm,
      username,
      temporaryCredential,
      copied,
    },
    actions: {
      close,
      openCreate,
      cancelCreate,
      setUsername,
      create,
      changeStatus,
      resetPassword,
      copyTemporaryPassword,
    },
  };
}
