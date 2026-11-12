import React from 'react';
import { ChevronRight, Moon, Sun } from 'lucide-react';

interface ProfileScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function ProfileScreen({ darkMode, onToggleDarkMode }: ProfileScreenProps) {
  const settingsItems = [
    { label: 'Reading preferences', hasChevron: true },
    { label: 'Dark mode', hasToggle: true, isOn: darkMode, onToggle: onToggleDarkMode },
    { label: 'Notification preferences', hasChevron: true },
    { label: 'About samā4', hasChevron: true },
    { label: 'Sign out', hasChevron: true },
  ];

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'white' }}
          >
            D
          </div>
          <div>
            <h2
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '20px',
                color: 'var(--foreground)'
              }}
            >
              Devashish
            </h2>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary)'
              }}
            >
              Premium Reader
            </p>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="px-4 space-y-1">
          {settingsItems.map((item, index) => (
            <button
              key={index}
              onClick={item.onToggle}
              className="w-full flex items-center justify-between px-4 py-4 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
            >
              <span
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '16px',
                  color: 'var(--foreground)'
                }}
              >
                {item.label}
              </span>
              {item.hasChevron && (
                <ChevronRight size={20} style={{ color: 'var(--text-tertiary)' }} />
              )}
              {item.hasToggle && (
                <div className="flex items-center gap-2">
                  {item.isOn ? (
                    <Moon size={18} style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <Sun size={18} style={{ color: 'var(--text-tertiary)' }} />
                  )}
                  <div
                    className="relative w-12 h-6 rounded-full transition-colors"
                    style={{
                      backgroundColor: item.isOn ? 'var(--accent-primary)' : 'var(--switch-background)'
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                      style={{
                        transform: item.isOn ? 'translateX(26px)' : 'translateX(2px)'
                      }}
                    />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-8 px-4 py-6 text-center">
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '12px',
              color: 'var(--text-tertiary)'
            }}
          >
            samā4 v1.0.0
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '12px',
              color: 'var(--text-tertiary)'
            }}
          >
            Made with ✨ for smarter reading
          </p>
        </div>
      </div>
    </div>
  );
}
