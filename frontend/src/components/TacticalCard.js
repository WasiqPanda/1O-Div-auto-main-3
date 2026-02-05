import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const TacticalCard = ({ title, value, status, icon: Icon, className = '' }) => {
  const statusColors = {
    active: 'border-secondary',
    inactive: 'border-muted',
    sos: 'border-destructive',
    assigned: 'border-warning',
    warning: 'border-warning'
  };

  const valueColors = {
    active: 'text-secondary',
    warning: 'text-warning',
    sos: 'text-destructive'
  };

  return (
    <Card 
      className={`bg-tactical-panel border border-tactical-border rounded-sm relative overflow-hidden ${statusColors[status] || ''} ${className}`}
      data-testid={`tactical-card-${title?.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />
      
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-mono font-bold ${valueColors[status] || 'text-white'}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
};