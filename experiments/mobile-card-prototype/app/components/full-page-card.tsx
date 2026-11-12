import React from 'react';
import { Bookmark, Share2, MoreHorizontal } from 'lucide-react';
import type { Article } from '../data/mock-articles';

interface FullPageCardProps {
  article: Article;
  onClick: () => void;
}

export function FullPageCard({ article, onClick }: FullPageCardProps) {
  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Image Section - takes up roughly top 45% */}
      <div className="relative w-full flex-shrink-0" style={{ height: '46%' }}>
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover"
        />
        {/* More button overlay */}
        <button className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <MoreHorizontal size={18} className="text-white" />
        </button>
        {/* Image credit */}
        {article.imageCredit && (
          <div className="absolute bottom-3 right-3">
            <span
              className="text-white/70"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px'
              }}
            >
              Image Credits: {article.imageCredit}
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-col flex-1 px-4 pt-3 pb-2 overflow-hidden" onClick={onClick}>
        {/* Source Row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm">{article.sourceFavicon}</span>
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--foreground)'
              }}
            >
              {article.source}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-[var(--background-secondary)] rounded-md transition-colors">
              <Bookmark size={18} style={{ color: 'var(--foreground)' }} />
            </button>
            <button className="p-1.5 hover:bg-[var(--background-secondary)] rounded-md transition-colors">
              <Share2 size={18} style={{ color: 'var(--foreground)' }} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h2
          className="mb-2"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '19px',
            lineHeight: '1.3',
            color: 'var(--foreground)'
          }}
        >
          {article.title}
        </h2>

        {/* Summary */}
        <p
          className="flex-1 overflow-hidden"
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14.5px',
            lineHeight: '1.55',
            color: 'var(--text-secondary)'
          }}
        >
          {article.summary}
        </p>

        {/* Footer - timestamp, author, source */}
        <div className="pt-2 pb-1 flex-shrink-0">
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '12px',
              color: 'var(--text-tertiary)'
            }}
          >
            {article.timeAgo} | {article.author} | {article.source}
          </span>
        </div>
      </div>
    </div>
  );
}
