import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  AlertTriangle, Bell, BellOff, MapPin, Clock, CheckCircle, 
  Settings, Zap, Radio, Volume2, Eye, X, RefreshCw, Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Request browser notification permission
const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Send browser notification
const sendBrowserNotification = (title, body, options = {}) => {
  if (Notification.permission !== 'granted') return;
  
  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: options.tag || 'sos-alert',
    requireInteraction: true,
    ...options
  });
  
  notification.onclick = () => {
    window.focus();
    notification.close();
    if (options.onClick) options.onClick();
  };
  
  // Play alert sound if available
  if (options.playSound !== false) {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleUcHcLXy6X9QEhwgqNfLhE4VGTiU3OigYCEILafz8oVHCAc8sPXoZC0DGIS998t6KgYUi/7wjUAGCmTE+thtFgQPevP6mEoJBUa8+uBsFwQNcvD8n1UMAzy09el0JggSh/jyjEcIBku89OJtGAURc+76oFYLBD249ex4KggSiffyjkkJBku79OJuGAUSc+76oFYLBD649u16KgkTifbxjEkJB0u79OJuGQUSdO76oFYLBT649u16KggSifbxjEoJB0u79OJuGQUSdO76oFYMBT649u17KggSifbxjEoJB0u79OJuGQUSdO76oFYMBj659+18KwgTivbyj0sKCE279eNwGgYUde/7olcNBj669+59LAkTivfyk0wKCU+99uRyGwcVd/D8pFkOB0C7+PB+LgoUjPjzlU0LClG+9+VzHAgWebH9pVoPCEC7+PB/LwoVjPjzlk4MC1K/+OZ0HQgYebH9pVoPCEG7+PCBMAoVjfj0l08NC1PA+ed1HgkZerL9p1sQCUK8+fGCMQsWjvn1mFAODFTB+eh2HwkZe7P+qFwRCkO9+fKDMgsXj/n1mVEPDVXC+ul3IAoafLT+qV0SCkS++vOEMwwXkPr2m1IQDlbD++t4IQsbfbX/q14TC0W/+/SFNAwYkfv3nFMRD1fE/Ox5IgwcfrX/q18UDEW/+/SGNQwZkvv3nVQSD1jF/O16Iw0cf7b/rGAUDUbA/PWHNg0akvz4nlUSEFnG/e57JA4dgLf/rWEVDkfB/faINw4bk/35n1YTEVrH/u98JQ8egbf/rmIWD0jC//eJOA8clP36oFcUElvI//B+Jg8fg7j/r2MXEEnD//iKORAdk/36oVgVE1zJ//GBKBEghLn/sGQYEUrE//mLOhEelP37olkWFFzJ//GCKRIhhbr/sWUZEkvF//qMOxIflf77o1oXFV3K//KDKhMih7r/smYaE0zG//uNPBMglv/8pFsYFl7L//OEKxQjh7v/s2cbFE3H//yOPRQhlv/8pVwZF1/M//SFLBUkiLz/tGgcFU7I//2PPRUil//9pl0aGGDN//WGLRYliL3/tWkdFlDJ//6QPxYjmP/+p14bGWHO//aHLhcmi77/tmoeF1HK//+RQBckmf/+qF8cGmLO//iIMBgojL//t2sfGFLL//+SQRgkmf//qWAdG2PP//mJMRkpjcD/uGwgGVPM//+TQhklmv//qmEeHGTQ//qKMhoppMD/uW0hGlTN//+UQxomm///q2IfHWXR//uLMxsqpMH/um4iG1XO//+VRBsnm///rGMgHmbS//yMMxwrpsL/u28jHFbP//+WRRwonP//rWQhH2fT//2NNB0spsP/vHAkHVfQ//+XRh0pnf//rmUiIGjU//6ONR4tp8T/vXElHljR//+YRx4qnv//r2YjIWnV//+POB8uqMX/vnInH1nS//+ZSB8rn///sGckImrW//+QOSAuqcX/v3MoIFrT//+aSR8soP//sWglI2vX//+ROiEvqsb/wHQpIVvU//+bSiAtoP//smkmJGzY//+SPCIwq8f/wXUqIlzV//+cSyEuof//s2onJW3Z//+TPSMxrMj/wnYrI13W//+dTCIvov//tGsoJm7a//+UPiQyrMn/w3csJF7X//+eTSMwo///tWwpJ2/b//+VPyUzrc');
      audio.volume = 0.5;
      audio.play().catch(() => { /* Ignore audio errors */ });
    } catch (e) {
      // Audio playback not critical
    }
  }
  
  return notification;
};

