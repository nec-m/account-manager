"use client";

import { useEffect, useId, useRef } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function useDialogA11y({
  isOpen,
  onClose,
  dialogRef,
  initialFocusRef,
}) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;

    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = dialog?.querySelector(focusableSelector);
      (initialFocusRef?.current || firstFocusable || dialog)?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const focusableElements = [...dialog.querySelectorAll(focusableSelector)]
        .filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [dialogRef, initialFocusRef, isOpen]);

  return {
    ref: dialogRef,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    tabIndex: -1,
    titleId,
  };
}
