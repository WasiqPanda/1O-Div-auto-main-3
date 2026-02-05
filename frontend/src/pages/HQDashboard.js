import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, CheckCircle, Radio, Bell, PanelRightClose, PanelRight, AlertTriangle, Clock, Lock, Shield, Signal, Wifi, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

import { MapDisplay } from '@/components/hq/MapDisplay';
import { PatrolList } from '@/components/hq/PatrolList';
import { ControlPanel } from '@/components/hq/ControlPanel';
import { CodeDialog, EditPatrolDialog, DeleteConfirmDialog } from '@/components/hq/Dialogs';
import { NewPatrolForm } from '@/components/hq/NewPatrolForm';
import { NotificationsPanel } from '@/components/hq/NotificationsPanel';
import { HistoryDialog } from '@/components/hq/HistoryDialog';
import { SessionManager } from '@/components/hq/SessionManager';
import { JitsiMeetModal } from '@/components/hq/JitsiMeetModal';
import { SecureMessaging } from '@/components/hq/SecureMessaging';
import { SOSAlertsPanel } from '@/components/hq/SOSAlerts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');

// Background and Logo
const WASIQ_LOGO = 'https://customer-assets.emergentagent.com/job_2d9837ea-ce33-42ad-9eb8-91e7ec7df4fd/artifacts/01u6pvnf_IMG_8593.jpg';
const TACTICAL_BG = 'https://customer-assets.emergentagent.com/job_2d9837ea-ce33-42ad-9eb8-91e7ec7df4fd/artifacts/lt1jykmh_IMG_8817.PNG';

// Session storage key
const SESSION_KEY = 'hq_patrol_session';