// Individual SOS Alert Card
const SOSAlertCard = ({ alert, onResolve, onLocate, isResolving }) => {
  const timestamp = new Date(alert.timestamp);
  const isAutoTriggered = alert.auto_triggered;
  
  return (
    <div 
      className={`
        relative overflow-hidden rounded-lg border-2 
        ${isAutoTriggered ? 'border-orange-500 bg-orange-500/10' : 'border-red-500 bg-red-500/10'}
        animate-pulse-slow
      `}
      data-testid={`sos-alert-${alert.patrol_id}`}
    >
      {/* Alert Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${isAutoTriggered ? 'bg-orange-500/20' : 'bg-red-500/20'}`}>
        {isAutoTriggered ? (
          <Clock className="w-4 h-4 text-orange-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
        )}
        <span className={`text-xs font-bold uppercase tracking-wider ${isAutoTriggered ? 'text-orange-400' : 'text-red-400'}`}>
          {isAutoTriggered ? 'AUTO SOS - INACTIVITY' : 'EMERGENCY SOS'}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {timestamp.toLocaleTimeString()}
        </span>
      </div>
      
      {/* Alert Content */}
      <div className="p-3 space-y-3">
        <div>
          <div className="text-white font-semibold text-sm">
            {alert.patrol_name || alert.patrol_id}
          </div>
          {alert.patrol_unit && (
            <div className="text-xs text-gray-400">{alert.patrol_unit}</div>
          )}
        </div>
        
        <div className="text-sm text-gray-300">
          {alert.message}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="w-3 h-3" />
          <span className="font-mono">
            {alert.latitude?.toFixed(6)}, {alert.longitude?.toFixed(6)}
          </span>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-[#3d5a3d]/50 hover:bg-[#2a3a2a]"
            onClick={() => onLocate(alert)}
            data-testid={`locate-sos-btn-${alert.patrol_id}`}
          >
            <Eye className="w-3 h-3 mr-1" />
            Locate
          </Button>
          <Button
            size="sm"
            className={`flex-1 ${isAutoTriggered ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
            onClick={() => onResolve(alert.patrol_id)}
            disabled={isResolving === alert.patrol_id}
            data-testid={`resolve-sos-btn-${alert.patrol_id}`}
          >
            {isResolving === alert.patrol_id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Resolve
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Settings Dialog
const SOSSettingsDialog = ({ open, onOpenChange, hqId, config, onConfigChange }) => {
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [threshold, setThreshold] = useState(config?.threshold_minutes ?? 30);
  const [isSaving, setIsSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(Notification.permission === 'granted');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.post(`${API}/inactivity/config`, {
        hq_id: hqId,
        enabled,
        threshold_minutes: threshold
      });
      onConfigChange({ enabled, threshold_minutes: threshold });
      toast.success('Settings saved');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success('Browser notifications enabled');
    } else {
      toast.error('Notifications permission denied');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d1a0d] border-[#3d5a3d]/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Settings className="w-5 h-5 text-[#b4a064]" />
            SOS Alert Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Browser Notifications */}
          <div className="space-y-3">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Browser Notifications</label>
            <div className="flex items-center justify-between p-3 bg-[#1a2a1a] rounded-lg border border-[#3d5a3d]/30">
              <div className="flex items-center gap-2">
                {notificationsEnabled ? (
                  <Bell className="w-4 h-4 text-emerald-400" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-500" />
                )}
                <span className="text-sm text-white">
                  {notificationsEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {!notificationsEnabled && (
                <Button size="sm" onClick={handleEnableNotifications}>
                  Enable
                </Button>
              )}
            </div>
          </div>

          {/* Auto-detection Toggle */}
          <div className="space-y-3">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Auto-Detection (Inactivity)</label>
            <div className="flex items-center justify-between p-3 bg-[#1a2a1a] rounded-lg border border-[#3d5a3d]/30">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#b4a064]" />
                <span className="text-sm text-white">Auto-trigger SOS on inactivity</span>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </div>

          {/* Threshold Slider */}
          {enabled && (
            <div className="space-y-3">
              <label className="text-xs text-gray-400 uppercase tracking-wider">
                Inactivity Threshold: {threshold} minutes
              </label>
              <Slider
                value={[threshold]}
                onValueChange={([val]) => setThreshold(val)}
                min={5}
                max={120}
                step={5}
                className="py-4"
              />
              <p className="text-xs text-gray-500">
                Auto-SOS will trigger if a patrol shows no movement for {threshold} minutes
              </p>
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-[#b4a064] hover:bg-[#a08954] text-black"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const SOSAlertsPanel = ({ 
  sosAlerts = [], 
  onResolveSOS, 
  onLocateSOS,
  hqId,
  onNewAlert 
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [inactivityConfig, setInactivityConfig] = useState(null);
  const [isResolving, setIsResolving] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const lastAlertCountRef = React.useRef(sosAlerts.length);

  // Load inactivity config
  useEffect(() => {
    const loadConfig = async () => {
      if (!hqId) return;
      try {
        const response = await axios.get(`${API}/inactivity/config/${hqId}`);
        setInactivityConfig(response.data);
      } catch (error) {
        console.error('Error loading inactivity config:', error);
      }
    };
    loadConfig();
  }, [hqId]);

  // Check for new alerts and send browser notification
  useEffect(() => {
    if (sosAlerts.length > lastAlertCountRef.current) {
      const newAlert = sosAlerts[0];
      sendBrowserNotification(
        '🚨 SOS ALERT',
        `${newAlert.patrol_name || newAlert.patrol_id}: ${newAlert.message}`,
        {
          tag: `sos-${newAlert.patrol_id}`,
          onClick: () => onLocateSOS?.(newAlert)
        }
      );
    }
    lastAlertCountRef.current = sosAlerts.length;
  }, [sosAlerts, onLocateSOS]);

  // Manual inactivity check
  const checkInactivity = async () => {
    if (!hqId) return;
    setIsChecking(true);
    try {
      const response = await axios.get(`${API}/inactivity/check?hq_id=${hqId}`);
      const { auto_sos_triggered, inactive_patrols } = response.data;
      
      if (auto_sos_triggered.length > 0) {
        toast.warning(`Auto-SOS triggered for ${auto_sos_triggered.length} patrol(s)`);
        auto_sos_triggered.forEach(p => {
          sendBrowserNotification(
            '⚠️ AUTO SOS - INACTIVITY',
            `${p.patrol_name}: No movement for ${p.inactive_minutes} minutes`,
            { tag: `auto-sos-${p.patrol_id}` }
          );
        });
        onNewAlert?.();
      } else if (inactive_patrols.length > 0) {
        toast.info(`${inactive_patrols.length} patrol(s) showing low activity`);
      } else {
        toast.success('All patrols reporting normally');
      }
    } catch (error) {
      toast.error('Failed to check inactivity');
    } finally {
      setIsChecking(false);
    }
  };

  // Handle resolve with loading state
  const handleResolve = async (patrolId) => {
    setIsResolving(patrolId);
    try {
      await onResolveSOS(patrolId);
    } finally {
      setIsResolving(null);
    }
  };

  const activeAlerts = sosAlerts.filter(a => !a.resolved);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#3d5a3d]/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${activeAlerts.length > 0 ? 'text-red-400 animate-pulse' : 'text-gray-500'}`} />
          <span className="text-sm font-medium text-white">
            SOS Alerts
            {activeAlerts.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 rounded-full text-xs">
                {activeAlerts.length}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={checkInactivity}
            disabled={isChecking}
            className="w-8 h-8 text-gray-400 hover:text-white"
            title="Check for inactive patrols"
          >
            {isChecking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 text-gray-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alerts List */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a2a1a] flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-gray-400 text-sm">No active SOS alerts</p>
              <p className="text-gray-500 text-xs mt-1">All patrols reporting normally</p>
            </div>
          ) : (
            activeAlerts.map(alert => (
              <SOSAlertCard
                key={`${alert.patrol_id}-${alert.timestamp}`}
                alert={alert}
                onResolve={handleResolve}
                onLocate={onLocateSOS}
                isResolving={isResolving}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Settings Dialog */}
      <SOSSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        hqId={hqId}
        config={inactivityConfig}
        onConfigChange={setInactivityConfig}
      />
    </div>
  );
};

// Legacy export for backwards compatibility
export const SOSAlerts = SOSAlertsPanel;

export default SOSAlertsPanel;
