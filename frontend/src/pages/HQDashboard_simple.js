import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Header } from '@/components/Header';
import { TacticalCard } from '@/components/TacticalCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Radio, Users, Activity, MapPin, Hash, Edit, Trash2, Search, Filter } from 'lucide-react';
import axios from 'axios';
import { initSocket } from '@/utils/socket';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color) => new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

const iconColors = {
  active: '#22c55e',
  inactive: '#71717a',
  sos: '#ef4444',
  assigned: '#eab308'
};

export const HQDashboard = () => {
  const [patrols, setPatrols] = useState([]);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [trail, setTrail] = useState([]);
  const [stats, setStats] = useState({});
  const [sosAlerts, setSosAlerts] = useState([]);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [newPatrol, setNewPatrol] = useState({ name: '', camp_name: '', unit: '', leader_email: '', assigned_area: '' });
  const [editPatrol, setEditPatrol] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePatrolId, setDeletePatrolId] = useState(null);
  const [mapType, setMapType] = useState('normal'); // normal, satellite, terrain
  const [hqId, setHqId] = useState('');
  const [hqName, setHqName] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCamp, setFilterCamp] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOptions, setFilterOptions] = useState({ camps: [], units: [] });
  const [allTrails, setAllTrails] = useState([]);
  const [showTrails, setShowTrails] = useState(true);
  
  const mapCenter = [21.4272, 92.0058]; // Cox's Bazar, Bangladesh
  
  const mapTiles = {
    normal: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
  };

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
    setHqName(storedHqName);
    setIsSuperAdmin(storedIsSuperAdmin);
    
    if (storedIsSuperAdmin) {
      toast.info('Super Admin Mode: Viewing All HQs', { duration: 3000 });
    }
  }, []);

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
      const response = await axios.get(`${API}/patrols/trails/all?hq_id=${hqId}&hours=2`);
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

  const fetchSOS = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/sos`);
      setSosAlerts(response.data);
    } catch (error) {
      console.error('Error fetching SOS alerts:', error);
    }
  }, []);

  const fetchTrail = useCallback(async (patrolId) => {
    try {
      const response = await axios.get(`${API}/patrols/${patrolId}/trail`);
      setTrail(response.data.points.map(p => [p.latitude, p.longitude]));
    } catch (error) {
      console.error('Error fetching trail:', error);
    }
  }, []);

  useEffect(() => {
    if (!hqId) return;
    
    fetchPatrols();
    fetchStats();
    fetchSOS();
    fetchFilterOptions();
    fetchAllTrails();

    // Polling for patrol updates every 5 seconds
    const pollingInterval = setInterval(() => {
      fetchPatrols();
      fetchAllTrails();
    }, 5000);

    // Stats update every 10 seconds
    const statsInterval = setInterval(() => {
      fetchStats();
    }, 10000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(statsInterval);
    };
  }, [hqId, fetchPatrols, fetchStats, fetchSOS, fetchFilterOptions, fetchAllTrails]);

  const handlePatrolClick = (patrol) => {
    setSelectedPatrol(patrol);
    if (patrol.is_tracking) {
      fetchTrail(patrol.id);
    }
  };

  const handleGenerateQR = async (patrol) => {
    try {
      const response = await axios.post(`${API}/codes/generate?patrol_id=${patrol.id}&email=${patrol.leader_email}`);
      setQrData(response.data);
      setShowQRDialog(true);
      toast.success(`Access Code generated for ${patrol.name}`);
    } catch (error) {
      toast.error('Failed to generate access code');
    }
  };

  const handleCreatePatrol = async () => {
    try {
      const payload = {
        ...newPatrol,
        soldier_ids: [],
        hq_id: hqId  // Associate patrol with current HQ
      };
      await axios.post(`${API}/patrols`, payload);
      toast.success('Patrol created successfully');
      setNewPatrol({ name: '', camp_name: '', unit: '', leader_email: '', assigned_area: '' });
      fetchPatrols();
      fetchStats();
    } catch (error) {
      toast.error('Failed to create patrol');
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
      toast.success('Patrol updated successfully');
      setShowEditDialog(false);
      setEditPatrol(null);
      fetchPatrols();
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
      toast.success('Patrol deleted successfully');
      setShowDeleteDialog(false);
      setDeletePatrolId(null);
      fetchPatrols();
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete patrol');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterCamp('');
    setFilterUnit('');
    setFilterStatus('');
  };

  const getTrailColor = (status) => {
    const colors = {
      active: '#22c55e',
      assigned: '#eab308',
      inactive: '#71717a',
      sos: '#ef4444'
    };
    return colors[status] || '#0ea5e9';
  };

  const handleResolveSOS = async (patrolId) => {
    try {
      await axios.patch(`${API}/sos/${patrolId}/resolve`);
      toast.success('SOS resolved');
      fetchSOS();
      fetchPatrols();
    } catch (error) {
      toast.error('Failed to resolve SOS');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-tactical-bg" data-testid="hq-dashboard">
