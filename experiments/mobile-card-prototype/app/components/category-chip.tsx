import React from 'react';

interface CategoryChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function CategoryChip({ label, active = false, onClick }: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-1.5 rounded-full whitespace-nowrap transition-all
        ${
          active
            ? 'bg-[var(--accent-primary)] text-white'
            : 'border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-secondary)]'
        }
      `}
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 600,
        fontSize: '14px',
        letterSpacing: '0.005em'
      }}
    >
      {label}
    </button>
  );
}
