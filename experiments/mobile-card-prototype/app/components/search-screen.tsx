import React, { useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { ArticleCard } from './article-card';
import { mockArticles } from '../data/mock-articles';
import type { Article } from '../data/mock-articles';

interface SearchScreenProps {
  onArticleClick: (article: Article) => void;
}

export function SearchScreen({ onArticleClick }: SearchScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches] = useState(['AI', 'Climate', 'Federal Reserve']);

  const searchResults = searchQuery.trim()
    ? mockArticles.filter(article =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Search Input */}
      <div className="p-4 pb-3">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'var(--background-secondary)' }}
        >
          <SearchIcon size={20} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all articles and entities"
            className="flex-1 bg-transparent outline-none"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 500,
              fontSize: '17px',
              color: 'var(--foreground)'
            }}
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X size={20} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {!searchQuery ? (
          /* Before Search */
          <div className="px-4">
            <p
              className="mb-4"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                textAlign: 'center'
              }}
            >
              Search across all articles and entities
            </p>

            {recentSearches.length > 0 && (
              <div>
                <h3
                  className="mb-3"
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '16px',
                    color: 'var(--foreground)'
                  }}
                >
                  Recent Searches
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, index) => (
                    <button
                      key={index}
                      onClick={() => setSearchQuery(term)}
                      className="px-4 py-2 rounded-full border transition-colors hover:bg-[var(--background-secondary)]"
                      style={{
                        borderColor: 'var(--border)',
                        fontFamily: 'Roboto, sans-serif',
                        fontSize: '14px',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : searchResults.length > 0 ? (
          /* Results */
          <div className="px-4">
            <p
              className="mb-4"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                color: 'var(--text-tertiary)'
              }}
            >
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
            </p>
            <div className="space-y-2">
              {searchResults.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  variant="compact"
                  onClick={() => onArticleClick(article)}
                />
              ))}
            </div>
          </div>
        ) : (
          /* No Results */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <p
              className="text-center mb-1"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                color: 'var(--foreground)'
              }}
            >
              No matches found.
            </p>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary)'
              }}
            >
              Try different keywords.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
