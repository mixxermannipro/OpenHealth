import React from 'react';
import { Info } from 'lucide-react';

interface InfoButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({ label, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`Erklärung zu ${label} öffnen`}
      title={`Wie wird „${label}“ berechnet?`}
      className={`min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-sleep)] shrink-0 ${className}`}
    >
      <Info className="w-[15px] h-[15px]" aria-hidden="true" />
    </button>
  );
};
