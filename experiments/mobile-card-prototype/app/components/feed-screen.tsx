import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FullPageCard } from './full-page-card';
import { mockArticles, categories } from '../data/mock-articles';
import type { Article } from '../data/mock-articles';

interface FeedScreenProps {
  onArticleClick: (article: Article) => void;
}

export function FeedScreen({ onArticleClick }: FeedScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState('My Feed');
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const filteredArticles = selectedCategory === 'My Feed'
    ? mockArticles
    : mockArticles.filter(article => article.category === selectedCategory);

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [selectedCategory]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || isScrollingRef.current) return;
    const container = containerRef.current;
    const cardHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const newIndex = Math.round(scrollTop / cardHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < filteredArticles.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, filteredArticles.length]);

  // Calculate the height for the card area (full height minus tab bar minus category tabs)
  // Category tabs ~ 44px, bottom tab bar ~ 56px, status bar = 44px already in parent
  const categoryTabsRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full relative" style={{ backgroundColor: 'var(--background)' }}>
      {/* Category Tabs - text style like screenshot */}
      <div
        ref={categoryTabsRef}
        className="flex-shrink-0 overflow-x-auto hide-scrollbar"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="flex items-center gap-5 px-4 py-2.5">
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap relative pb-0.5"
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '14px',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  transition: 'color 0.2s ease'
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-page card swiper */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto hide-scrollbar"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <div
              key={article.id}
              className="w-full"
              style={{
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                height: 'calc(100vh - 44px - 44px - 56px)',
              }}
            >
              <FullPageCard
                article={article}
                onClick={() => onArticleClick(article)}
              />
            </div>
          ))
        ) : (
          <div
            className="flex flex-col items-center justify-center w-full"
            style={{ height: 'calc(100vh - 44px - 44px - 56px)' }}
          >
            <div className="text-6xl mb-4">📰</div>
            <p
              className="text-center"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '18px',
                color: 'var(--foreground)'
              }}
            >
              No articles yet.
            </p>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary)'
              }}
            >
              Check back soon.
            </p>
          </div>
        )}
      </div>

      {/* Page Indicator Dots */}
      {filteredArticles.length > 1 && (
        <div
          className="absolute right-2 flex flex-col items-center gap-1.5 z-10"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {filteredArticles.map((_, idx) => (
            <div
              key={idx}
              className="rounded-full transition-all duration-300"
              style={{
                width: idx === currentIndex ? '6px' : '4px',
                height: idx === currentIndex ? '6px' : '4px',
                backgroundColor: idx === currentIndex
                  ? 'var(--accent-primary)'
                  : 'var(--text-tertiary)',
                opacity: idx === currentIndex ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}