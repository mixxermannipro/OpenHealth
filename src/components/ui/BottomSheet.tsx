import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'sm:max-w-xl',
}) => {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 44, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 480) {
                triggerHaptic('tick');
                onClose();
              }
            }}
            className={`relative z-10 w-full ${maxWidthClass} max-h-[88dvh] flex flex-col rounded-t-[28px] sm:rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] shadow-2xl overflow-hidden`}
          >
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/25" />
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--border-hairline)]">
              <div className="min-w-0">
                <h2 className="font-editorial text-lg sm:text-xl font-medium text-[var(--text-primary)] leading-snug">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="min-h-[40px] min-w-[40px] -mr-2 -my-1 flex items-center justify-center rounded-full bg-[var(--bg-well)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 pb-9">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