// Format time remaining
const formatTimeRemaining = (timeRemaining) => {
  if (!timeRemaining) return '';
  const { days, hours, minutes } = timeRemaining;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// Glassmorphism stat display component
const StatItem = ({ label, value, icon: Icon, status = 'inactive', onClick }) => {
  const colors = {
    active: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    inactive: 'text-gray-500',
    tracking: 'text-cyan-400'
  };
  const bgColors = {
    active: 'from-emerald-500/20 to-emerald-500/5',
    warning: 'from-amber-500/20 to-amber-500/5',
    danger: 'from-red-500/20 to-red-500/5',
    inactive: 'from-gray-500/10 to-transparent',
    tracking: 'from-cyan-500/20 to-cyan-500/5'
  };
  
  const isTracking = label === 'Tracking' && value > 0;
  
  return (
    <div 
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg
        bg-gradient-to-r ${bgColors[status] || bgColors.inactive}
        backdrop-blur-sm border border-[#3d5a3d]/40
        ${onClick ? 'cursor-pointer hover:border-[#b4a064]/50 transition-all' : ''}
        ${isTracking ? 'animate-pulse border-cyan-500/50' : ''}
      `}
      onClick={onClick}
    >
      <Icon className={`w-4 h-4 ${colors[status] || 'text-gray-500'} ${isTracking ? 'animate-bounce' : ''}`} />
      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-sm font-mono font-bold ${colors[status] || 'text-white'}`}>{value}</span>
      {isTracking && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
    </div>
  );
};

// Subscription Warning Banner
const SubscriptionBanner = ({ subscription, onUpgrade }) => {
  if (!subscription || subscription.status === 'active') return null;
  
  if (subscription.status === 'expired') {
    return (
      <div className="bg-red-500/20 border-b border-red-500 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-400">
          <Lock className="w-4 h-4" />
          <span className="text-sm font-medium">Subscription Expired</span>
          <span className="text-xs">Contact endora.dream@gmail.com to renew</span>
        </div>
        <Button size="sm" variant="destructive" onClick={onUpgrade}>
          Renew Now
        </Button>
      </div>
    );
  }
  
  return null;
};

// Subscription Status Dialog
const SubscriptionDialog = ({ open, onOpenChange, subscription }) => {
  if (!subscription) return null;
  
  const planColors = {
    trial: 'text-blue-400',
    normal: 'text-green-400',
    pro: 'text-purple-400'
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-tactical-panel border-tactical-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Subscription Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Plan</span>
            <span className={`font-bold uppercase ${planColors[subscription.plan] || 'text-white'}`}>
              {subscription.plan}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Status</span>
            <span className={subscription.status === 'active' ? 'text-green-400' : 'text-red-400'}>
              {subscription.status?.toUpperCase()}
            </span>
          </div>
          {subscription.time_remaining && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Time Remaining</span>
              <span className="text-white font-mono">
                {formatTimeRemaining(subscription.time_remaining)}
              </span>
            </div>
          )}
          <div className="border-t border-tactical-border pt-4 space-y-2">
            <h4 className="text-sm font-heading text-gray-400">LIMITS</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Patrols:</span>
                <span className="ml-2 text-white">{subscription.usage?.patrols || 0}/{subscription.limits?.max_patrols || 3}</span>
              </div>
              <div>
                <span className="text-gray-500">Tracking:</span>
                <span className="ml-2 text-white">{subscription.usage?.tracking || 0}/{subscription.limits?.max_tracking || 3}</span>
              </div>
              <div>
                <span className="text-gray-500">Session:</span>
                <span className="ml-2 text-white">{subscription.limits?.session_duration_min || 30}min</span>
              </div>
              <div>
                <span className="text-gray-500">Trail History:</span>
                <span className="ml-2 text-white">{subscription.limits?.trail_history_hours || 6}h</span>
              </div>
            </div>
          </div>
          {subscription.plan === 'trial' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs text-yellow-400">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Trial plan has limited features. Contact endora.dream@gmail.com to upgrade.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Expired Subscription Overlay - blocks all dashboard access
const ExpiredOverlay = ({ subscription, onLogout }) => {
  if (!subscription || subscription.status !== 'expired') return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" data-testid="expired-overlay">
      <div className="bg-tactical-panel border-2 border-red-500 rounded-lg p-8 max-w-md text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-heading text-red-400">Subscription Expired</h2>
        <p className="text-gray-400">
          Your <span className="text-white font-bold uppercase">{subscription.plan || 'Trial'}</span> plan has expired.
          Please contact the administrator to renew your subscription.
        </p>
        <div className="bg-tactical-surface rounded p-4 text-sm">
          <p className="text-gray-300">Contact for Renewal:</p>
          <a href="mailto:endora.dream@gmail.com" className="text-primary hover:underline font-mono">
            endora.dream@gmail.com
          </a>
        </div>
        <Button variant="outline" className="w-full" onClick={onLogout}>
          <Lock className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

// Subscription Info Badge for header
const SubscriptionBadge = ({ subscription, onClick }) => {
  if (!subscription) return null;
  
  const planColors = {
    trial: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    normal: 'bg-green-500/20 text-green-400 border-green-500/50',
    pro: 'bg-purple-500/20 text-purple-400 border-purple-500/50'
  };
  
  const colorClass = planColors[subscription.plan] || planColors.trial;
  const usage = subscription.usage || { patrols: 0 };
  const limits = subscription.limits || { max_patrols: 3 };
  const isNearLimit = usage.patrols >= limits.max_patrols * 0.8;
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-mono uppercase ${colorClass} hover:opacity-80 transition-opacity`}
      data-testid="subscription-badge"
    >
      <span>{subscription.plan || 'Trial'}</span>
      <span className={`${isNearLimit ? 'text-yellow-400' : ''}`}>
        {usage.patrols}/{limits.max_patrols}
      </span>
    </button>
  );
};

export const HQDashboard = () => {
  const navigate = useNavigate();
  const [patrols, setPatrols] = useState([]);
  const [selectedPatrolId, setSelectedPatrolId] = useState(null);
  const [trail, setTrail] = useState([]);
  const [allTrails, setAllTrails] = useState([]);
  const [stats, setStats] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  
  // Visibility state for each patrol
  const [visiblePatrols, setVisiblePatrols] = useState({});
  
  // UI State
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('patrols');
  
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [codeData, setCodeData] = useState(null);
  
  const [newPatrol, setNewPatrol] = useState({ name: '', camp_name: '', unit: '', leader_email: '', phone_number: '', assigned_area: '' });
  const [editPatrol, setEditPatrol] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePatrolId, setDeletePatrolId] = useState(null);
  
  // History
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Jitsi Video Call
  const [showJitsiModal, setShowJitsiModal] = useState(false);
  const [callPatrol, setCallPatrol] = useState(null);
  
  // Secure Messaging
  const [showMessaging, setShowMessaging] = useState(false);
  const [messagePatrolId, setMessagePatrolId] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  
  // SOS Alerts
  const [sosAlerts, setSosAlerts] = useState([]);
  const [showSOSPanel, setShowSOSPanel] = useState(false);
  
  const [mapType, setMapType] = useState('normal');
  const [showTrails, setShowTrails] = useState(true);
  const [showHeatMap, setShowHeatMap] = useState(false);
  
  const [hqId, setHqId] = useState('');
  const [hqName, setHqName] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCamp, setFilterCamp] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOptions, setFilterOptions] = useState({ camps: [], units: [] });

  // WebSocket ref
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const fetchPatrolsRef = useRef(null);
  const sosPollingRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Ref for map control
  const mapRef = useRef(null);

  // WebSocket connection - using ref to avoid self-reference in useCallback
  const connectWebSocketRef = useRef(null);
  
  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling
    console.log('Starting HTTP polling fallback');
    pollingIntervalRef.current = setInterval(() => {
      if (hqId && fetchPatrolsRef.current) {
        fetchPatrolsRef.current();
      }
    }, 5000); // Poll every 5 seconds
  }, [hqId]);
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('Stopped HTTP polling');
    }
  }, []);
  
  useEffect(() => {
    connectWebSocketRef.current = () => {
      if (!hqId || wsRef.current?.readyState === WebSocket.OPEN) return;
      
      try {
        const wsUrl = `${WS_URL}/ws/${hqId}`;
        console.log('Connecting to WebSocket:', wsUrl);
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected successfully');
          setWsConnected(true);
          stopPolling(); // Stop polling when WebSocket connects
          // Subscribe to HQ updates
          wsRef.current.send(JSON.stringify({ type: 'subscribe', hq_id: hqId }));
          toast.success('Real-time connection established', { duration: 2000 });
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message:', data.type);
            
            // Handle different message types
            if (data.type === 'patrol_location' || data.type === 'location_update') {
              // Real-time location update
              setPatrols(prev => prev.map(p => 
                p.id === data.patrol_id 
                  ? { 
                      ...p, 
                      latitude: data.latitude, 
                      longitude: data.longitude, 
                      last_update: data.timestamp,
                      is_tracking: true
                    }
                  : p
              ));
            } else if (data.type === 'patrol_update') {
              // General patrol update
              setPatrols(prev => prev.map(p => p.id === data.patrol?.id ? { ...p, ...data.patrol } : p));
            } else if (data.type === 'sos_alert') {
              // SOS alert
              toast.error(`SOS ALERT from Patrol ${data.patrol_id}`, { duration: 10000 });
              setNotifications(prev => [{
                id: Date.now(),
                message: `SOS ALERT: ${data.message}`,
                level: 'critical',
                timestamp: data.timestamp
              }, ...prev]);
              setStats(prev => ({ ...prev, notifications: (prev.notifications || 0) + 1 }));
            } else if (data.type === 'notification') {
              setNotifications(prev => [data.notification, ...prev]);
              setStats(prev => ({ ...prev, notifications: (prev.notifications || 0) + 1 }));
            }
          } catch (e) {
            console.error('WebSocket message parse error:', e);
          }
        };
        
        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected, code:', event.code);
          setWsConnected(false);
          startPolling(); // Start polling as fallback
          // Attempt reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocketRef.current?.();
          }, 5000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setWsConnected(false);
        };
      } catch (e) {
        console.error('WebSocket connection error:', e);
        setWsConnected(false);
        startPolling(); // Start polling as fallback
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocketRef.current?.();
        }, 5000);
      }
    };
  }, [hqId, startPolling, stopPolling]);

  // Fetch subscription status
  const fetchSubscription = useCallback(async (hqIdParam) => {
    if (!hqIdParam) return;
    try {
      const response = await axios.get(`${API}/subscription/status?hq_id=${hqIdParam}`);
      setSubscription(response.data);
      setIsLoadingSubscription(false);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setIsLoadingSubscription(false);
    }
  }, []);

  // Handle logout
  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate('/');
  }, [navigate]);

  // Load session data from localStorage
  useEffect(() => {
    const storedHqId = localStorage.getItem('hq_id');
    const storedHqName = localStorage.getItem('hq_name');
    const storedIsSuperAdmin = localStorage.getItem('is_super_admin') === 'true';
    
    if (!storedHqId) {
      toast.error('Please login first');
      window.location.href = '/';
      return;
    }
    setHqId(storedHqId);
    setHqName(storedHqName || 'Unknown HQ');
    setIsSuperAdmin(storedIsSuperAdmin);
    
    // Fetch subscription status
    fetchSubscription(storedHqId);
    
    // Load visibility preferences from session
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.visiblePatrols) {
          setVisiblePatrols(session.visiblePatrols);
        }
        if (session.selectedPatrolId) {
          setSelectedPatrolId(session.selectedPatrolId);
        }
        if (session.sidePanelOpen !== undefined) {
          setSidePanelOpen(session.sidePanelOpen);
        }
      } catch (e) {
        console.error('Error loading session:', e);
      }
    }
    
    if (storedIsSuperAdmin) {
      toast.info('Super Admin Mode', { duration: 2000 });
    }
  }, [fetchSubscription]);

  // Connect WebSocket when hqId is set
  useEffect(() => {
    if (hqId) {
      connectWebSocketRef.current?.();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [hqId]);

  // Save session data to localStorage
  useEffect(() => {
    if (hqId) {
      const session = {
        visiblePatrols,
        selectedPatrolId,
        sidePanelOpen,
        lastUpdate: new Date().toISOString()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }, [visiblePatrols, selectedPatrolId, sidePanelOpen, hqId]);

  // Initialize visibility for new patrols - show patrols with location data (interacted)
  useEffect(() => {
    const newVisibility = { ...visiblePatrols };
    let hasChanges = false;
    
    patrols.forEach(patrol => {
      if (newVisibility[patrol.id] === undefined) {
        // Show patrol if it has location data (interacted within a session)
        const hasLocationData = patrol.latitude !== 0 || patrol.longitude !== 0 || patrol.is_tracking;
        newVisibility[patrol.id] = hasLocationData;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setVisiblePatrols(newVisibility);
    }
  }, [patrols]);

  const fetchPatrols = useCallback(async () => {
    if (!hqId) return;
    try {
      let url = `${API}/patrols?hq_id=${hqId}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (filterCamp) url += `&camp_name=${encodeURIComponent(filterCamp)}`;
      if (filterUnit) url += `&unit=${encodeURIComponent(filterUnit)}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      
      const response = await axios.get(url);
      setPatrols(response.data);
    } catch (error) {
      console.error('Error fetching patrols:', error);
    }
  }, [hqId, searchQuery, filterCamp, filterUnit, filterStatus]);

  // Keep fetchPatrolsRef updated
  useEffect(() => {
    fetchPatrolsRef.current = fetchPatrols;
  }, [fetchPatrols]);

  const fetchFilterOptions = useCallback(async () => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/patrols/filters/options?hq_id=${hqId}`);
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }, [hqId]);

  const fetchAllTrails = useCallback(async () => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/patrols/trails/all?hq_id=${hqId}&hours=24`);
      setAllTrails(response.data);
    } catch (error) {
      console.error('Error fetching trails:', error);
    }
  }, [hqId]);

  const fetchStats = useCallback(async () => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/stats?hq_id=${hqId}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [hqId]);

  // Fetch SOS alerts
  const fetchSOSAlerts = useCallback(async () => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/sos/active?hq_id=${hqId}`);
      setSosAlerts(response.data);
    } catch (error) {
      console.error('Error fetching SOS alerts:', error);
    }
  }, [hqId]);

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/messages/unread-count?hq_id=${hqId}`);
      setUnreadMessageCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [hqId]);

  // Handle resolve SOS
  const handleResolveSOS = async (patrolId) => {
    try {
      await axios.post(`${API}/sos/resolve/${patrolId}`);
      toast.success('SOS Alert Resolved');
      fetchSOSAlerts();
      fetchPatrols();
    } catch (error) {
      toast.error('Failed to resolve SOS');
    }
  };

  // Handle locate SOS - focus map on patrol
  const handleLocateSOS = (alert) => {
    if (mapRef.current && alert.latitude && alert.longitude) {
      mapRef.current.flyTo([alert.latitude, alert.longitude], 16);
      setSelectedPatrolId(alert.patrol_id);
    }
  };

  // Open messaging for a specific patrol
  const openMessagingForPatrol = (patrolId) => {
    setMessagePatrolId(patrolId);
    setShowMessaging(true);
  };

  const fetchNotifications = useCallback(async () => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/notifications?hq_id=${hqId}`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [hqId]);

  const fetchTrail = useCallback(async (patrolId) => {
    try {
      const response = await axios.get(`${API}/patrols/${patrolId}/trail?hours=24`);
      if (response.data && response.data.points) {
        setTrail(response.data.points.map(p => [p.latitude, p.longitude]));
      }
    } catch (error) {
      console.error('Error fetching trail:', error);
      setTrail([]);
    }
  }, []);

  const fetchHistory = useCallback(async (date) => {
    if (!hqId) return;
    try {
      const response = await axios.get(`${API}/patrols/history?hq_id=${hqId}&date=${date}`);
      setHistoryData(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistoryData([]);
    }
  }, [hqId]);

  useEffect(() => {
    if (!hqId) return;
    
    fetchPatrols();
    fetchStats();
    fetchNotifications();
    fetchFilterOptions();
    fetchAllTrails();
    fetchSOSAlerts();
    fetchUnreadCount();

    // Polling as fallback (less frequent when WebSocket is working)
    const pollingInterval = setInterval(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        fetchPatrols();
        fetchAllTrails();
      }
    }, 10000);

    const statsInterval = setInterval(() => {
      fetchStats();
      fetchNotifications();
      fetchUnreadCount();
    }, 15000);

    // SOS Alert polling - more frequent for critical alerts
    sosPollingRef.current = setInterval(() => {
      fetchSOSAlerts();
    }, 30000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(statsInterval);
      if (sosPollingRef.current) {
        clearInterval(sosPollingRef.current);
      }
    };
  }, [hqId, fetchPatrols, fetchStats, fetchNotifications, fetchFilterOptions, fetchAllTrails, fetchSOSAlerts, fetchUnreadCount]);

  // Handle patrol click from list - fly to map
  const handlePatrolClickFromList = (patrol) => {
    setSelectedPatrolId(patrol.id);
    if (patrol.is_tracking || patrol.latitude !== 0) {
      fetchTrail(patrol.id);
      if (mapRef.current) {
        mapRef.current.flyToPatrol(patrol.id);
      }
    } else {
      setTrail([]);
    }
  };

  // Handle patrol click from map - highlight in list
  const handlePatrolClickFromMap = (patrol) => {
    setSelectedPatrolId(patrol.id);
    if (patrol.is_tracking || patrol.latitude !== 0) {
      fetchTrail(patrol.id);
    }
  };

  // Toggle visibility of a patrol
  const handleToggleVisibility = (patrolId) => {
    setVisiblePatrols(prev => ({
      ...prev,
      [patrolId]: !prev[patrolId]
    }));
  };

  const handleShowAll = () => {
    const allVisible = {};
    patrols.forEach(p => { allVisible[p.id] = true; });
    setVisiblePatrols(allVisible);
  };

  const handleHideAll = () => {
    const allHidden = {};
    patrols.forEach(p => { allHidden[p.id] = false; });
    setVisiblePatrols(allHidden);
  };

  // Show only patrols with location data (interacted within a session)
  const handleShowActive = () => {
    const activeVisible = {};
    patrols.forEach(p => { 
      const hasLocationData = p.latitude !== 0 || p.longitude !== 0 || p.is_tracking;
      activeVisible[p.id] = hasLocationData;
    });
    setVisiblePatrols(activeVisible);
    toast.success(`Showing patrols with location data`);
  };

  const handleGenerateCode = async (patrol) => {
    try {
      const response = await axios.post(`${API}/codes/generate?patrol_id=${patrol.id}&email=${patrol.leader_email}`);
      // Include phone_number, patrol_name, and email in codeData
      setCodeData({
        ...response.data,
        phone_number: patrol.phone_number,
        patrol_name: patrol.name,
        leader_email: patrol.leader_email
      });
      setShowCodeDialog(true);
      toast.success(`Access Code generated`);
    } catch (error) {
      toast.error('Failed to generate access code');
    }
  };

  const handleCreatePatrol = async () => {
    if (!newPatrol.name.trim()) {
      toast.error('Patrol name is required');
      return;
    }
    
    // Check patrol limit
    if (subscription && !subscription.can_create_patrol) {
      const limits = subscription.limits || { max_patrols: 3 };
      const usage = subscription.usage || { patrols: 0 };
      toast.error(`Patrol limit reached (${usage.patrols}/${limits.max_patrols}). Upgrade your plan to add more.`);
      return;
    }
    
    try {
      const payload = { ...newPatrol, soldier_ids: [], hq_id: hqId };
      await axios.post(`${API}/patrols`, payload);
      toast.success('Patrol created');
      setNewPatrol({ name: '', camp_name: '', unit: '', leader_email: '', assigned_area: '' });
      setActiveTab('patrols');
      fetchPatrols();
      fetchStats();
      fetchFilterOptions();
      // Refresh subscription to update usage counts
      fetchSubscription(hqId);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to create patrol';
      toast.error(errorMsg);
    }
  };

  const handleEditPatrol = (patrol) => {
    setEditPatrol({
      id: patrol.id,
      name: patrol.name,
      camp_name: patrol.camp_name,
      unit: patrol.unit,
      leader_email: patrol.leader_email,
      assigned_area: patrol.assigned_area,
      status: patrol.status
    });
    setShowEditDialog(true);
  };

  const handleUpdatePatrol = async () => {
    try {
      await axios.put(`${API}/patrols/${editPatrol.id}/details`, {
        name: editPatrol.name,
        camp_name: editPatrol.camp_name,
        unit: editPatrol.unit,
        leader_email: editPatrol.leader_email,
        assigned_area: editPatrol.assigned_area,
        status: editPatrol.status
      });
      toast.success('Patrol updated');
      setShowEditDialog(false);
      setEditPatrol(null);
      fetchPatrols();
      fetchFilterOptions();
    } catch (error) {
      toast.error('Failed to update patrol');
    }
  };

  const handleDeleteClick = (patrolId) => {
    setDeletePatrolId(patrolId);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`${API}/patrols/${deletePatrolId}?hq_id=${hqId}`);
      toast.success('Patrol deleted');
      setShowDeleteDialog(false);
      setDeletePatrolId(null);
      setVisiblePatrols(prev => {
        const updated = { ...prev };
        delete updated[deletePatrolId];
        return updated;
      });
      if (selectedPatrolId === deletePatrolId) {
        setSelectedPatrolId(null);
        setTrail([]);
      }
      fetchPatrols();
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete patrol');
    }
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/read`);
      fetchNotifications();
      fetchStats();
    } catch (error) {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await axios.patch(`${API}/notifications/read-all?hq_id=${hqId}`);
      toast.success('All read');
      fetchNotifications();
      fetchStats();
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterCamp('');
    setFilterUnit('');
    setFilterStatus('');
  };

  const handleViewHistory = () => {
    fetchHistory(selectedDate);
    setShowHistoryDialog(true);
  };

  // Handle initiating a video call to patrol
  const handleCallPatrol = (patrol) => {
    setCallPatrol(patrol);
    setShowJitsiModal(true);
    toast.info(`Initiating call with ${patrol.name}...`);
  };

  // Check if patrol creation is allowed
  const canCreatePatrol = subscription?.can_create_patrol !== false;
  const patrolLimitMessage = subscription && !canCreatePatrol 
    ? `Limit reached (${subscription.usage?.patrols || 0}/${subscription.limits?.max_patrols || 3})`
    : null;

  // Show loading state while fetching subscription
  if (isLoadingSubscription) {
    return (
      <div 
        className="h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url(${TACTICAL_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="loading-screen"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1a0d]/90 via-[#0d1a0d]/85 to-[#0d1a0d]/95" />
        <div className="relative z-10 text-center space-y-4 p-8 rounded-2xl bg-[#1a2a1a]/80 backdrop-blur-xl border border-[#3d5a3d]/40">
          <div className="w-14 h-14 border-4 border-[#b4a064] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-300 font-mono tracking-wider">ESTABLISHING SECURE CONNECTION...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen flex flex-col relative"
      data-testid="hq-dashboard"
    >
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${TACTICAL_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Background Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#0d1a0d]/92 via-[#0d1a0d]/88 to-[#0d1a0d]/95" />
      
      {/* Expired Subscription Overlay */}
      <ExpiredOverlay subscription={subscription} onLogout={handleLogout} />
      
      {/* Subscription Warning Banner */}
      <SubscriptionBanner subscription={subscription} onUpgrade={() => setShowSubscriptionDialog(true)} />
      
      {/* Glassmorphism Header */}
      <div className="relative z-20 h-14 glass-header flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#b4a064] to-[#8a7a4a] flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">
                HQ Control <span className="text-[#b4a064]">- {hqName}</span>
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wider">POWERED BY BA-8993 MAJOR WAHID</p>
            </div>
          </div>
          
          {/* Connection Status */}
          <div 
            className={`flex items-center gap-2 px-3 py-1 rounded-full ${wsConnected ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-amber-500/20 border border-amber-500/40'}`}
            title={wsConnected ? 'Real-time connected' : 'Using HTTP polling'}
          >
            {wsConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <Signal className="w-3 h-3 text-amber-400" />}
            <span className={`text-[10px] font-bold tracking-wider ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {wsConnected ? 'LIVE' : 'POLL'}
            </span>
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="flex items-center gap-2">
          <SessionManager 
            hqId={hqId} 
            plan={subscription?.plan} 
            onSessionExpired={handleLogout}
          />
          <SubscriptionBadge subscription={subscription} onClick={() => setShowSubscriptionDialog(true)} />
          <StatItem label="Total" value={stats.total_patrols || 0} icon={Users} status="active" />
          <StatItem label="Approved" value={stats.approved_patrols || 0} icon={CheckCircle} status="active" />
          <StatItem label="Tracking" value={stats.active_patrols || 0} icon={Radio} status={stats.active_patrols > 0 ? 'tracking' : 'inactive'} />
          
          {/* Messaging Button */}
          <button
            onClick={() => { setMessagePatrolId(null); setShowMessaging(true); }}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#b4a064]/20 border border-[#b4a064]/40 hover:bg-[#b4a064]/30 transition-all"
            data-testid="messaging-btn"
          >
            <MessageSquare className="w-4 h-4 text-[#b4a064]" />
            <span className="text-xs text-[#b4a064] font-medium uppercase tracking-wider">Messages</span>
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#b4a064] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadMessageCount}
              </span>
            )}
          </button>

          {/* SOS Alerts Button */}
          <button
            onClick={() => setShowSOSPanel(!showSOSPanel)}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
              sosAlerts.length > 0 
                ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30 animate-pulse' 
                : 'bg-gray-500/10 border-[#3d5a3d]/40 hover:bg-gray-500/20'
            }`}
            data-testid="sos-panel-btn"
          >
            <AlertTriangle className={`w-4 h-4 ${sosAlerts.length > 0 ? 'text-red-400' : 'text-gray-500'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider ${sosAlerts.length > 0 ? 'text-red-400' : 'text-gray-500'}`}>
              SOS
            </span>
            {sosAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {sosAlerts.length}
              </span>
            )}
          </button>
          
          <StatItem label="Alerts" value={stats.notifications || 0} icon={Bell} status={stats.notifications > 0 ? 'warning' : 'inactive'} />
        </div>
      </div>

      {/* Main Content - Full screen map with floating right panel */}
      <div className="relative z-10 flex-1 overflow-hidden">
        {/* Map takes full space */}
        <MapDisplay
          ref={mapRef}
          patrols={patrols}
          visiblePatrols={visiblePatrols}
          mapType={mapType}
          setMapType={setMapType}
          showTrails={showTrails}
          setShowTrails={setShowTrails}
          showHeatMap={showHeatMap}
          setShowHeatMap={setShowHeatMap}
          trail={trail}
          allTrails={allTrails}
          selectedPatrolId={selectedPatrolId}
          onPatrolClick={handlePatrolClickFromMap}
          hqId={hqId}
          sosAlerts={sosAlerts}
        />

        {/* Floating Right Panel with Auto-hide */}
        <div 
          className={`absolute top-0 right-0 h-full z-[1000] transition-transform duration-300 ease-in-out ${sidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
          data-testid="hq-side-panel"
        >
          <div className="h-full w-80 glass-side-panel flex flex-col overflow-hidden shadow-2xl">
            <ControlPanel
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterCamp={filterCamp}
              setFilterCamp={setFilterCamp}
              filterUnit={filterUnit}
              setFilterUnit={setFilterUnit}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterOptions={filterOptions}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onClearFilters={handleClearFilters}
              onViewHistory={handleViewHistory}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 glass-tabs border-b border-[#3d5a3d]/40 rounded-none h-10">
                <TabsTrigger 
                  value="patrols" 
                  className="text-xs data-[state=active]:bg-[#b4a064]/20 data-[state=active]:text-[#b4a064] text-gray-400 uppercase tracking-wider" 
                  data-testid="tab-patrols"
                >
                  Patrols
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="text-xs relative data-[state=active]:bg-[#b4a064]/20 data-[state=active]:text-[#b4a064] text-gray-400 uppercase tracking-wider" 
                  data-testid="tab-notifications"
                >
                  Alerts
                  {stats.notifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {stats.notifications}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="new" 
                  className="text-xs data-[state=active]:bg-[#b4a064]/20 data-[state=active]:text-[#b4a064] text-gray-400 uppercase tracking-wider" 
                  data-testid="tab-new"
                >
                  + New
                </TabsTrigger>
              </TabsList>

              <TabsContent value="patrols" className="flex-1 overflow-hidden m-0">
                <PatrolList
                  patrols={patrols}
                  isSuperAdmin={isSuperAdmin}
                  selectedPatrolId={selectedPatrolId}
                  visiblePatrols={visiblePatrols}
                  onPatrolClick={handlePatrolClickFromList}
                  onToggleVisibility={handleToggleVisibility}
                  onShowAll={handleShowAll}
                  onHideAll={handleHideAll}
                  onShowActive={handleShowActive}
                  onGenerateCode={handleGenerateCode}
                  onEditPatrol={handleEditPatrol}
                  onDeletePatrol={handleDeleteClick}
                  onCallPatrol={handleCallPatrol}
                />
              </TabsContent>

              <TabsContent value="notifications" className="flex-1 overflow-hidden m-0">
                <NotificationsPanel 
                  notifications={notifications} 
                  onMarkRead={handleMarkNotificationRead}
                  onMarkAllRead={handleMarkAllNotificationsRead}
                />
              </TabsContent>

              <TabsContent value="new" className="flex-1 overflow-auto m-0">
                <NewPatrolForm 
                  newPatrol={newPatrol} 
                  setNewPatrol={setNewPatrol} 
                  onCreatePatrol={handleCreatePatrol}
                  canCreate={canCreatePatrol}
                  limitMessage={patrolLimitMessage}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Panel Toggle Button - Fixed position on right edge */}
        <Button
          size="sm"
          variant="outline"
          className={`absolute top-1/2 -translate-y-1/2 z-[1001] transition-all duration-300 bg-[#1a2a1a]/90 border-[#3d5a3d]/50 hover:bg-[#2a3a2a] hover:border-[#b4a064]/50 h-12 px-1 rounded-r-none ${sidePanelOpen ? 'right-80' : 'right-0'}`}
          onClick={() => setSidePanelOpen(!sidePanelOpen)}
          data-testid="toggle-panel"
        >
          {sidePanelOpen ? <PanelRightClose className="w-4 h-4 text-[#b4a064]" /> : <PanelRight className="w-4 h-4 text-[#b4a064]" />}
        </Button>
      </div>

      <CodeDialog open={showCodeDialog} onOpenChange={setShowCodeDialog} codeData={codeData} />
      <EditPatrolDialog open={showEditDialog} onOpenChange={setShowEditDialog} editPatrol={editPatrol} setEditPatrol={setEditPatrol} onUpdatePatrol={handleUpdatePatrol} />
      <DeleteConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} onConfirmDelete={handleDeleteConfirm} />
      <HistoryDialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog} historyData={historyData} selectedDate={selectedDate} />
      <SubscriptionDialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog} subscription={subscription} />
      
      {/* Jitsi Video Call Modal */}
      <JitsiMeetModal 
        open={showJitsiModal}
        onOpenChange={setShowJitsiModal}
        patrolId={callPatrol?.id}
        patrolName={callPatrol?.name}
        hqName={hqName}
        userName={`HQ Control - ${hqName}`}
      />

      {/* Secure Messaging Modal */}
      <SecureMessaging
        open={showMessaging}
        onOpenChange={setShowMessaging}
        patrols={patrols}
        hqId={hqId}
        hqName={hqName}
        initialPatrolId={messagePatrolId}
      />

      {/* SOS Alerts Panel (Side Panel) */}
      {showSOSPanel && (
        <div className="fixed right-0 top-0 bottom-0 w-80 z-40 bg-[#0d1a0d] border-l border-[#3d5a3d]/50 shadow-2xl">
          <div className="flex items-center justify-between p-3 border-b border-[#3d5a3d]/30">
            <span className="text-white font-medium text-sm">SOS Alerts</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowSOSPanel(false)}
              className="w-8 h-8"
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
          </div>
          <SOSAlertsPanel
            sosAlerts={sosAlerts}
            onResolveSOS={handleResolveSOS}
            onLocateSOS={handleLocateSOS}
            hqId={hqId}
            onNewAlert={fetchSOSAlerts}
          />
        </div>
      )}
      
      {/* WASIQ Logo Emblem */}
      <img 
        src={WASIQ_LOGO} 
        alt="WASIQ" 
        className="fixed bottom-4 right-4 w-12 h-12 object-contain opacity-40 z-30 rounded-lg"
        style={{ filter: 'grayscale(30%) contrast(1.2)' }}
      />
    </div>
  );
};
