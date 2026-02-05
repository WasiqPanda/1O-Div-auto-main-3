import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, Users, Clock, Check, X, Edit, Trash2, 
  Building, Mail, Phone, MapPin, Upload, AlertTriangle,
  Calendar, DollarSign, Eye
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SUBSCRIPTION_PLANS = {
  trial: { name: 'Trial', duration: 48, unit: 'hours', maxPatrols: 3, maxTracking: 3, sessionDuration: 30, trailHistory: 6, price: 0 },
  normal: { name: 'Normal', duration: 30, unit: 'days', maxPatrols: 50, maxTracking: 25, sessionDuration: 720, trailHistory: 24, price: 25 },
  pro: { name: 'Pro', duration: 30, unit: 'days', maxPatrols: 999, maxTracking: 150, sessionDuration: 1440, trailHistory: 168, price: 50 }
};

const formatTimeRemaining = (expiresAt) => {
  if (!expiresAt) return 'N/A';
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry - now;
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const StatusBadge = ({ status }) => {
  const colors = {
    active: 'bg-green-500/20 text-green-400 border-green-500',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
    expired: 'bg-red-500/20 text-red-400 border-red-500',
    trial: 'bg-blue-500/20 text-blue-400 border-blue-500'
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-mono rounded border ${colors[status] || colors.pending}`}>
      {status?.toUpperCase()}
    </span>
  );
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [hqList, setHqList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Dialogs
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [selectedHq, setSelectedHq] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Form data
  const [approveForm, setApproveForm] = useState({
    username: '',
    password: '',
    hq_name: '',
    plan: 'trial'
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: 'trial',
    customDays: 30
  });
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    const isSuperAdmin = localStorage.getItem('is_super_admin') === 'true';
    if (!isSuperAdmin) {
      toast.error('Access denied');
      navigate('/');
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = useCallback(async () => {
    try {
      const [hqRes, requestsRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/hq-list`),
        axios.get(`${API}/admin/pending-requests`),
        axios.get(`${API}/admin/stats`)
      ]);
      setHqList(hqRes.data);
      setPendingRequests(requestsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApproveRequest = async () => {
    try {
      const formData = new FormData();
      formData.append('request_id', selectedRequest.id);
      formData.append('username', approveForm.username);
      formData.append('password', approveForm.password);
      formData.append('hq_name', approveForm.hq_name || selectedRequest.hq_name);
      formData.append('plan', approveForm.plan);
      if (logoFile) {
        formData.append('logo', logoFile);
      }
      
      await axios.post(`${API}/admin/approve-hq`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('HQ approved successfully');
      setShowApproveDialog(false);
      setSelectedRequest(null);
      setApproveForm({ username: '', password: '', hq_name: '', plan: 'trial' });
      setLogoFile(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Approval failed');
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!window.confirm('Reject this request?')) return;
    try {
      await axios.post(`${API}/admin/reject-request`, { request_id: requestId });
      toast.success('Request rejected');
      fetchData();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const handleUpdateSubscription = async () => {
    try {
      await axios.post(`${API}/admin/update-subscription`, {
        hq_id: selectedHq.hq_id,
        plan: subscriptionForm.plan,
        custom_days: subscriptionForm.plan === 'custom' ? subscriptionForm.customDays : null
      });
      toast.success('Subscription updated');
      setShowSubscriptionDialog(false);
      setSelectedHq(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  const handleDeleteHq = async (hqId) => {
    if (!window.confirm('Delete this HQ and all its data?')) return;
    try {
      await axios.delete(`${API}/admin/hq/${hqId}`);
      toast.success('HQ deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete HQ');
    }
  };

  const openApproveDialog = (request) => {
    setSelectedRequest(request);
    setApproveForm({
      username: '',
      password: '',
      hq_name: request.hq_name,
      plan: 'trial'
    });
    setShowApproveDialog(true);
  };

  const openSubscriptionDialog = (hq) => {
    setSelectedHq(hq);
    setSubscriptionForm({
      plan: hq.subscription?.plan || 'trial',
      customDays: 30
    });
    setShowSubscriptionDialog(true);
  };

  const goToHqDashboard = () => {
    navigate('/hq');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-tactical-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tactical-bg" data-testid="admin-dashboard">
      {/* Header */}
      <div className="bg-tactical-panel border-b border-tactical-border py-3 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold text-white uppercase tracking-wider">
              Master Admin Dashboard
            </h1>
            <p className="text-xs text-gray-400 font-mono">Powered by BA-8993 Major Wahid</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={goToHqDashboard}>
              <Eye className="w-4 h-4 mr-2" />
              View HQ Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { localStorage.clear(); navigate('/'); }}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 p-6">
        <Card className="bg-tactical-surface border-tactical-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Building className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_hqs || 0}</p>
                <p className="text-xs text-gray-400">Total HQs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-tactical-surface border-tactical-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.pending_requests || 0}</p>
                <p className="text-xs text-gray-400">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-tactical-surface border-tactical-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.active_hqs || 0}</p>
                <p className="text-xs text-gray-400">Active HQs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-tactical-surface border-tactical-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.expired_hqs || 0}</p>
                <p className="text-xs text-gray-400">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-tactical-surface border-tactical-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-white">${stats.monthly_revenue || 0}</p>
                <p className="text-xs text-gray-400">Monthly Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-6">
        <Tabs defaultValue="hqs" className="w-full">
          <TabsList className="bg-tactical-surface border border-tactical-border">
            <TabsTrigger value="hqs">Authorized HQs ({hqList.length})</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending Requests
              {pendingRequests.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-yellow-500 text-black text-xs rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Authorized HQs */}
          <TabsContent value="hqs">
            <Card className="bg-tactical-panel border-tactical-border">
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <table className="w-full">
                    <thead className="bg-tactical-surface sticky top-0">
                      <tr className="text-xs text-gray-400 uppercase">
                        <th className="text-left p-3">HQ Name</th>
                        <th className="text-left p-3">Username</th>
                        <th className="text-left p-3">Plan</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Expires</th>
                        <th className="text-left p-3">Patrols</th>
                        <th className="text-right p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hqList.map((hq) => (
                        <tr key={hq.hq_id} className="border-t border-tactical-border hover:bg-tactical-surface/50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {hq.logo && <img src={hq.logo} alt="" className="w-8 h-8 rounded object-cover" />}
                              <div>
                                <p className="text-white font-medium">{hq.hq_name}</p>
                                <p className="text-xs text-gray-500">{hq.location}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-gray-300 font-mono text-sm">{hq.username}</td>
                          <td className="p-3">
                            <span className="text-sm text-primary font-medium">
                              {hq.subscription?.plan?.toUpperCase() || 'N/A'}
                            </span>
                          </td>
                          <td className="p-3">
                            <StatusBadge status={hq.subscription?.status || 'pending'} />
                          </td>
                          <td className="p-3 text-sm text-gray-300">
                            {formatTimeRemaining(hq.subscription?.expires_at)}
                          </td>
                          <td className="p-3 text-sm text-gray-300">{hq.patrol_count || 0}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openSubscriptionDialog(hq)}>
                                <Calendar className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteHq(hq.hq_id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {hqList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-500">
                            No authorized HQs yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Requests */}
          <TabsContent value="pending">
            <Card className="bg-tactical-panel border-tactical-border">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="bg-tactical-surface border-yellow-500/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <h3 className="text-lg font-heading text-white">{request.hq_name}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> {request.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-4 h-4" /> {request.contact_email}
                              </span>
                              {request.contact_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" /> {request.contact_phone}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Requested: {new Date(request.requested_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openApproveDialog(request)}>
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleRejectRequest(request.id)}>
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pendingRequests.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No pending requests
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-tactical-panel border-tactical-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Approve HQ Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-400">HQ Name</Label>
              <Input
                value={approveForm.hq_name}
                onChange={(e) => setApproveForm({ ...approveForm, hq_name: e.target.value })}
                className="bg-tactical-surface border-tactical-border"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Username *</Label>
              <Input
                value={approveForm.username}
                onChange={(e) => setApproveForm({ ...approveForm, username: e.target.value })}
                className="bg-tactical-surface border-tactical-border"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Password *</Label>
              <Input
                type="password"
                value={approveForm.password}
                onChange={(e) => setApproveForm({ ...approveForm, password: e.target.value })}
                className="bg-tactical-surface border-tactical-border"
                required
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Subscription Plan</Label>
              <Select value={approveForm.plan} onValueChange={(v) => setApproveForm({ ...approveForm, plan: v })}>
                <SelectTrigger className="bg-tactical-surface border-tactical-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-tactical-panel border-tactical-border">
                  <SelectItem value="trial">Trial (48 hours)</SelectItem>
                  <SelectItem value="normal">Normal ($25/month)</SelectItem>
                  <SelectItem value="pro">Pro ($50/month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-400">Custom Logo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files[0])}
                className="bg-tactical-surface border-tactical-border"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleApproveRequest}>
                <Check className="w-4 h-4 mr-2" /> Approve & Create Account
              </Button>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Dialog */}
      <Dialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
        <DialogContent className="bg-tactical-panel border-tactical-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Update Subscription</DialogTitle>
          </DialogHeader>
          {selectedHq && (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                HQ: <span className="text-white font-medium">{selectedHq.hq_name}</span>
              </div>
              <div>
                <Label className="text-xs text-gray-400">Plan</Label>
                <Select value={subscriptionForm.plan} onValueChange={(v) => setSubscriptionForm({ ...subscriptionForm, plan: v })}>
                  <SelectTrigger className="bg-tactical-surface border-tactical-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-tactical-panel border-tactical-border">
                    <SelectItem value="trial">Trial (48 hours) - Free</SelectItem>
                    <SelectItem value="normal">Normal (30 days) - $25</SelectItem>
                    <SelectItem value="pro">Pro (30 days) - $50</SelectItem>
                    <SelectItem value="custom">Custom Duration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {subscriptionForm.plan === 'custom' && (
                <div>
                  <Label className="text-xs text-gray-400">Days</Label>
                  <Input
                    type="number"
                    value={subscriptionForm.customDays}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, customDays: parseInt(e.target.value) })}
                    className="bg-tactical-surface border-tactical-border"
                    min={1}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleUpdateSubscription}>
                  Update Subscription
                </Button>
                <Button variant="outline" onClick={() => setShowSubscriptionDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
