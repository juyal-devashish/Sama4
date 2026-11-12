import React from 'react';
import { Search, Newspaper, User } from 'lucide-react';

export type TabType = 'feed' | 'search' | 'bookmarks' | 'trending' | 'profile';

interface BottomTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface TabConfig {
  id: TabType;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'search', icon: Search },
  { id: 'feed', icon: Newspaper },
  { id: 'profile', icon: User },
];

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-6 pt-2.5 pb-5 border-t"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        maxWidth: '393px',
        margin: '0 auto',
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex items-center justify-center p-2 transition-colors"
          >
            <Icon
              size={24}
              style={{
                color: isActive ? 'var(--foreground)' : 'var(--text-tertiary)',
                strokeWidth: isActive ? 2.5 : 1.8,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
