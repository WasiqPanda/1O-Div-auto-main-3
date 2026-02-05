import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Radio, Send, ChevronRight, Lock, User, MapPin, Mail, Phone, Eye, EyeOff, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Background images
const HERO_BG = 'https://customer-assets.emergentagent.com/job_2d9837ea-ce33-42ad-9eb8-91e7ec7df4fd/artifacts/7xgimln5_CC819907-6109-4723-98AA-2E4829F2CF13.PNG';
const WASIQ_LOGO = 'https://customer-assets.emergentagent.com/job_2d9837ea-ce33-42ad-9eb8-91e7ec7df4fd/artifacts/01u6pvnf_IMG_8593.jpg';

// Glassmorphism Panel
const GlassPanel = ({ children, className = '' }) => (
  <div className={`
    relative overflow-hidden rounded-2xl
    bg-gradient-to-br from-[#1a1a1a]/80 to-[#0d0d0d]/90
    backdrop-blur-xl border border-white/10
    shadow-[0_8px_32px_rgba(0,0,0,0.5)]
    ${className}
  `}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    <div className="relative z-10">{children}</div>
  </div>
);

// Input with icon
const IconInput = ({ icon: Icon, type = 'text', placeholder, value, onChange, className = '', ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
        <Icon className="w-4 h-4" />
      </div>
      <Input
        type={isPassword && showPassword ? 'text' : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`pl-10 pr-10 h-12 bg-[#0d0d0d]/60 border-white/10 focus:border-[#b4a064]/50 text-white placeholder:text-gray-500 ${className}`}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
};

export const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [requestHqName, setRequestHqName] = useState('');
  const [requestLocation, setRequestLocation] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleHQLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/hq/login`, { username, password });
      localStorage.setItem('hq_token', response.data.token);
      localStorage.setItem('hq_id', response.data.hq_id);
      localStorage.setItem('hq_name', response.data.hq_name);
      localStorage.setItem('hq_logo', response.data.hq_logo || '');
      localStorage.setItem('is_super_admin', response.data.is_super_admin || false);
      localStorage.setItem('subscription', JSON.stringify(response.data.subscription || {}));
      
      if (response.data.is_super_admin) {
        toast.success('Master Admin Access Granted');
        navigate('/admin');
      } else {
        const sub = response.data.subscription;
        if (sub && sub.status === 'expired') {
          toast.error('Subscription expired. Contact endora.dream@gmail.com');
          return;
        }
        if (sub && sub.status === 'pending') {
          toast.error('Account pending approval');
          return;
        }
        toast.success('Login successful');
        navigate('/hq');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/hq/request-access`, {
        hq_name: requestHqName,
        location: requestLocation,
        contact_email: requestEmail,
        contact_phone: requestPhone
      });
      toast.success('Access request submitted! You will be contacted after approval.');
      setMode('login');
      setRequestHqName('');
      setRequestLocation('');
      setRequestEmail('');
      setRequestPhone('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePatrolAccess = () => {
    navigate('/patrol');
  };

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center p-4"
      data-testid="login-page"
    >
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      
      {/* Animated particles/dust effect */}
      <div className="fixed inset-0 z-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-orange-400/40 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-orange-300/30 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-yellow-400/30 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#b4a064] to-[#8a7a4a] flex items-center justify-center shadow-lg shadow-[#b4a064]/20">
              <Shield className="w-7 h-7 text-black" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white mb-3 drop-shadow-lg">
            Military Patrol
          </h1>
          <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-[0.3em] text-[#b4a064] mb-4">
            Tracker
          </h2>
          <p className="text-sm text-gray-400 font-mono tracking-wider">
            REAL-TIME TACTICAL OPERATIONS MONITORING SYSTEM
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* HQ Login Card */}
          <GlassPanel className="p-6 md:p-8" data-testid="hq-login-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-[#b4a064]/10 border border-[#b4a064]/20">
                <Shield className="w-6 h-6 text-[#b4a064]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">HQ Control Center</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Command Access Portal</p>
              </div>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleHQLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Username</label>
                  <IconInput
                    icon={User}
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    data-testid="hq-username-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Password</label>
                  <IconInput
                    icon={Lock}
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="hq-password-input"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 mt-6 bg-gradient-to-r from-[#b4a064] to-[#8a7a4a] hover:from-[#c4b074] hover:to-[#9a8a5a] text-black font-bold text-lg tracking-wider uppercase transition-all duration-300 shadow-lg shadow-[#b4a064]/20"
                  data-testid="hq-login-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Access Dashboard
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <div className="text-center pt-4">
                  <button
                    type="button"
                    className="text-sm text-gray-400 hover:text-[#b4a064] transition-colors"
                    onClick={() => setMode('request')}
                  >
                    Need access? <span className="underline">Request HQ registration</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRequestAccess} className="space-y-3">
                <p className="text-sm text-gray-400 mb-4">
                  Submit a request for HQ access. You will be contacted after approval.
                </p>
                <IconInput
                  icon={Shield}
                  placeholder="HQ/Organization name *"
                  value={requestHqName}
                  onChange={(e) => setRequestHqName(e.target.value)}
                  required
                />
                <IconInput
                  icon={MapPin}
                  placeholder="Location (City/District) *"
                  value={requestLocation}
                  onChange={(e) => setRequestLocation(e.target.value)}
                  required
                />
                <IconInput
                  icon={Mail}
                  type="email"
                  placeholder="Contact email *"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  required
                />
                <IconInput
                  icon={Phone}
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={requestPhone}
                  onChange={(e) => setRequestPhone(e.target.value)}
                />
                
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-4 bg-gradient-to-r from-[#b4a064] to-[#8a7a4a] hover:from-[#c4b074] hover:to-[#9a8a5a] text-black font-bold tracking-wider uppercase"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                  onClick={() => setMode('login')}
                >
                  Back to Login
                </Button>
              </form>
            )}
          </GlassPanel>

          {/* Patrol Commander Card */}
          <GlassPanel className="p-6 md:p-8" data-testid="patrol-access-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Radio className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-wider">Patrol Commander</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Field Operations Access</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/20">
                <Radio className="w-12 h-12 text-emerald-400" />
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-gray-300">Access your patrol operations interface</p>
                <p className="text-sm text-gray-500 font-mono">Mobile-optimized tactical interface</p>
              </div>

              <Button
                onClick={handlePatrolAccess}
                className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-lg tracking-wider uppercase transition-all duration-300 shadow-lg shadow-emerald-500/20"
                data-testid="patrol-access-btn"
              >
                <Radio className="w-5 h-5 mr-2" />
                Launch Patrol App
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-xs text-gray-500 font-mono text-center">
                Enter via patrol link or access code from HQ
              </p>
            </div>
          </GlassPanel>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-gray-500 tracking-[0.2em] uppercase">
            Powered by BA-8993 Major Wahid
          </p>
          <p className="text-xs text-gray-600 font-mono">
            Contact: endora.dream@gmail.com
          </p>
        </div>
      </div>

      {/* WASIQ Logo */}
      <img 
        src={WASIQ_LOGO} 
        alt="WASIQ" 
        className="fixed bottom-4 right-4 w-14 h-14 object-contain opacity-50 z-20 rounded-lg"
        style={{ filter: 'grayscale(30%) contrast(1.2)' }}
      />
    </div>
  );
};
