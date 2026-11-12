import React, { useEffect, useState } from 'react';
import { ExternalLink, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ArticleEntity } from '../data/mock-articles';
import { EntityBadge } from './entity-badge';

interface EntityContextCardProps {
  entity: ArticleEntity | null;
  isOpen: boolean;
  onClose: () => void;
  onViewReferences: () => void;
}

export function EntityContextCard({
  entity,
  isOpen,
  onClose,
  onViewReferences
}: EntityContextCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entity) {
      setIsLoading(true);
      // Simulate loading delay for AI-generated content
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen, entity]);

  if (!entity) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              maxWidth: '393px',
              margin: '0 auto'
            }}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300
            }}
            className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50"
            style={{
              backgroundColor: 'var(--surface)',
              maxWidth: '393px',
              margin: '0 auto',
              maxHeight: '50vh',
              boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)'
            }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                className="w-9 h-1 rounded-full"
                style={{ backgroundColor: 'var(--divider)' }}
              />
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--background-secondary)] transition-colors"
            >
              <X size={18} style={{ color: 'var(--text-secondary)' }} />
            </button>

            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(50vh - 60px)' }}>
              {isLoading ? (
                /* Loading State */
                <div className="space-y-3">
                  <div
                    className="h-6 w-48 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--background-secondary)' }}
                  />
                  <div
                    className="h-4 w-24 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--background-secondary)' }}
                  />
                  <div className="space-y-2 pt-2">
                    <div
                      className="h-4 w-full rounded animate-pulse"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    />
                    <div
                      className="h-4 w-full rounded animate-pulse"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    />
                    <div
                      className="h-4 w-3/4 rounded animate-pulse"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    />
                  </div>
                </div>
              ) : (
                /* Loaded Content */
                <>
                  {/* Entity Name */}
                  <h2
                    className="mb-2"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      fontSize: '20px',
                      color: 'var(--foreground)'
                    }}
                  >
                    {entity.text}
                  </h2>

                  {/* Entity Type Badge */}
                  <div className="mb-4">
                    <EntityBadge type={entity.type} />
                  </div>

                  {/* Context Paragraph */}
                  <p
                    className="mb-4"
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '15px',
                      lineHeight: '1.55',
                      color: 'var(--foreground)'
                    }}
                  >
                    {entity.context}
                  </p>

                  {/* Wikipedia Link */}
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center gap-1 mb-4 hover:opacity-80 transition-opacity"
                  >
                    <span
                      style={{
                        fontFamily: 'Roboto, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'var(--accent-secondary)'
                      }}
                    >
                      Read on Wikipedia
                    </span>
                    <ExternalLink size={14} style={{ color: 'var(--accent-secondary)' }} />
                  </a>

                  {/* Divider */}
                  <div
                    className="h-px my-4"
                    style={{ backgroundColor: 'var(--divider)' }}
                  />

                  {/* View All References */}
                  <button
                    onClick={() => {
                      onClose();
                      onViewReferences();
                    }}
                    className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    <span
                      style={{
                        fontFamily: 'Roboto, sans-serif',
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'var(--accent-primary)'
                      }}
                    >
                      View all references
                    </span>
                    <ChevronRight size={16} style={{ color: 'var(--accent-primary)' }} />
                  </button>

                  {/* Stretch: Ask a follow-up (placeholder) */}
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--divider)' }}>
                    <input
                      type="text"
                      placeholder="Ask a follow-up question..."
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{
                        backgroundColor: 'var(--background-secondary)',
                        fontFamily: 'Roboto, sans-serif',
                        fontSize: '14px',
                        color: 'var(--foreground)'
                      }}
                      disabled
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
