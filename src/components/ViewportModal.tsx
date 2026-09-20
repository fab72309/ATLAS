import React from 'react';
import { createPortal } from 'react-dom';

interface ViewportModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  className?: string;
}

/** Keeps modal positioning independent from transformed or clipped page containers. */
const ViewportModal: React.FC<ViewportModalProps> = ({
  children,
  onClose,
  closeOnBackdrop = false,
  className = ''
}) => {
  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };

    if (onClose) document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (onClose) document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[1000] box-border flex h-[100dvh] max-h-[100dvh] items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-950/65 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4 ${className}`}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export default ViewportModal;
