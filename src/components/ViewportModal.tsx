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
      className={`fixed inset-0 z-[1000] flex min-h-[100dvh] items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/65 p-3 backdrop-blur-sm sm:p-4 ${className}`}
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
