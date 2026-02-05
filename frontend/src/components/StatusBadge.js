import React from 'react';
import { Badge } from '@/components/ui/badge';

export const StatusBadge = ({ status, className = '' }) => {
  const statusConfig = {
    // Derived status colors matching backend logic
    sos: {
      label: 'SOS ALERT!',
      color: 'bg-red-500/20 text-red-400 border-red-500 animate-pulse',
      dot: 'bg-red-500 animate-ping'
    },
    completed: {
      label: 'COMPLETED',
      color: 'bg-gray-500/20 text-gray-400 border-gray-500',
      dot: 'bg-gray-500'
    },
    stopped: {
      label: 'STOPPED',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500',
      dot: 'bg-blue-500'
    },
    active: {
      label: 'ACTIVE',
      color: 'bg-green-500/20 text-green-400 border-green-500',
      dot: 'bg-green-500 animate-pulse'
    },
    paused: {
      label: 'PAUSED',
      color: 'bg-orange-500/20 text-orange-400 border-orange-500',
      dot: 'bg-orange-500'
    },
    offline: {
      label: 'OFFLINE',
      color: 'bg-red-600/20 text-red-400 border-red-600',
      dot: 'bg-red-600'
    },
    // Legacy/fallback
    tracking: {
      label: 'TRACKING',
      color: 'bg-green-500/20 text-green-400 border-green-500',
      dot: 'bg-green-500 animate-pulse'
    },
    inactive: {
      label: 'INACTIVE',
      color: 'bg-muted/20 text-muted border-muted',
      dot: 'bg-muted'
    },
    assigned: {
      label: 'ASSIGNED',
      color: 'bg-warning/20 text-warning border-warning',
      dot: 'bg-warning'
    },
    approved: {
      label: 'APPROVED',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500',
      dot: 'bg-blue-500'
    },
    finished: {
      label: 'FINISHED',
      color: 'bg-gray-500/20 text-gray-400 border-gray-500',
      dot: 'bg-gray-500'
    },
    pending: {
      label: 'PENDING',
      color: 'bg-orange-500/20 text-orange-400 border-orange-500',
      dot: 'bg-orange-500'
    }
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <Badge 
      variant="outline" 
      className={`font-heading font-bold tracking-widest rounded-sm px-2 py-0.5 border flex items-center gap-1.5 ${config.color} ${className}`}
      data-testid={`status-badge-${status}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
};