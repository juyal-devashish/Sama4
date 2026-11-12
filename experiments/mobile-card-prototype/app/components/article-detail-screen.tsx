import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Share2, Bookmark, ChevronRight } from 'lucide-react';
import type { Article, ArticleEntity } from '../data/mock-articles';
import { EntityBadge } from './entity-badge';

interface ArticleDetailScreenProps {
  article: Article;
  onBack: () => void;
  onEntityClick: (entity: ArticleEntity) => void;
  onViewReferences: () => void;
}

export function ArticleDetailScreen({
  article,
  onBack,
  onEntityClick,
  onViewReferences
}: ArticleDetailScreenProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
        setScrollProgress(Math.min(progress, 100));
      }
    };

    const ref = contentRef.current;
    ref?.addEventListener('scroll', handleScroll);
    return () => ref?.removeEventListener('scroll', handleScroll);
  }, []);

  const handleEntityClick = (entity: ArticleEntity) => {
    setActiveEntityId(entity.id);
    onEntityClick(entity);
  };

  const renderArticleContent = () => {
    const parts = article.content.split(/(<entity[^>]*>.*?<\/entity>)/g);
    
    return parts.map((part, index) => {
      const entityMatch = part.match(/<entity id="([^"]*)" priority="([^"]*)">(.*?)<\/entity>/);
      
      if (entityMatch) {
        const [, entityId, priority, text] = entityMatch;
        const entity = article.entities.find(e => e.id === entityId);
        if (!entity) return null;

        const isActive = activeEntityId === entityId;
        
        const getHighlightStyle = () => {
          const baseStyle = {
            fontFamily: 'Roboto, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.1s ease',
            borderRadius: '2px',
            padding: '1px 2px',
            position: 'relative' as const,
          };

          if (isActive) {
            return {
              ...baseStyle,
              backgroundColor: 'var(--entity-highlight-active)',
              borderBottom: '2px solid var(--accent-secondary)',
              transform: 'scale(1.02)',
            };
          }

          if (priority === 'high') {
            return {
              ...baseStyle,
              backgroundColor: 'var(--entity-highlight)',
              borderBottom: '2px solid var(--accent-secondary)',
            };
          }

          if (priority === 'medium') {
            return {
              ...baseStyle,
              backgroundColor: 'var(--entity-highlight)',
              borderBottom: '1.5px solid var(--accent-secondary)',
            };
          }

          return {
            ...baseStyle,
            backgroundColor: 'rgba(245, 230, 200, 0.3)',
            borderBottom: '1px dotted var(--accent-secondary)',
          };
        };

        return (
          <span
            key={index}
            onClick={() => handleEntityClick(entity)}
            style={getHighlightStyle()}
          >
            {text}
          </span>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Scroll Progress Bar */}
      <div
        className="h-1 transition-all"
        style={{
          width: `${scrollProgress}%`,
          backgroundColor: 'var(--accent-primary)',
        }}
      />

      <div ref={contentRef} className="flex-1 overflow-y-auto pb-20">
        {/* Hero Image */}
        <div className="relative h-[280px]">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 50%)'
            }}
          />
          
          {/* Floating Top Bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <Share2 size={18} className="text-white" />
              </button>
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <Bookmark size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h1
              className="text-white line-clamp-4"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '24px',
                lineHeight: '1.3',
                textShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              {article.title}
            </h1>
          </div>
        </div>

        {/* Metadata Bar */}
        <div
          className="px-5 py-3 border-b"
          style={{
            borderColor: 'var(--divider)',
            backgroundColor: 'var(--background)'
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              color: 'var(--text-secondary)'
            }}
          >
            <span className="text-base">{article.sourceFavicon}</span>
            <span>{article.source}</span>
            <span>·</span>
            <span>{article.timeAgo}</span>
            <span>·</span>
            <span>{article.readTime}</span>
          </div>
        </div>

        {/* Category Pills & View References */}
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EntityBadge type="concept" label={article.category} />
          </div>
          <button
            onClick={onViewReferences}
            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            <span
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: 'var(--accent-primary)'
              }}
            >
              View all references
            </span>
            <ChevronRight size={16} style={{ color: 'var(--accent-primary)' }} />
          </button>
        </div>

        {/* Article Body */}
        <div className="px-5 pb-8">
          <div
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '16px',
              lineHeight: '1.65',
              color: 'var(--foreground)',
              whiteSpace: 'pre-line'
            }}
          >
            {renderArticleContent()}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 py-2 px-5 border-t"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          maxWidth: '393px',
          margin: '0 auto'
        }}
      >
        <p
          className="text-center"
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}
        >
          {article.entities.length} highlighted terms in this article
        </p>
      </div>
    </div>
  );
}