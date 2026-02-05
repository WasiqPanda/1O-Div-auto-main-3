import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Clock, Route } from 'lucide-react';

export const HistoryDialog = ({ open, onOpenChange, historyData, selectedDate }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-tactical-panel border-tactical-border z-[9999] max-w-2xl max-h-[80vh]" data-testid="history-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Patrol History - {formatDate(selectedDate)}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {historyData && historyData.length > 0 ? (
            <div className="space-y-4">
              {historyData.map((record, idx) => (
                <Card key={idx} className="bg-tactical-surface border-tactical-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading text-primary flex items-center justify-between">
                      <span>{record.patrol_name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        record.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        record.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {record.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Clock className="w-3 h-3" />
                        <span>Session: {formatTime(record.session_start)} - {record.session_end ? formatTime(record.session_end) : 'Ongoing'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <MapPin className="w-3 h-3" />
                        <span>Area: {record.assigned_area}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <Route className="w-3 h-3" />
                        <span>Distance: {record.total_distance || '0'} km</span>
                      </div>
                      {record.location_count && (
                        <div className="text-gray-400">
                          {record.location_count} location points recorded
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No patrol history found for this date.</p>
              <p className="text-sm mt-2">Sessions are recorded when patrols are active.</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
