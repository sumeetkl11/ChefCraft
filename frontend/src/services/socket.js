import io from 'socket.io-client';
import { SOCKET_URL } from './api';

let socketInstance = null;
let connectionPromise = null;

/**
 * Socket.io client initialization with race condition protection
 * Connects to backend with JWT authentication (from httpOnly cookie)
 * @returns {Promise<socket.io.Socket>} Promise that resolves to Socket instance
 */
export function initializeSocket() {
  const token = localStorage.getItem('token');
  const validToken = token && token !== 'null' && token !== 'undefined' ? token : null;

  // If socket is already connected
  if (socketInstance?.connected) {
    return Promise.resolve(socketInstance);
  }

  // If connection in progress, return existing promise
  if (connectionPromise) {
    console.log('⏳ Socket.io connection already in progress');
    return connectionPromise;
  }

  // Create new socket instance
  console.log('🔌 Creating new Socket.io connection');
  socketInstance = io(SOCKET_URL, {
    auth: { token: validToken },
    query: { token: validToken },
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling'],
    forceNew: true,
  });

  // Set up event listeners
  socketInstance.on('connect', () => {
    console.log('✅ Socket.io connected:', socketInstance.id || '(pending id)');
  });

  socketInstance.on('connection:success', (data) => {
    console.log('✅ Socket.io authenticated:', data);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('❌ Socket.io disconnected:', reason);
  });

  socketInstance.on('connect_error', (error) => {
    console.warn('Socket.io connection warning:', error?.message || error);
  });

  socketInstance.on('error', (error) => {
    console.warn('Socket.io warning:', error?.message || error);
  });

  // Create promise that resolves when connected
  connectionPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      connectionPromise = null;
      console.warn('⚠️ Socket connection timeout - continuing anyway');
      resolve(socketInstance); // Resolve anyway, connection may complete later
    }, 5000);

    socketInstance.once('connect', () => {
      clearTimeout(timeout);
      connectionPromise = null;
      resolve(socketInstance);
    });

    socketInstance.once('connect_error', (error) => {
      clearTimeout(timeout);
      connectionPromise = null;
      console.warn('Socket connection retrying:', error?.message || error);
      resolve(socketInstance); // Still resolve, allow retry logic
    });
  });

  return connectionPromise;
}

/**
 * Get the current socket instance
 */
export function getSocket() {
  return socketInstance;
}

/**
 * Disconnect Socket.io
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Join a conversation room to receive real-time messages
 * @param {string} conversationId - Conversation ID
 */
export function joinConversation(conversationId) {
  if (!socketInstance || !socketInstance.connected) {
    initializeSocket().then((socket) => {
      if (socket?.connected) {
        socket.emit('conversation:join', conversationId);
      }
    });
    return;
  }
  socketInstance.emit('conversation:join', conversationId);
}

/**
 * Leave a conversation room
 * @param {string} conversationId - Conversation ID
 */
export function leaveConversation(conversationId) {
  if (socketInstance?.connected) {
    socketInstance.emit('conversation:leave', conversationId);
  }
}

/**
 * Emit typing start indicator
 * @param {string} conversationId - Conversation ID
 */
export function emitTypingStart(conversationId) {
  if (socketInstance?.connected) {
    socketInstance.emit('typing:start', conversationId);
  }
}

/**
 * Emit typing end indicator
 * @param {string} conversationId - Conversation ID
 */
export function emitTypingEnd(conversationId) {
  if (socketInstance?.connected) {
    socketInstance.emit('typing:end', conversationId);
  }
}

/**
 * Listen for new messages in a conversation
 * @param {function} callback - Function to call when message received
 */
export function onNewMessage(callback) {
  if (socketInstance) {
    socketInstance.on('message:new', callback);
  }
}

/**
 * Listen for typing indicators
 * @param {function} callback - Function to call when typing event occurs
 */
export function onTypingStart(callback) {
  if (socketInstance) {
    socketInstance.on('typing:start', callback);
  }
}

export function onTypingEnd(callback) {
  if (socketInstance) {
    socketInstance.on('typing:end', callback);
  }
}

/**
 * Listen for new notifications
 * @param {function} callback - Function to call when notification received
 */
export function onNewNotification(callback) {
  if (socketInstance) {
    socketInstance.on('notification:new', callback);
  }
}

/**
 * Listen for activity feed updates
 * @param {function} callback - Function to call when activity occurs
 */
export function onActivityUpdate(callback) {
  if (socketInstance) {
    socketInstance.on('activity:post', callback);
    socketInstance.on('activity:like', callback);
    socketInstance.on('activity:streak', callback);
  }
}

/**
 * Listen for real-time meal plan updates
 * @param {function} callback - Function to call when meal plan update is received
 */
export function onMealPlanUpdate(callback) {
  if (socketInstance) {
    socketInstance.on('mealplan:update', callback);
  }
}

/**
 * Remove event listener
 * @param {string} event - Event name
 * @param {function} callback - Callback function to remove
 */
export function offEvent(event, callback) {
  if (socketInstance) {
    socketInstance.off(event, callback);
  }
}
