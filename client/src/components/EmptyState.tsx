import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="relative">
        <div className="absolute inset-0 bg-brand-gradient-subtle rounded-full blur-xl opacity-50" />
        <Icon className="empty-state-icon relative z-10" />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6 btn-primary"
          size="lg"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

