import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertTriangle, Info, CheckCircle, AlertCircle, Check } from 'lucide-react';

const notificationIcons = {
  info: Info,
  warning: AlertTriangle,
  alert: AlertCircle,
  success: CheckCircle,
  sos: AlertCircle
};

const notificationColors = {
  info: 'bg-blue-500/10 border-blue-500 text-blue-400',
  warning: 'bg-warning/10 border-warning text-warning',
  alert: 'bg-destructive/10 border-destructive text-destructive',
  success: 'bg-green-500/10 border-green-500 text-green-400',
  sos: 'bg-destructive/10 border-destructive text-destructive animate-pulse'
};

export const NotificationsPanel = ({ notifications, onMarkRead, onMarkAllRead }) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Mark All Read button */}
      <div className="p-2 border-b border-tactical-border bg-tactical-bg flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
        </span>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
            onClick={onMarkAllRead}
            data-testid="mark-all-read-btn"
          >
            <Check className="w-3 h-3 mr-1" />
            Mark All Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {notifications.map((notification, idx) => {
            const Icon = notificationIcons[notification.type] || Bell;
            const colorClass = notificationColors[notification.type] || notificationColors.info;
            
            return (
              <Card 
                key={notification.id || idx} 
                className={`${colorClass} rounded-sm cursor-pointer transition-opacity ${notification.read ? 'opacity-50' : ''}`}
                onClick={() => !notification.read && onMarkRead(notification.id)}
                data-testid={`notification-${notification.id || idx}`}
              >
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <CardTitle className="text-sm font-heading uppercase">
                        {notification.title}
                      </CardTitle>
                    </div>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-primary rounded-full" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2 text-xs">
                    <p className="text-gray-300">{notification.message}</p>
                    <div className="flex items-center justify-between text-gray-400">
                      <span>{formatTime(notification.timestamp)}</span>
                      {notification.patrol_id && (
                        <span className="font-mono">Patrol: {notification.patrol_id}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {notifications.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No notifications</p>
              <p className="text-xs mt-2">You're all caught up!</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
