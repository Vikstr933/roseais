import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm',
  {
    variants: {
      variant: {
        default:
          'border-primary/20 bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-primary/20 hover:shadow-md hover:shadow-primary/30',
        secondary:
          'border-secondary/30 bg-gradient-to-b from-secondary to-secondary/80 text-secondary-foreground hover:shadow-md',
        destructive:
          'border-destructive/20 bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-destructive/20',
        success:
          'border-emerald-400/20 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25',
        warning:
          'border-amber-400/20 bg-gradient-to-b from-amber-500 to-amber-600 text-white shadow-amber-500/25',
        outline: 'text-foreground border-border/60 bg-background/50 backdrop-blur-sm',
        premium: 'border-purple-400/20 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 text-white shadow-purple-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
