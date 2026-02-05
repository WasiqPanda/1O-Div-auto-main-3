import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserPlus, AlertTriangle, Phone } from 'lucide-react';

export const NewPatrolForm = ({ newPatrol, setNewPatrol, onCreatePatrol, canCreate = true, limitMessage = null }) => {
  return (
    <div className="p-3 space-y-3">
      {/* Patrol Limit Warning */}
      {!canCreate && limitMessage && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-yellow-400">
            <p className="font-medium">Patrol Limit Reached</p>
            <p className="mt-1">{limitMessage}. Upgrade your plan to add more patrols.</p>
          </div>
        </div>
      )}
      
      <div className="space-y-1">
        <Label className="text-xs text-gray-400">Patrol Name *</Label>
        <Input 
          placeholder="e.g., Alpha Team - Lt. Rahman" 
          value={newPatrol.name}
          onChange={(e) => setNewPatrol({...newPatrol, name: e.target.value})}
          className="bg-tactical-surface border-tactical-border h-9 text-sm"
          data-testid="input-patrol-name"
          disabled={!canCreate}
        />
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs text-gray-400">Camp Name</Label>
        <Input 
          placeholder="e.g., Cox's Bazar Base"
          value={newPatrol.camp_name}
          onChange={(e) => setNewPatrol({...newPatrol, camp_name: e.target.value})}
          className="bg-tactical-surface border-tactical-border h-9 text-sm"
          data-testid="input-camp-name"
          disabled={!canCreate}
        />
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs text-gray-400">Unit</Label>
        <Input 
          placeholder="e.g., 10 Infantry Division"
          value={newPatrol.unit}
          onChange={(e) => setNewPatrol({...newPatrol, unit: e.target.value})}
          className="bg-tactical-surface border-tactical-border h-9 text-sm"
          data-testid="input-unit"
          disabled={!canCreate}
        />
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs text-gray-400">
          <Phone className="w-3 h-3 inline mr-1" />
          Mobile Number *
        </Label>
        <Input 
          type="tel"
          placeholder="e.g., +8801XXXXXXXXX"
          value={newPatrol.phone_number || ''}
          onChange={(e) => setNewPatrol({...newPatrol, phone_number: e.target.value})}
          className="bg-tactical-surface border-tactical-border h-9 text-sm"
          data-testid="input-phone-number"
          disabled={!canCreate}
        />
        <p className="text-[10px] text-gray-500">For direct Go Live link via WhatsApp</p>
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs text-gray-400">Leader Email</Label>
        <Input 
          type="email"
          placeholder="leader@army.mil"
          value={newPatrol.leader_email}
          onChange={(e) => setNewPatrol({...newPatrol, leader_email: e.target.value})}
          className="bg-tactical-surface border-tactical-border h-9 text-sm"
          data-testid="input-leader-email"
          disabled={!canCreate}
        />
      </div>
      
      <div className="space-y-1">
        <Label className="text-xs text-gray-400">Assigned Area</Label>
        <Input 
          placeholder="e.g., Beach Sector A" 
          value={newPatrol.assigned_area}
          onChange={(e) => setNewPatrol({...newPatrol, assigned_area: e.target.value})}
          className="bg-tactical-surface border-tactical-border h-9 text-sm"
          data-testid="input-assigned-area"
          disabled={!canCreate}
        />
      </div>
      
      <Button 
        className="w-full h-9 font-heading text-sm"
        onClick={onCreatePatrol}
        data-testid="create-patrol-btn"
        disabled={!canCreate}
      >
        <UserPlus className="w-4 h-4 mr-2" />
        {canCreate ? 'Create Patrol' : 'Limit Reached'}
      </Button>
    </div>
  );
};
