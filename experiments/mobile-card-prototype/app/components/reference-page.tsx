import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import type { Article, ArticleEntity } from '../data/mock-articles';
import { EntityBadge } from './entity-badge';

interface ReferencePageProps {
  article: Article;
  onBack: () => void;
}

export function ReferencePage({ article, onBack }: ReferencePageProps) {
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);

  // Group entities by type
  const groupedEntities: Record<string, ArticleEntity[]> = {};
  article.entities.forEach((entity) => {
    if (!groupedEntities[entity.type]) {
      groupedEntities[entity.type] = [];
    }
    groupedEntities[entity.type].push(entity);
  });

  const entityTypeLabels: Record<string, string> = {
    person: 'People',
    organization: 'Organizations',
    event: 'Events',
    concept: 'Concepts',
    location: 'Locations',
  };

  const toggleEntity = (entityId: string) => {
    setExpandedEntityId(expandedEntityId === entityId ? null : entityId);
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: 'var(--divider)',
          backgroundColor: 'var(--surface)'
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-2"
        >
          <ArrowLeft size={20} style={{ color: 'var(--foreground)' }} />
        </button>
        <h1
          className="mb-1"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 600,
            fontSize: '22px',
            color: 'var(--foreground)'
          }}
        >
          Key References
        </h1>
        <p
          className="mb-1"
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            lineHeight: '1.4',
            color: 'var(--text-secondary)'
          }}
        >
          {article.title}
        </p>
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: 'var(--text-tertiary)'
          }}
        >
          {article.entities.length} terms found
        </p>
      </div>

      {/* Entity Groups */}
      <div className="flex-1 overflow-y-auto pb-20 px-4 py-4">
        {Object.entries(groupedEntities).map(([type, entities]) => (
          <div key={type} className="mb-6">
            {/* Section Header */}
            <h2
              className="mb-3"
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                color: 'var(--text-secondary)'
              }}
            >
              {entityTypeLabels[type]} ({entities.length})
            </h2>

            {/* Entity Rows */}
            <div className="space-y-2">
              {entities.map((entity) => {
                const isExpanded = expandedEntityId === entity.id;

                return (
                  <div
                    key={entity.id}
                    className="rounded-lg overflow-hidden"
                    style={{
                      backgroundColor: 'var(--background-secondary)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    {/* Entity Row Header */}
                    <button
                      onClick={() => toggleEntity(entity.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--background)] transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            style={{
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 500,
                              fontSize: '16px',
                              color: 'var(--foreground)'
                            }}
                          >
                            {entity.text}
                          </span>
                          {entity.inTitle && (
                            <span
                              className="px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'var(--accent-primary)',
                                color: 'white',
                                fontFamily: 'Roboto, sans-serif',
                                fontSize: '10px',
                                fontWeight: 500
                              }}
                            >
                              In title
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              fontFamily: 'Roboto, sans-serif',
                              fontSize: '12px',
                              color: 'var(--text-tertiary)'
                            }}
                          >
                            mentioned {entity.mentionCount}×
                          </span>
                          {!isExpanded && (
                            <p
                              className="line-clamp-1 flex-1"
                              style={{
                                fontFamily: 'Roboto, sans-serif',
                                fontSize: '13px',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {entity.context}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-3">
                        {isExpanded ? (
                          <ChevronUp size={20} style={{ color: 'var(--text-tertiary)' }} />
                        ) : (
                          <ChevronDown size={20} style={{ color: 'var(--text-tertiary)' }} />
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--divider)' }}>
                        <div className="pt-3 mb-3">
                          <EntityBadge type={entity.type} />
                        </div>
                        <p
                          style={{
                            fontFamily: 'Roboto, sans-serif',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            color: 'var(--foreground)'
                          }}
                        >
                          {entity.context}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
