import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  MessageSquare, Send, Users, Radio, Clock, Check, CheckCheck,
  ChevronRight, Search, ArrowLeft, Loader2
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Message bubble component
const MessageBubble = ({ message, isOwn }) => {
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div 
        className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
          isOwn 
            ? 'bg-[#b4a064] text-black rounded-br-sm' 
            : 'bg-[#2a3a2a] text-white rounded-bl-sm border border-[#3d5a3d]/30'
        }`}
      >
        {!isOwn && (
          <div className="text-xs text-[#b4a064] font-medium mb-1">
            {message.sender_name}
          </div>
        )}
        <p className="text-sm leading-relaxed">{message.content}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-black/60' : 'text-gray-500'}`}>
          <span className="text-[10px]">{timestamp}</span>
          {isOwn && (
            message.read 
              ? <CheckCheck className="w-3 h-3" /> 
              : <Check className="w-3 h-3" />
          )}
        </div>
      </div>
    </div>
  );
};

// Patrol conversation item
const PatrolConvoItem = ({ patrol, unreadCount, lastMessage, onClick }) => (
  <button
    onClick={onClick}
    className="w-full p-3 flex items-center gap-3 hover:bg-[#2a3a2a]/50 transition-colors rounded-lg border border-transparent hover:border-[#3d5a3d]/30"
    data-testid={`convo-${patrol.id}`}
  >
    <div className="relative">
      <div className="w-10 h-10 rounded-full bg-[#2a3a2a] flex items-center justify-center border border-[#3d5a3d]/30">
        <span className="text-sm font-bold text-[#b4a064]">{patrol.name?.charAt(0) || 'P'}</span>
      </div>
      {patrol.is_tracking && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d1a0d]" />
      )}
    </div>
    <div className="flex-1 min-w-0 text-left">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm font-medium truncate">{patrol.name}</span>
        {lastMessage && (
          <span className="text-[10px] text-gray-500">
            {new Date(lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 truncate">
        {lastMessage?.content || patrol.assigned_area || 'No messages yet'}
      </p>
    </div>
    {unreadCount > 0 && (
      <div className="w-5 h-5 rounded-full bg-[#b4a064] flex items-center justify-center">
        <span className="text-[10px] font-bold text-black">{unreadCount}</span>
      </div>
    )}
    <ChevronRight className="w-4 h-4 text-gray-500" />
  </button>
);

export const SecureMessaging = ({ 
  open, 
  onOpenChange, 
  patrols = [], 
  hqId, 
  hqName,
  initialPatrolId = null
}) => {
  const [activeTab, setActiveTab] = useState('conversations');
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages for selected patrol
  const loadMessages = async (patrolId) => {
    if (!patrolId) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/messages/conversation/${patrolId}?hq_id=${hqId}`);
      setMessages(response.data);
      
      // Mark messages as read
      await axios.patch(`${API}/messages/mark-all-read?hq_id=${hqId}&patrol_id=${patrolId}`);
      
      // Update unread counts
      setUnreadCounts(prev => ({ ...prev, [patrolId]: 0 }));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load unread counts
  const loadUnreadCounts = async () => {
    try {
      const response = await axios.get(`${API}/messages/unread-count?hq_id=${hqId}`);
      // This gives total, but we'd need per-patrol counts
      // For now, fetch all messages and compute
      const allMessages = await axios.get(`${API}/messages?hq_id=${hqId}&unread_only=true`);
      const counts = {};
      allMessages.data.forEach(msg => {
        if (msg.sender_type === 'patrol') {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Error loading unread counts:', error);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !selectedPatrol) return;

    setIsSending(true);
    try {
      await axios.post(`${API}/messages`, {
        content: newMessage.trim(),
        sender_id: hqId,
        sender_type: 'hq',
        recipient_patrol_id: selectedPatrol.id,
        hq_id: hqId,
        message_type: 'direct'
      });

      // Add to local messages
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: newMessage.trim(),
        sender_id: hqId,
        sender_name: hqName || 'HQ Command',
        sender_type: 'hq',
        timestamp: new Date().toISOString(),
        read: false
      }]);

      setNewMessage('');
      toast.success('Message sent');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Send broadcast
  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;

    setIsSending(true);
    try {
      await axios.post(`${API}/messages`, {
        content: broadcastMessage.trim(),
        sender_id: hqId,
        sender_type: 'hq',
        hq_id: hqId,
        message_type: 'broadcast'
      });

      setBroadcastMessage('');
      toast.success('Broadcast sent to all patrols');
    } catch (error) {
      toast.error('Failed to send broadcast');
    } finally {
      setIsSending(false);
    }
  };

  // Select patrol
  const handleSelectPatrol = (patrol) => {
    setSelectedPatrol(patrol);
    setActiveTab('conversation');
    loadMessages(patrol.id);
  };

  // Back to list
  const handleBack = () => {
    setSelectedPatrol(null);
    setActiveTab('conversations');
    setMessages([]);
  };

  // Load unread counts when dialog opens
  useEffect(() => {
    if (open) {
      loadUnreadCounts();
      
      // Handle initial patrol selection
      if (initialPatrolId) {
        const patrol = patrols.find(p => p.id === initialPatrolId);
        if (patrol) {
          handleSelectPatrol(patrol);
        }
      }
    }
  }, [open, hqId, initialPatrolId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filter patrols by search
  const filteredPatrols = patrols.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.assigned_area?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get total unread
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0d1a0d] border-[#3d5a3d]/50 max-w-lg h-[80vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[#3d5a3d]/30">
          {selectedPatrol ? (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 rounded-full bg-[#2a3a2a] flex items-center justify-center border border-[#3d5a3d]/30">
                <span className="text-sm font-bold text-[#b4a064]">{selectedPatrol.name?.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{selectedPatrol.name}</h3>
                <p className="text-xs text-gray-400">{selectedPatrol.assigned_area}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-[#b4a064]/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#b4a064]" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Secure Messaging</h3>
                <p className="text-xs text-gray-400">
                  {totalUnread > 0 ? `${totalUnread} unread messages` : 'Encrypted communications'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        {selectedPatrol ? (
          // Conversation View
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-[#b4a064]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No messages yet. Start the conversation.
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    isOwn={msg.sender_type === 'hq'} 
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-[#3d5a3d]/30">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-[#1a2a1a] border-[#3d5a3d]/30 text-white placeholder:text-gray-500"
                  disabled={isSending}
                  data-testid="message-input"
                />
                <Button 
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="bg-[#b4a064] hover:bg-[#a08954] text-black"
                  data-testid="send-message-btn"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          // Conversations List / Broadcast
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2 bg-[#1a2a1a] border border-[#3d5a3d]/30">
              <TabsTrigger value="conversations" className="flex-1 data-[state=active]:bg-[#b4a064] data-[state=active]:text-black">
                <Users className="w-4 h-4 mr-2" />
                Patrols
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="flex-1 data-[state=active]:bg-[#b4a064] data-[state=active]:text-black">
                <Radio className="w-4 h-4 mr-2" />
                Broadcast
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversations" className="flex-1 overflow-hidden flex flex-col m-0 p-4">
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patrols..."
                  className="pl-10 bg-[#1a2a1a] border-[#3d5a3d]/30 text-white placeholder:text-gray-500"
                />
              </div>

              {/* Patrol List */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredPatrols.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No patrols found</div>
                ) : (
                  filteredPatrols.map(patrol => (
                    <PatrolConvoItem
                      key={patrol.id}
                      patrol={patrol}
                      unreadCount={unreadCounts[patrol.id] || 0}
                      onClick={() => handleSelectPatrol(patrol)}
                    />
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="broadcast" className="flex-1 overflow-hidden flex flex-col m-0 p-4">
              <div className="bg-[#1a2a1a]/50 rounded-lg p-4 border border-[#3d5a3d]/30 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radio className="w-4 h-4 text-[#b4a064]" />
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Broadcast to All Patrols</span>
                </div>
                <p className="text-xs text-gray-500">
                  Send a message to all {patrols.length} active patrols simultaneously.
                </p>
              </div>

              <div className="flex-1 flex flex-col justify-end">
                <div className="space-y-3">
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter broadcast message..."
                    className="w-full h-32 p-3 bg-[#1a2a1a] border border-[#3d5a3d]/30 rounded-lg text-white placeholder:text-gray-500 resize-none focus:outline-none focus:border-[#b4a064]/50"
                    data-testid="broadcast-input"
                  />
                  <Button
                    onClick={sendBroadcast}
                    disabled={!broadcastMessage.trim() || isSending}
                    className="w-full bg-[#b4a064] hover:bg-[#a08954] text-black font-semibold"
                    data-testid="send-broadcast-btn"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Radio className="w-4 h-4 mr-2" />
                    )}
                    Send Broadcast
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SecureMessaging;
