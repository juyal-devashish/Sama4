import React from 'react';

export type EntityType = 'person' | 'organization' | 'event' | 'concept' | 'location';

interface EntityBadgeProps {
  type: EntityType;
  label?: string;
}

const entityTypeColors: Record<EntityType, string> = {
  person: 'var(--entity-person)',
  organization: 'var(--entity-organization)',
  event: 'var(--entity-event)',
  concept: 'var(--entity-concept)',
  location: 'var(--entity-location)',
};

const entityTypeLabels: Record<EntityType, string> = {
  person: 'Person',
  organization: 'Organization',
  event: 'Event',
  concept: 'Concept',
  location: 'Location',
};

export function EntityBadge({ type, label }: EntityBadgeProps) {
  const displayLabel = label || entityTypeLabels[type];
  const color = entityTypeColors[type];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        fontFamily: 'Roboto, sans-serif',
        fontWeight: 500,
        fontSize: '11px',
      }}
    >
      {displayLabel}
    </span>
  );
}
