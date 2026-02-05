const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

let socket = null;
let currentHqId = null;

export const initSocket = (hqId) => {
  // Store hqId for reconnection
  if (hqId) {
    currentHqId = hqId;
  }
  
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    // Use HQ ID as prefix so backend can route messages correctly
    const clientId = currentHqId 
      ? `${currentHqId}_${Math.random().toString(36).substring(7)}`
      : Math.random().toString(36).substring(7);
    
    socket = new WebSocket(`${wsUrl}/ws/${clientId}`);

    socket.onopen = () => {
      console.log('WebSocket connected with client ID:', clientId);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(() => {
        initSocket();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  return socket;
};

export const getSocket = () => {
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
  currentHqId = null;
};