import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, Monitor, Phone, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';

// Jitsi Meet configuration
const JITSI_DOMAIN = 'meet.jit.si';

export const JitsiMeetModal = ({ 
  open, 
  onOpenChange, 
  patrolId, 
  patrolName, 
  hqName,
  userName 
}) => {
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Generate unique room name
  const roomName = `PatrolTrack_${patrolId}_${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    if (!open || !jitsiContainerRef.current) return;

    // Load Jitsi Meet External API
    const loadJitsiScript = () => {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    };

    const initJitsi = async () => {
      try {
        await loadJitsiScript();

        // Clear any existing instance
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
        }

        // Configure Jitsi Meet
        const options = {
          roomName: roomName,
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableWelcomePage: false,
            enableClosePage: false,
            disableDeepLinking: true,
            prejoinPageEnabled: false,
            disableInviteFunctions: true,
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'hangup',
              'chat',
              'recording',
              'settings',
              'raisehand',
              'videoquality',
              'tileview'
            ],
            notifications: [],
            disableThirdPartyRequests: true,
            enableLayerSuspension: true,
            // Low bandwidth optimizations
            enableLipSync: false,
            disableAudioLevels: true,
            channelLastN: 4,
            lastNLimits: {
              5: 20,
              30: 15,
              50: 10,
              70: 5,
              90: 2
            },
            resolution: 720,
            constraints: {
              video: {
                height: { ideal: 720, max: 720, min: 180 }
              }
            }
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: '',
            SHOW_POWERED_BY: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            DISABLE_RINGING: true,
            FILM_STRIP_MAX_HEIGHT: 120,
            VERTICAL_FILMSTRIP: true,
            CLOSE_PAGE_GUEST_HINT: false,
            DEFAULT_BACKGROUND: '#1a1a2e',
            DEFAULT_LOCAL_DISPLAY_NAME: userName || 'HQ Control',
            DEFAULT_REMOTE_DISPLAY_NAME: patrolName || 'Patrol',
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'desktop', 'fullscreen',
              'hangup', 'chat', 'settings', 'raisehand', 'tileview'
            ],
            SETTINGS_SECTIONS: ['devices', 'language'],
            VIDEO_QUALITY_LABEL_DISABLED: false
          },
          userInfo: {
            displayName: userName || `HQ Control - ${hqName || 'Command'}`
          }
        };

        // Initialize Jitsi Meet
        jitsiApiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);

        // Event listeners
        jitsiApiRef.current.addListener('readyToClose', () => {
          onOpenChange(false);
        });

        jitsiApiRef.current.addListener('audioMuteStatusChanged', (status) => {
          setIsAudioMuted(status.muted);
        });

        jitsiApiRef.current.addListener('videoMuteStatusChanged', (status) => {
          setIsVideoMuted(status.muted);
        });

        jitsiApiRef.current.addListener('participantJoined', (participant) => {
          console.log('Participant joined:', participant);
        });

        jitsiApiRef.current.addListener('participantLeft', (participant) => {
          console.log('Participant left:', participant);
        });

      } catch (error) {
        console.error('Failed to initialize Jitsi Meet:', error);
      }
    };

    initJitsi();

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [open, roomName, patrolName, userName, hqName, onOpenChange]);

  // Control functions
  const toggleAudio = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleAudio');
    }
  };

  const toggleVideo = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleVideo');
    }
  };

  const toggleScreenShare = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleShareScreen');
    }
  };

  const hangUp = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('hangup');
    }
    onOpenChange(false);
  };

  const toggleFullscreen = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleFilmStrip');
    }
    setIsFullscreen(!isFullscreen);
  };

  // Get shareable link for patrol commander
  const getJoinLink = () => {
    return `https://${JITSI_DOMAIN}/${roomName}`;
  };

  const copyJoinLink = () => {
    navigator.clipboard.writeText(getJoinLink());
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`bg-gray-900 border-gray-700 p-0 ${isFullscreen ? 'max-w-full w-screen h-screen' : 'max-w-4xl w-full h-[80vh]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <div>
              <h3 className="text-white font-medium text-sm">
                Call with {patrolName || `Patrol ${patrolId}`}
              </h3>
              <p className="text-xs text-gray-400">Room: {roomName}</p>
            </div>
          </div>
          
          {/* Quick Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleAudio}
              className={`h-8 w-8 p-0 ${isAudioMuted ? 'text-red-400' : 'text-white'}`}
              title={isAudioMuted ? 'Unmute' : 'Mute'}
            >
              {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleVideo}
              className={`h-8 w-8 p-0 ${isVideoMuted ? 'text-red-400' : 'text-white'}`}
              title={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleScreenShare}
              className="h-8 w-8 p-0 text-white"
              title="Share screen"
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0 text-white"
              title="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={hangUp}
              className="h-8 px-3"
            >
              <PhoneOff className="w-4 h-4 mr-1" />
              End
            </Button>
          </div>
        </div>

        {/* Jitsi Container */}
        <div 
          ref={jitsiContainerRef} 
          className="flex-1 w-full bg-black"
          style={{ height: isFullscreen ? 'calc(100vh - 56px)' : 'calc(80vh - 56px)' }}
        />

        {/* Join Link Footer */}
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Share this link with patrol commander to join:
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-700 px-2 py-1 rounded text-cyan-400">
              {getJoinLink().substring(0, 40)}...
            </code>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copyJoinLink}>
              Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Call button component for patrol list/map
export const CallPatrolButton = ({ patrol, hqName, onCall, size = 'default' }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    if (onCall) {
      onCall(patrol);
    }
  };

  if (size === 'icon') {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
        title={`Call ${patrol.name}`}
      >
        <Video className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleClick}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      <Video className="w-4 h-4 mr-1" />
      Call
    </Button>
  );
};

export default JitsiMeetModal;
