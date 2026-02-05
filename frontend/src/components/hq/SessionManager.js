import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const SessionManager = ({ hqId, plan, onSessionExpired }) => {
  const [sessionStatus, setSessionStatus] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const checkIntervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Fetch session status
  const fetchSessionStatus = useCallback(async () => {
    if (!hqId || plan !== 'trial') return;
    
    try {
      const response = await fetch(`${API}/api/session/status?hq_id=${hqId}`);
      if (response.ok) {
        const data = await response.json();
        setSessionStatus(data);
        
        if (data.has_session_limit) {
          setTimeRemaining(data.remaining_seconds);
          
          // Show warning when 5 minutes or less remain
          if (data.remaining_seconds <= 300 && data.remaining_seconds > 0) {
            setShowWarning(true);
          }
          
          // Session expired
          if (data.expired || data.remaining_seconds <= 0) {
            toast.error('Session expired. Please login again.', { duration: 10000 });
            if (onSessionExpired) {
              onSessionExpired();
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching session status:', error);
    }
  }, [hqId, plan, onSessionExpired]);

  // Renew session
  const renewSession = async () => {
    if (!hqId) return;
    
    setIsRenewing(true);
    try {
      const response = await fetch(`${API}/api/session/renew?hq_id=${hqId}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success('Session extended by 30 minutes');
        setShowWarning(false);
        setTimeRemaining(30 * 60);
        fetchSessionStatus();
      } else {
        toast.error('Failed to renew session');
      }
    } catch (error) {
      console.error('Error renewing session:', error);
      toast.error('Connection error');
    } finally {
      setIsRenewing(false);
    }
  };

  // Initial fetch and set up polling
  useEffect(() => {
    if (plan === 'trial' && hqId) {
      fetchSessionStatus();
      
      // Check every 30 seconds
      checkIntervalRef.current = setInterval(fetchSessionStatus, 30000);
      
      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    }
  }, [fetchSessionStatus, plan, hqId]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (onSessionExpired) onSessionExpired();
            return 0;
          }
          
          // Show warning at 5 minutes
          if (prev === 300) {
            setShowWarning(true);
            toast.warning('Session expires in 5 minutes!', { duration: 10000 });
          }
          
          // Final warning at 1 minute
          if (prev === 60) {
            toast.error('Session expires in 1 minute!', { duration: 60000 });
          }
          
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [timeRemaining, onSessionExpired]);

  // Don't render for non-trial plans
  if (plan !== 'trial' || !sessionStatus?.has_session_limit) {
    return null;
  }

  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Session Timer Badge - Always visible for Trial */}
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
          timeRemaining <= 300 
            ? 'bg-red-500/20 text-red-400 border border-red-500/50' 
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
        }`}
        title="Trial session time remaining"
      >
        <Clock className="w-3 h-3" />
        <span>{formatTime(timeRemaining || 0)}</span>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-6 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
            
            <h2 className="text-xl font-bold text-yellow-400">Session Expiring Soon</h2>
            
            <div className="text-4xl font-mono text-white">
              {formatTime(timeRemaining || 0)}
            </div>
            
            <p className="text-gray-400">
              Your trial session will expire soon. Click below to extend by 30 minutes.
            </p>
            
            <div className="flex gap-3 justify-center">
              <Button
                onClick={renewSession}
                disabled={isRenewing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isRenewing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4 mr-2" />
                )}
                Extend Session
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowWarning(false)}
              >
                Dismiss
              </Button>
            </div>
            
            <p className="text-xs text-gray-500">
              Trial plan includes 30-minute sessions. Upgrade to Normal or Pro for extended sessions.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionManager;
