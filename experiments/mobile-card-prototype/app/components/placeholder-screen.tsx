import React from 'react';

interface PlaceholderScreenProps {
  title: string;
  icon: string;
  message: string;
}

export function PlaceholderScreen({ title, icon, message }: PlaceholderScreenProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="text-6xl mb-4">{icon}</div>
      <h2
        className="mb-2"
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 600,
          fontSize: '22px',
          color: 'var(--foreground)'
        }}
      >
        {title}
      </h2>
      <p
        className="text-center px-8"
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '14px',
          color: 'var(--text-secondary)'
        }}
      >
        {message}
      </p>
    </div>
  );
}
