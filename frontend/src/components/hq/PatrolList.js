import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPin, Hash, Edit, Trash2, Eye, EyeOff, Video, Send, Phone, Clock, Play, Square, Radio } from 'lucide-react';
import { toast } from 'sonner';

// Format time for display
const formatTime = (isoString) => {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
};

// Format relative time (e.g., "2m ago")
const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
};

export const PatrolList = ({
  patrols,
  isSuperAdmin,
  selectedPatrolId,
  visiblePatrols,
  onPatrolClick,
  onToggleVisibility,
  onShowAll,
  onHideAll,
  onShowActive,
  onGenerateCode,
  onEditPatrol,
  onDeletePatrol,
  onCallPatrol
}) => {
  const listRef = useRef(null);
  const itemRefs = useRef({});

  useEffect(() => {
    if (selectedPatrolId && itemRefs.current[selectedPatrolId]) {
      itemRefs.current[selectedPatrolId].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedPatrolId]);

  const visibleCount = Object.values(visiblePatrols).filter(v => v !== false).length;
  const totalCount = patrols.length;
  const activeCount = patrols.filter(p => p.latitude !== 0 || p.longitude !== 0 || p.is_tracking).length;

  // Get clean phone number
  const getCleanPhone = (patrol) => {
    let phone = patrol.phone_number || patrol.mobile || patrol.phone || '';
    phone = phone.replace(/[\s\-\(\)]/g, '');
    if (phone && !phone.startsWith('+') && !phone.startsWith('880')) {
      phone = '880' + phone.replace(/^0/, '');
    }
    return phone.replace('+', '');
  };
  
  // Send link via WhatsApp (WITHOUT code - code must be told verbally)
  const sendLinkViaWhatsApp = (patrol, e) => {
    e.stopPropagation();
    const patrolLink = `${window.location.origin}/patrol?id=${patrol.id}`;
    const phone = getCleanPhone(patrol);
    
    // Message WITHOUT the secret code - code must be told verbally
    const message = `🎖️ MISSION MAP - PATROL TRACKING

Dear ${patrol.name},

You have been assigned patrol duty.
Open this link on your mobile:

👉 ${patrolLink}

⚠️ IMPORTANT: You will need the SECRET CODE to activate tracking.
The code will be provided to you VERBALLY by HQ Command.

- HQ Command`;

    const encodedMessage = encodeURIComponent(message);
    
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      toast.success('Link sent! Now call patrol to tell them the code.');
    } else {
      navigator.clipboard.writeText(patrolLink);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      toast.warning('No phone number - link copied. Select contact in WhatsApp.');
    }
  };

  // Quick call patrol
  const callPatrol = (patrol, e) => {
    e.stopPropagation();
    const phone = patrol.phone_number || patrol.mobile || patrol.phone;
    if (phone) {
      window.open(`tel:${phone}`, '_self');
    } else {
      toast.error('No phone number available for this patrol');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Compact Visibility Controls */}
      <div className="px-2 py-1.5 border-b border-tactical-border bg-tactical-bg/50 flex items-center justify-between">
        <span className="text-xs text-gray-500">{visibleCount}/{totalCount} shown</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/20" onClick={onShowActive} data-testid="show-active-btn" title={`Show ${activeCount} patrols with location`}>
            <MapPin className="w-3 h-3 mr-1" />Active
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onShowAll} data-testid="show-all-btn">
            <Eye className="w-3 h-3 mr-1" />All
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onHideAll} data-testid="hide-all-btn">
            <EyeOff className="w-3 h-3 mr-1" />None
          </Button>
        </div>
      </div>

      {/* Patrol List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {patrols.map((patrol) => {
          const isSelected = selectedPatrolId === patrol.id;
          const isVisible = visiblePatrols[patrol.id] !== false;
          const isFinished = patrol.status === 'finished' || (!patrol.is_tracking && patrol.session_ended);
          const hasPhone = !!(patrol.phone_number || patrol.mobile || patrol.phone);
          
          return (
            <div 
              key={patrol.id}
              ref={el => itemRefs.current[patrol.id] = el}
              className={`px-2 py-2 border-b border-tactical-border/50 cursor-pointer transition-all ${
                isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-tactical-surface/50'
              } ${isFinished ? 'opacity-60' : ''}`}
              onClick={() => onPatrolClick(patrol)}
              data-testid={`patrol-card-${patrol.id}`}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={isVisible}
                  onCheckedChange={() => onToggleVisibility(patrol.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5"
                  data-testid={`visibility-toggle-${patrol.id}`}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium truncate ${isFinished ? 'text-gray-500' : 'text-primary'}`}>
                      {patrol.name}
                    </span>
                    <StatusBadge status={isFinished ? 'finished' : patrol.status} className="text-xs scale-90" />
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span className="truncate">{patrol.camp_name}</span>
                    <span>•</span>
                    <span className="truncate">{patrol.unit}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{patrol.assigned_area || 'No area'}</span>
                    {patrol.phone_number && (
                      <span className="ml-2 text-[#b4a064]">📱 {patrol.phone_number}</span>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {/* PRIMARY: Send Link Button */}
                    <Button 
                      size="sm" 
                      className={`h-7 px-3 text-xs font-bold ${hasPhone 
                        ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white' 
                        : 'bg-green-600/50 text-green-200'
                      }`}
                      onClick={(e) => sendLinkViaWhatsApp(patrol, e)}
                      data-testid={`send-link-btn-${patrol.id}`}
                      title="Send link via WhatsApp (code must be told verbally)"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Send Link
                    </Button>
                    
                    {/* Call Button - to tell code */}
                    {hasPhone && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                        onClick={(e) => callPatrol(patrol, e)}
                        data-testid={`call-phone-btn-${patrol.id}`}
                        title="Call to tell secret code"
                      >
                        <Phone className="w-3 h-3" />
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                      onClick={(e) => { e.stopPropagation(); onCallPatrol && onCallPatrol(patrol); }}
                      data-testid={`call-btn-${patrol.id}`}
                      title={`Video call ${patrol.name}`}
                    >
                      <Video className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs text-primary"
                      onClick={(e) => { e.stopPropagation(); onGenerateCode(patrol); }}
                      data-testid={`generate-code-btn-${patrol.id}`}
                      title="Generate access code"
                    >
                      <Hash className="w-3 h-3 mr-1" />Code
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); onEditPatrol(patrol); }}
                      data-testid={`edit-btn-${patrol.id}`}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDeletePatrol(patrol.id); }}
                      data-testid={`delete-btn-${patrol.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {patrols.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-8 px-4">
            No patrols found.<br/>Click "+ New" to create one.
          </div>
        )}
      </div>
    </div>
  );
};
