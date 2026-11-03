import React from 'react';
import { TicketPriority } from '../../types';
import { AlertCircle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TicketPriority;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const configs: Record<TicketPriority, { label: string; text: string; bg: string; border: string; icon: any }> = {
    CRITICAL: {
      label: 'Critical',
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      icon: AlertCircle
    },
    HIGH: {
      label: 'High',
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      icon: ArrowUp
    },
    MEDIUM: {
      label: 'Medium',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      icon: Minus
    },
    LOW: {
      label: 'Low',
      text: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      icon: ArrowDown
    }
  };

  const item = configs[priority] || configs.MEDIUM;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${item.bg} ${item.text} ${item.border}`}
    >
      <Icon className="w-3 h-3" />
      {item.label}
    </span>
  );
};

