import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, ExternalLink, MessageCircle, Phone, Shield, AlertTriangle, Mail } from 'lucide-react';
import { toast } from 'sonner';

export const CodeDialog = ({ open, onOpenChange, codeData }) => {
  const patrolLink = codeData ? `${window.location.origin}/patrol?id=${codeData.patrol_id}` : '';
  
  const copyLink = () => {
    navigator.clipboard.writeText(patrolLink);
    toast.success('Patrol link copied to clipboard!');
  };
  
  const copyCode = () => {
    navigator.clipboard.writeText(codeData?.code || '');
    toast.success('Access code copied!');
  };
  
  // Send link via Email - NO CODE in email
  const sendLinkViaEmail = () => {
    const email = codeData?.leader_email || '';
    const subject = encodeURIComponent('MISSION MAP - Patrol Duty Assignment');
    const body = encodeURIComponent(`Dear ${codeData?.patrol_name},

You have been assigned patrol duty.

Open this link on your mobile device:
${patrolLink}

⚠️ IMPORTANT: You will need the SECRET CODE to activate tracking.
The code will be provided to you VERBALLY by HQ Command via phone call.

Do NOT share this link with anyone else.

- HQ Command`);

    if (email) {
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
      toast.success('Email client opened. Remember to call patrol with the code!');
    } else {
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      toast.info('No email found - enter recipient in email client');
    }
  };
  
  // Send ONLY the link via WhatsApp - NO CODE in message
  const sendLinkViaWhatsApp = () => {
    // Get phone number if available
    let phone = codeData?.phone_number || '';
    phone = phone.replace(/[\s\-\(\)]/g, '');
    if (phone && !phone.startsWith('+') && !phone.startsWith('880')) {
      phone = '880' + phone.replace(/^0/, '');
    }
    phone = phone.replace('+', '');
    
    // Message WITHOUT the secret code
    const message = `🎖️ MISSION MAP - PATROL TRACKING

Dear ${codeData?.patrol_name},

You have been assigned patrol duty.
Open this link on your mobile:

👉 ${patrolLink}

⚠️ IMPORTANT: You will need the SECRET CODE to activate tracking.
The code will be provided to you VERBALLY by HQ Command.

- HQ Command`;

    const encodedMessage = encodeURIComponent(message);
    
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      toast.success('Link sent! Now call patrol to provide the code verbally.');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      toast.info('No phone number - select contact in WhatsApp');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-tactical-panel border-tactical-border z-[9999] max-w-md" data-testid="code-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Secure Patrol Access
          </DialogTitle>
        </DialogHeader>
        {codeData && (
          <div className="space-y-4 py-4">
            <div className="space-y-2 text-center">
              <div className="text-sm text-gray-400">Patrol: <span className="text-white font-medium">{codeData.patrol_name}</span></div>
              <div className="text-sm text-gray-400">ID: <span className="text-primary font-mono">{codeData.patrol_id}</span></div>
            </div>
            
            {/* Security Notice */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-200">
                  <p className="font-bold mb-1">SECURE VERIFICATION REQUIRED</p>
                  <p>Send the link via WhatsApp, then <strong>CALL the patrol user</strong> and tell them the secret code verbally. This ensures only the intended person can activate tracking.</p>
                </div>
              </div>
            </div>
            
            {/* Step 1: Send Link */}
            <div className="bg-tactical-surface p-4 rounded border border-emerald-500/30">
              <div className="text-xs text-emerald-400 mb-2 uppercase font-bold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-bold">1</span>
                Send Link via WhatsApp
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Input 
                  value={patrolLink}
                  readOnly
                  className="bg-tactical-bg border-tactical-border text-xs font-mono"
                />
                <Button size="sm" variant="outline" onClick={copyLink} className="border-emerald-500/50 hover:bg-emerald-500/20">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={sendLinkViaWhatsApp}
                data-testid="send-link-whatsapp-btn"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Link via WhatsApp
              </Button>
              
              {/* Email Option */}
              <Button 
                variant="outline"
                className="w-full mt-2 border-blue-500/50 hover:bg-blue-500/20 text-blue-400"
                onClick={sendLinkViaEmail}
                data-testid="send-link-email-btn"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Link via Email
              </Button>
            </div>
            
            {/* Step 2: Call and Tell Code */}
            <div className="bg-tactical-surface p-4 rounded border border-primary/30">
              <div className="text-xs text-primary mb-2 uppercase font-bold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-black flex items-center justify-center text-[10px] font-bold">2</span>
                Call & Tell Secret Code
              </div>
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="text-4xl font-bold tracking-widest text-primary font-mono" data-testid="secret-code">
                  {codeData.code}
                </div>
                <Button size="sm" variant="ghost" onClick={copyCode}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-[10px] text-gray-500 text-center mb-3">
                Expires: {new Date(codeData.expires_at).toLocaleString()}
              </div>
              
              {codeData.phone_number && (
                <Button 
                  variant="outline"
                  className="w-full border-primary/50 hover:bg-primary/20"
                  onClick={() => window.open(`tel:${codeData.phone_number}`, '_self')}
                  data-testid="call-patrol-btn"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call {codeData.phone_number}
                </Button>
              )}
            </div>
            
            {/* Test Link */}
            <div className="pt-2 border-t border-tactical-border">
              <Button 
                variant="ghost"
                className="w-full text-xs text-gray-500"
                onClick={() => window.open(patrolLink, '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                Test Link (opens in new tab)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const EditPatrolDialog = ({ open, onOpenChange, editPatrol, setEditPatrol, onUpdatePatrol }) => {
  if (!editPatrol) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-tactical-panel border-tactical-border z-[9999]" data-testid="edit-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase">Edit Patrol</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-heading uppercase text-gray-400 block mb-1">Patrol Name</label>
            <Input 
              value={editPatrol.name}
              onChange={(e) => setEditPatrol({...editPatrol, name: e.target.value})}
              className="bg-tactical-surface border-tactical-border"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase text-gray-400 block mb-1">Camp Name</label>
            <Input 
              value={editPatrol.camp_name}
              onChange={(e) => setEditPatrol({...editPatrol, camp_name: e.target.value})}
              className="bg-tactical-surface border-tactical-border"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase text-gray-400 block mb-1">Unit</label>
            <Input 
              value={editPatrol.unit}
              onChange={(e) => setEditPatrol({...editPatrol, unit: e.target.value})}
              className="bg-tactical-surface border-tactical-border"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase text-gray-400 block mb-1">Phone Number</label>
            <Input 
              value={editPatrol.phone_number || ''}
              onChange={(e) => setEditPatrol({...editPatrol, phone_number: e.target.value})}
              className="bg-tactical-surface border-tactical-border"
              placeholder="+8801XXXXXXXXX"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase text-gray-400 block mb-1">Leader Email</label>
            <Input 
              value={editPatrol.leader_email}
              onChange={(e) => setEditPatrol({...editPatrol, leader_email: e.target.value})}
              className="bg-tactical-surface border-tactical-border"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase text-gray-400 block mb-1">Assigned Area</label>
            <Input 
              value={editPatrol.assigned_area}
              onChange={(e) => setEditPatrol({...editPatrol, assigned_area: e.target.value})}
              className="bg-tactical-surface border-tactical-border"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              className="flex-1 font-heading"
              onClick={onUpdatePatrol}
              data-testid="update-patrol-btn"
            >
              Update Patrol
            </Button>
            <Button 
              variant="outline"
              className="flex-1 font-heading"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteConfirmDialog = ({ open, onOpenChange, onConfirmDelete }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-tactical-panel border-tactical-border z-[9999]" data-testid="delete-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase text-destructive">Delete Patrol</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-300">Are you sure you want to delete this patrol? This action cannot be undone.</p>
          <p className="text-sm text-gray-400">All related data (locations, trails, access codes) will be permanently removed.</p>
          <div className="flex gap-2">
            <Button 
              variant="destructive"
              className="flex-1 font-heading"
              onClick={onConfirmDelete}
              data-testid="confirm-delete-btn"
            >
              Delete Permanently
            </Button>
            <Button 
              variant="outline"
              className="flex-1 font-heading"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
