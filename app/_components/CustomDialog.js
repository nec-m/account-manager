import { useRef } from 'react';
import useDialogA11y from '../_hooks/useDialogA11y';

function getDialogTitle(type, danger) {
  if (danger) return '确认危险操作';
  if (type === 'confirm') return '确认操作';
  return '操作提示';
}

export default function CustomDialog({
  isOpen,
  type = 'alert', // 'alert' | 'confirm'
  message = '',
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
  danger = false
}) {
  const dialogRef = useRef(null);
  const handleClose = type === 'confirm' ? onCancel : onConfirm;
  const dialogA11y = useDialogA11y({
    isOpen,
    onClose: handleClose,
    dialogRef,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div
        ref={dialogA11y.ref}
        role={dialogA11y.role}
        aria-modal={dialogA11y['aria-modal']}
        aria-labelledby={dialogA11y['aria-labelledby']}
        tabIndex={dialogA11y.tabIndex}
        className="bg-panel w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6 md:p-8 relative animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={dialogA11y.titleId} className="sr-only">
          {getDialogTitle(type, danger)}
        </h2>
        <div className="mb-6 whitespace-pre-wrap text-foreground text-[15px] leading-relaxed">
          {message}
        </div>

        <div className="flex gap-3 justify-end mt-2">
          {type === 'confirm' && (
            <button
              className="px-5 py-2 rounded-lg text-[13px] font-medium text-muted-foreground bg-muted hover:bg-muted/80 transition-colors border border-transparent"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-colors border ${
              danger
                ? 'bg-rose-50 text-danger hover:bg-rose-100 border-transparent'
                : 'bg-primary text-primary-foreground hover:opacity-90 border-transparent'
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
