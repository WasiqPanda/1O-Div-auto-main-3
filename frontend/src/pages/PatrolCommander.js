import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  MapPin, Radio, AlertTriangle, Wifi, WifiOff, Battery, 
  Navigation, Send, RefreshCw, Shield, Clock, Signal,
  CheckCircle, CheckCircle2, XCircle, Loader2, ChevronRight, Users,
  MessageSquare, FileWarning, Package, Route, Eye,
  Phone, Camera, Compass, Target, Activity, Zap, Menu, X
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Background and Logo URLs
const BACKGROUND_IMAGE = 'https://customer-assets.emergentagent.com/job_2d9837ea-ce33-42ad-9eb8-91e7ec7df4fd/artifacts/lt1jykmh_IMG_8817.PNG';
const WASIQ_LOGO = 'https://customer-assets.emergentagent.com/job_2d9837ea-ce33-42ad-9eb8-91e7ec7df4fd/artifacts/01u6pvnf_IMG_8593.jpg';

// Glassmorphism Panel Component
const GlassPanel = ({ children, className = '', glow = false, onClick }) => (
  <div 
    onClick={onClick}
    className={`
      relative overflow-hidden rounded-xl
      bg-gradient-to-br from-[#1a2a1a]/80 to-[#0d1a0d]/90
      backdrop-blur-xl border border-[#3d5a3d]/30
      shadow-[0_8px_32px_rgba(0,0,0,0.4)]
      ${glow ? 'shadow-[0_0_20px_rgba(180,160,100,0.15)]' : ''}
      ${onClick ? 'cursor-pointer hover:border-[#b4a064]/40 transition-all duration-300' : ''}
      ${className}
    `}
  >
    {/* Subtle inner glow */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#b4a064]/5 to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

// Status Indicator with pulse
const StatusIndicator = ({ active, label, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-full ${active ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-red-400/70'}`} />
      {label && <span className="text-xs text-gray-300 uppercase tracking-wider font-medium">{label}</span>}
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, subtitle, status, onClick, disabled, highlight }) => (
  <GlassPanel 
    className={`p-4 ${disabled ? 'opacity-50' : ''} ${highlight ? 'border-[#b4a064]/50' : ''}`}
    onClick={!disabled ? onClick : undefined}
    glow={highlight}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${highlight ? 'bg-[#b4a064]/20' : 'bg-[#2a3a2a]'} border border-[#3d5a3d]/30`}>
          <Icon className={`w-5 h-5 ${highlight ? 'text-[#b4a064]' : 'text-emerald-400'}`} />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm tracking-wide">{title}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>
      {status && <StatusIndicator active={status === 'active'} size="sm" />}
      <ChevronRight className="w-4 h-4 text-gray-500" />
    </div>
  </GlassPanel>
);

// Priority Order Item
const PriorityOrderItem = ({ priority, title, description, status, time, onClick }) => {
  const priorityColors = {
    critical: 'border-l-red-500 bg-red-500/10',
    high: 'border-l-orange-500 bg-orange-500/10',
    medium: 'border-l-[#b4a064] bg-[#b4a064]/10',
    low: 'border-l-emerald-500 bg-emerald-500/10'
  };
  
  const statusColors = {
    pending: 'text-orange-400 bg-orange-400/20',
    active: 'text-emerald-400 bg-emerald-400/20',
    completed: 'text-gray-400 bg-gray-400/20'
  };

  return (
    <GlassPanel className={`p-4 border-l-4 ${priorityColors[priority]}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${statusColors[status]}`}>
              {status}
            </span>
            <span className="text-xs text-gray-500">{time}</span>
          </div>
          <h4 className="text-white font-semibold text-sm">{title}</h4>
          <p className="text-gray-400 text-xs mt-1 line-clamp-2">{description}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 ml-2 flex-shrink-0" />
      </div>
    </GlassPanel>
  );
};

// Team Member Badge
const TeamMemberBadge = ({ name, role, online }) => (
  <div className="flex items-center gap-2 p-2 rounded-lg bg-[#1a2a1a]/60">
    <div className="relative">
      <div className="w-8 h-8 rounded-full bg-[#2a3a2a] flex items-center justify-center border border-[#3d5a3d]/30">
        <span className="text-xs font-bold text-[#b4a064]">{name.charAt(0)}</span>
      </div>
      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d1a0d] ${online ? 'bg-emerald-400' : 'bg-gray-500'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-xs font-medium truncate">{name}</p>
      <p className="text-gray-500 text-[10px] uppercase tracking-wider">{role}</p>
    </div>
  </div>
);

// Main Component
export const PatrolCommander = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patrolId = searchParams.get('id') || searchParams.get('patrol_id');
  const accessCode = searchParams.get('code');
  
  // State
  const [patrol, setPatrol] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState({ latitude: null, longitude: null, accuracy: null });
  const [lastSync, setLastSync] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [mqttCredentials, setMqttCredentials] = useState(null);
  const [sosMessage, setSosMessage] = useState('');
  const [isSendingSOS, setIsSendingSOS] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [signalStrength, setSignalStrength] = useState('strong');
  
  // Code verification state - REQUIRED before tracking
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  
  // Messaging State
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Refs
  const watchIdRef = useRef(null);
  const wsRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const messagePollingRef = useRef(null);
  
  // Mock priority orders
  const [priorityOrders] = useState([
    { id: 1, priority: 'critical', title: 'Sector Alpha Perimeter Check', description: 'Complete full perimeter inspection of Sector Alpha. Report any anomalies immediately.', status: 'active', time: '10:45' },
    { id: 2, priority: 'high', title: 'Supply Route Verification', description: 'Verify supply route Delta-7 is clear and secure for convoy passage.', status: 'pending', time: '11:30' },
    { id: 3, priority: 'medium', title: 'Equipment Status Report', description: 'Submit detailed equipment status report to HQ Command.', status: 'pending', time: '14:00' },
  ]);

  // Mock team members
  const [teamMembers] = useState([
    { id: 1, name: 'Sgt. Rahman', role: 'Team Lead', online: true },
    { id: 2, name: 'Cpl. Ahmed', role: 'Navigator', online: true },
    { id: 3, name: 'Pvt. Hassan', role: 'Comms', online: false },
    { id: 4, name: 'Pvt. Karim', role: 'Support', online: true },
  ]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!patrolId || !patrol?.hq_id) return;
    try {
      const response = await fetch(`${API}/api/messages?hq_id=${patrol.hq_id}&patrol_id=${patrolId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.reverse()); // Show oldest first
        const unread = data.filter(m => !m.read && m.sender_type === 'hq').length;
        setUnreadMessages(unread);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [patrolId, patrol?.hq_id]);

  // Send message to HQ
  const sendMessageToHQ = async (e) => {
    e?.preventDefault();
    if (!newMessageText.trim() || !patrolId || !patrol?.hq_id) return;

    setIsSendingMessage(true);
    try {
      const response = await fetch(`${API}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessageText.trim(),
          sender_id: patrolId,
          sender_type: 'patrol',
          hq_id: patrol.hq_id,
          message_type: 'direct'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data.message]);
        setNewMessageText('');
        toast.success('Message sent to HQ');
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  // Verify access and load patrol info
  useEffect(() => {
    const verifyAccess = async () => {
      if (!patrolId) {
        toast.error('No patrol ID provided');
        setIsLoading(false);
        return;
      }
      
      try {
        const patrolResponse = await fetch(`${API}/api/patrol/${patrolId}`);
        if (!patrolResponse.ok) {
          toast.error('Patrol not found');
          setIsLoading(false);
          return;
        }
        
        const patrolData = await patrolResponse.json();
        setPatrol(patrolData);
        
        const mqttResponse = await fetch(`${API}/api/mqtt/credentials/${patrolId}`);
        if (mqttResponse.ok) {
          const mqttData = await mqttResponse.json();
          setMqttCredentials(mqttData);
        }
        
        connectWebSocket();
        
      } catch (error) {
        console.error('Error verifying access:', error);
        toast.error('Connection error');
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyAccess();
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (messagePollingRef.current) {
        clearInterval(messagePollingRef.current);
      }
    };
  }, [patrolId, accessCode]);

  // Load messages when patrol is set
  useEffect(() => {
    if (patrol?.hq_id) {
      loadMessages();
      // Poll for new messages every 10 seconds
      messagePollingRef.current = setInterval(loadMessages, 10000);
      return () => {
        if (messagePollingRef.current) {
          clearInterval(messagePollingRef.current);
        }
      };
    }
  }, [patrol?.hq_id, loadMessages]);

  // Code verification function - REQUIRED before tracking
  const verifyAccessCode = async () => {
    if (!enteredCode.trim()) {
      setCodeError('Please enter the access code');
      return;
    }
    
    setIsVerifyingCode(true);
    setCodeError('');
    
    try {
      const response = await fetch(`${API}/api/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patrol_id: patrolId,
          code: enteredCode.trim().toUpperCase()
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.verified) {
        setIsCodeVerified(true);
        toast.success('✓ Code verified! You can now start tracking.');
      } else {
        setCodeError(data.message || 'Invalid code. Please contact HQ for the correct code.');
        toast.error('Invalid access code');
      }
    } catch (error) {
      setCodeError('Network error. Please try again.');
      toast.error('Verification failed');
    } finally {
      setIsVerifyingCode(false);
    }
  };
  
  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!patrolId) return;
    
    try {
      const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
      wsRef.current = new WebSocket(`${wsUrl}/ws/patrol_${patrolId}`);
      
      wsRef.current.onopen = () => {
        setWsConnected(true);
        syncOfflineQueue();
      };
      
      wsRef.current.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = () => {
        setWsConnected(false);
      };
    } catch (error) {
      setWsConnected(false);
    }
  }, [patrolId]);
  
  // Start GPS tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    
    setIsTracking(true);
    toast.success('Location tracking activated');
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        setLocation(newLocation);
        sendLocationUpdate(newLocation);
      },
      (error) => {
        toast.error(`GPS Error: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    
    syncIntervalRef.current = setInterval(syncOfflineQueue, 30000);
  };
  
  // Stop GPS tracking
  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    setIsTracking(false);
    toast.info('Tracking deactivated');
  };
  
  // Send location update
  const sendLocationUpdate = async (loc) => {
    const payload = { lat: loc.latitude, lng: loc.longitude, timestamp: loc.timestamp };
    
    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'location_update', patrol_id: patrolId, ...payload }));
        setLastSync(new Date().toISOString());
        return;
      } catch (error) { /* fallback below */ }
    }
    
    try {
      const response = await fetch(`${API}/api/mqtt/location/${patrolId}?lat=${payload.lat}&lng=${payload.lng}`, { method: 'POST' });
      if (response.ok) {
        setLastSync(new Date().toISOString());
        return;
      }
    } catch (error) { /* queue below */ }
    
    setOfflineQueue(prev => [...prev, { type: 'location', ...payload }]);
  };
  
  // Sync offline queue
  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    
    const queue = [...offlineQueue];
    setOfflineQueue([]);
    
    for (const item of queue) {
      try {
        if (item.type === 'location') {
          await fetch(`${API}/api/mqtt/location/${patrolId}?lat=${item.lat}&lng=${item.lng}`, { method: 'POST' });
        }
      } catch (error) {
        setOfflineQueue(prev => [...prev, item]);
      }
    }
    
    if (queue.length > 0) {
      toast.success(`Synced ${queue.length} updates`);
      setLastSync(new Date().toISOString());
    }
  };
  
  // Send SOS
  const sendSOS = async () => {
    if (!location.latitude || !location.longitude) {
      toast.error('Enable GPS first');
      return;
    }
    
    setIsSendingSOS(true);
    
    const sosPayload = {
      patrol_id: patrolId,
      message: sosMessage || 'EMERGENCY SOS',
      latitude: location.latitude,
      longitude: location.longitude
    };
    
    try {
      const response = await fetch(`${API}/api/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sosPayload)
      });
      
      if (response.ok) {
        toast.success('SOS TRANSMITTED', { duration: 5000 });
        setSosMessage('');
      } else {
        setOfflineQueue(prev => [...prev, { type: 'sos', ...sosPayload }]);
        toast.warning('SOS queued');
      }
    } catch (error) {
      setOfflineQueue(prev => [...prev, { type: 'sos', ...sosPayload }]);
      toast.warning('SOS queued');
    } finally {
      setIsSendingSOS(false);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1a0d]/90 via-[#0d1a0d]/80 to-[#0d1a0d]/95" />
        <GlassPanel className="p-8 text-center relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-[#b4a064] mx-auto" />
          <p className="text-gray-300 mt-4 font-medium tracking-wide">ESTABLISHING SECURE CONNECTION...</p>
        </GlassPanel>
      </div>
    );
  }
  
  // No patrol found
  if (!patrol) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1a0d]/90 via-[#0d1a0d]/80 to-[#0d1a0d]/95" />
        <GlassPanel className="p-8 text-center max-w-md relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl text-white font-bold mb-2">ACCESS DENIED</h2>
          <p className="text-gray-400 text-sm mb-6">
            Invalid credentials or patrol not found. Contact HQ Command for assistance.
          </p>
          <Button onClick={() => navigate('/')} className="bg-[#b4a064] hover:bg-[#a08954] text-black font-bold">
            RETURN TO BASE
          </Button>
        </GlassPanel>
        
        {/* WASIQ Logo */}
        <img src={WASIQ_LOGO} alt="WASIQ" className="fixed bottom-4 right-4 w-16 h-16 object-contain opacity-60 z-10" />
      </div>
    );
  }

  // CODE VERIFICATION SCREEN - REQUIRED BEFORE TRACKING
  if (!isCodeVerified && !patrol?.code_verified) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          backgroundImage: `url(${BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1a0d]/90 via-[#0d1a0d]/80 to-[#0d1a0d]/95" />
        <GlassPanel className="p-6 max-w-sm w-full relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#b4a064]/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#b4a064]" />
            </div>
            <h2 className="text-xl text-white font-bold">IDENTITY VERIFICATION</h2>
            <p className="text-gray-400 text-sm mt-2">
              Enter the secret code provided by HQ Command
            </p>
          </div>
          
          {/* Patrol Info */}
          <div className="bg-[#1a2a1a]/50 rounded-lg p-3 mb-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Patrol</div>
            <div className="text-white font-medium">{patrol?.name}</div>
            <div className="text-gray-400 text-xs">{patrol?.unit} • {patrol?.assigned_area}</div>
          </div>
          
          {/* Code Input */}
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Secret Access Code
              </label>
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={enteredCode}
                onChange={(e) => {
                  setEnteredCode(e.target.value.toUpperCase());
                  setCodeError('');
                }}
                className="bg-[#1a2a1a] border-[#3d5a3d]/30 text-white text-center text-2xl font-mono tracking-[0.5em] h-14"
                maxLength={6}
                data-testid="code-input"
              />
              {codeError && (
                <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {codeError}
                </p>
              )}
            </div>
            
            <Button
              onClick={verifyAccessCode}
              disabled={isVerifyingCode || enteredCode.length < 4}
              className="w-full h-12 bg-[#b4a064] hover:bg-[#a08954] text-black font-bold"
              data-testid="verify-code-btn"
            >
              {isVerifyingCode ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  VERIFY & PROCEED
                </>
              )}
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Don't have the code? Call your HQ Command.
              </p>
            </div>
          </div>
        </GlassPanel>
        
        {/* WASIQ Logo */}
        <img src={WASIQ_LOGO} alt="WASIQ" className="fixed bottom-4 right-4 w-16 h-16 object-contain opacity-60 z-10" />
      </div>
    );
  }

  // Dashboard View
  const renderDashboard = () => (
    <div className="space-y-4 pb-24">
      {/* Status Bar */}
      <GlassPanel className="p-3" glow>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#b4a064]/20">
              <Shield className="w-5 h-5 text-[#b4a064]" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">{patrol.name}</h2>
              <p className="text-gray-400 text-xs">{patrol.unit || 'Active Patrol'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusIndicator active={wsConnected} label={wsConnected ? 'LIVE' : 'OFFLINE'} />
          </div>
        </div>
      </GlassPanel>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassPanel className="p-3 text-center">
          <Signal className={`w-5 h-5 mx-auto mb-1 ${signalStrength === 'strong' ? 'text-emerald-400' : 'text-orange-400'}`} />
          <p className="text-[10px] text-gray-400 uppercase">Signal</p>
          <p className="text-white text-xs font-bold">{signalStrength.toUpperCase()}</p>
        </GlassPanel>
        <GlassPanel className="p-3 text-center">
          <Battery className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
          <p className="text-[10px] text-gray-400 uppercase">Battery</p>
          <p className="text-white text-xs font-bold">{batteryLevel}%</p>
        </GlassPanel>
        <GlassPanel className="p-3 text-center">
          <Activity className="w-5 h-5 mx-auto mb-1 text-[#b4a064]" />
          <p className="text-[10px] text-gray-400 uppercase">Queued</p>
          <p className="text-white text-xs font-bold">{offlineQueue.length}</p>
        </GlassPanel>
      </div>

      {/* Current Location */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#b4a064]" />
            <span className="text-xs text-gray-300 uppercase tracking-wider font-medium">Current Position</span>
          </div>
          {lastSync && (
            <span className="text-[10px] text-gray-500">
              {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Latitude</p>
            <p className="text-white font-mono text-sm">{location.latitude?.toFixed(6) || '---.------'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Longitude</p>
            <p className="text-white font-mono text-sm">{location.longitude?.toFixed(6) || '---.------'}</p>
          </div>
        </div>
        {location.accuracy && (
          <p className="text-[10px] text-gray-500 mt-2">Accuracy: ±{location.accuracy.toFixed(0)}m</p>
        )}
      </GlassPanel>

      {/* Tracking Control */}
      <Button
        onClick={isTracking ? stopTracking : startTracking}
        className={`w-full h-14 text-sm font-bold tracking-wider ${
          isTracking 
            ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' 
            : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
        }`}
        data-testid="tracking-button"
      >
        {isTracking ? (
          <>
            <Radio className="w-5 h-5 mr-2 animate-pulse" />
            TRACKING ACTIVE - TAP TO STOP
          </>
        ) : (
          <>
            <Navigation className="w-5 h-5 mr-2" />
            ACTIVATE LIVE TRACKING
          </>
        )}
      </Button>

      {/* Priority Orders Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-gray-300 uppercase tracking-wider font-bold">Priority Orders</h3>
          <span className="text-[10px] text-[#b4a064] font-medium">{priorityOrders.length} Active</span>
        </div>
        <div className="space-y-3">
          {priorityOrders.map(order => (
            <PriorityOrderItem
              key={order.id}
              {...order}
              onClick={() => toast.info(`Viewing order: ${order.title}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Features View
  const renderFeatures = () => (
    <div className="space-y-4 pb-24">
      <h3 className="text-xs text-gray-300 uppercase tracking-wider font-bold mb-4">Patrol Features</h3>
      
      <FeatureCard
        icon={Navigation}
        title="Live Tracking"
        subtitle="Real-time GPS location sharing"
        status={isTracking ? 'active' : 'inactive'}
        onClick={() => setActiveView('dashboard')}
        highlight={isTracking}
      />
      
      <FeatureCard
        icon={Route}
        title="Route Optimization"
        subtitle="AI-powered patrol route planning"
        onClick={() => toast.info('Route optimization coming soon')}
      />
      
      <FeatureCard
        icon={MessageSquare}
        title="Secure Messaging"
        subtitle="Encrypted HQ communications"
        onClick={() => setActiveView('messages')}
        highlight={unreadMessages > 0}
        status={unreadMessages > 0 ? 'active' : undefined}
      />
      
      <FeatureCard
        icon={FileWarning}
        title="Incident Reporting"
        subtitle="Quick incident documentation"
        onClick={() => toast.info('Incident reporting coming soon')}
      />
      
      <FeatureCard
        icon={Package}
        title="Asset Status"
        subtitle="Equipment and supply tracking"
        onClick={() => toast.info('Asset management coming soon')}
      />
      
      <FeatureCard
        icon={Users}
        title="Team Presence"
        subtitle="Team member locations and status"
        onClick={() => setActiveView('team')}
      />
    </div>
  );

  // Messaging View
  const renderMessages = () => (
    <div className="space-y-4 pb-24 flex flex-col h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-gray-300 uppercase tracking-wider font-bold">HQ Messages</h3>
        {unreadMessages > 0 && (
          <span className="px-2 py-0.5 bg-[#b4a064] text-black text-xs font-bold rounded-full">
            {unreadMessages} new
          </span>
        )}
      </div>
      
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <GlassPanel className="p-6 text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-500" />
            <p className="text-gray-400 text-sm">No messages yet</p>
            <p className="text-gray-500 text-xs mt-1">Messages from HQ will appear here</p>
          </GlassPanel>
        ) : (
          messages.map(msg => (
            <GlassPanel 
              key={msg.id} 
              className={`p-3 ${msg.sender_type === 'patrol' ? 'ml-4 bg-[#b4a064]/10 border-[#b4a064]/30' : 'mr-4'}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs text-[#b4a064] font-medium">
                  {msg.sender_type === 'patrol' ? 'You' : msg.sender_name}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-white text-sm">{msg.content}</p>
              {msg.message_type === 'broadcast' && (
                <span className="text-[10px] text-orange-400 mt-1 block">📢 Broadcast</span>
              )}
            </GlassPanel>
          ))
        )}
      </div>

      {/* Message Input */}
      <GlassPanel className="p-3">
        <form onSubmit={sendMessageToHQ} className="flex gap-2">
          <input
            type="text"
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder="Message to HQ..."
            className="flex-1 bg-[#1a2a1a] border border-[#3d5a3d]/30 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#b4a064]/50"
            data-testid="patrol-message-input"
          />
          <Button 
            type="submit"
            disabled={!newMessageText.trim() || isSendingMessage}
            className="bg-[#b4a064] hover:bg-[#a08954] text-black"
            data-testid="patrol-send-btn"
          >
            {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </GlassPanel>
    </div>
  );

  // Team View
  const renderTeam = () => (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-gray-300 uppercase tracking-wider font-bold">Team Presence</h3>
        <span className="text-[10px] text-emerald-400 font-medium">
          {teamMembers.filter(m => m.online).length}/{teamMembers.length} Online
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {teamMembers.map(member => (
          <GlassPanel key={member.id} className="p-0">
            <TeamMemberBadge {...member} />
          </GlassPanel>
        ))}
      </div>

      {/* Team Actions */}
      <div className="mt-6 space-y-3">
        <Button className="w-full bg-[#2a3a2a] hover:bg-[#3a4a3a] border border-[#3d5a3d]/30 text-white">
          <Phone className="w-4 h-4 mr-2 text-[#b4a064]" />
          Team Voice Call
        </Button>
        <Button className="w-full bg-[#2a3a2a] hover:bg-[#3a4a3a] border border-[#3d5a3d]/30 text-white">
          <Eye className="w-4 h-4 mr-2 text-[#b4a064]" />
          View All Positions
        </Button>
      </div>
    </div>
  );

  // SOS View
  const renderSOS = () => (
    <div className="space-y-4 pb-24">
      <GlassPanel className="p-6 border-2 border-red-500/50 bg-red-900/20">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/50">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-xl text-red-400 font-bold mb-2">EMERGENCY SOS</h2>
          <p className="text-gray-400 text-sm">
            Send immediate distress signal to HQ Command
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
              Emergency Message (Optional)
            </label>
            <Input
              placeholder="Describe the emergency..."
              value={sosMessage}
              onChange={(e) => setSosMessage(e.target.value)}
              className="bg-[#1a1a1a] border-red-500/30 focus:border-red-500 text-white"
            />
          </div>

          <div className="bg-[#1a1a1a]/50 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Your Location</p>
            <p className="text-white font-mono text-sm">
              {location.latitude?.toFixed(6) || '--'}, {location.longitude?.toFixed(6) || '--'}
            </p>
          </div>

          <Button
            onClick={sendSOS}
            disabled={isSendingSOS || (!location.latitude && !location.longitude)}
            className="w-full h-16 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-lg tracking-wider"
            data-testid="sos-button"
          >
            {isSendingSOS ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Zap className="w-6 h-6 mr-2" />
                TRANSMIT SOS
              </>
            )}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Background Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0d1a0d]/90 via-[#0d1a0d]/85 to-[#0d1a0d]/95 pointer-events-none" />
      
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0d1a0d]/80 border-b border-[#3d5a3d]/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#b4a064] to-[#8a7a4a] flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-wide">PATROL COMMANDER</h1>
              <p className="text-[10px] text-[#b4a064]">TACTICAL OPERATIONS</p>
            </div>
          </div>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg bg-[#1a2a1a]/80 border border-[#3d5a3d]/30"
          >
            {showMenu ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-[#0d1a0d]/95 backdrop-blur-xl p-4 pt-20">
          <div className="space-y-3">
            {mqttCredentials && (
              <GlassPanel className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Signal className="w-4 h-4 text-[#b4a064]" />
                  <span className="text-xs text-gray-300 uppercase tracking-wider">MQTT Low-Network Mode</span>
                </div>
                <div className="bg-[#0d0d0d] rounded p-3 font-mono text-[10px] space-y-1 text-gray-400">
                  <div>Broker: {mqttCredentials.broker_host}:{mqttCredentials.broker_port}</div>
                  <div>Topic: {mqttCredentials.topics?.location}</div>
                </div>
              </GlassPanel>
            )}
            <Button 
              onClick={() => { navigate('/'); setShowMenu(false); }}
              variant="ghost"
              className="w-full justify-start text-gray-300 hover:text-white"
            >
              Return to Base
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 px-4 py-4">
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'features' && renderFeatures()}
        {activeView === 'team' && renderTeam()}
        {activeView === 'messages' && renderMessages()}
        {activeView === 'sos' && renderSOS()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl bg-[#0d1a0d]/90 border-t border-[#3d5a3d]/30">
        <div className="flex items-center justify-around py-2 px-4">
          {[
            { id: 'dashboard', icon: Target, label: 'Dashboard' },
            { id: 'features', icon: Compass, label: 'Features' },
            { id: 'messages', icon: MessageSquare, label: 'Messages', badge: unreadMessages },
            { id: 'sos', icon: AlertTriangle, label: 'SOS', danger: true },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`relative flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-all ${
                activeView === item.id 
                  ? item.danger 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-[#b4a064]/20 text-[#b4a064]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <item.icon className={`w-5 h-5 ${item.danger && activeView === item.id ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] uppercase tracking-wider font-medium">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#b4a064] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Powered By */}
        <div className="text-center pb-2">
          <p className="text-[9px] text-gray-600 tracking-wider">POWERED BY BA-8993 MAJOR WAHID</p>
        </div>
      </div>

      {/* WASIQ Logo Emblem */}
      <img 
        src={WASIQ_LOGO} 
        alt="WASIQ" 
        className="fixed bottom-20 right-4 w-12 h-12 object-contain opacity-40 z-20 rounded-lg"
        style={{ filter: 'grayscale(30%) contrast(1.2)' }}
      />
    </div>
  );
};

export default PatrolCommander;
