import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types';
import { getSocket } from '../services/socket';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  ticketNumber?: string;
  ticketId?: string;
  customerName?: string;
  subject?: string;
  channel?: string;
  priority?: string;
  description?: string;
  link?: string | null;
  createdAt: string;
  autoDismissMs?: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  toasts: ToastNotification[];
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissToast: (id: string) => void;
  clickToast: (toast: ToastNotification) => void;
  addToast: (toast: Partial<ToastNotification>) => void;
  refreshNotifications: () => Promise<void>;
  setOnSelectTicketCallback: (cb: (ticketId: string) => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_AUTO_DISMISS_MS = 7000;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const queueRef = useRef<ToastNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const onSelectTicketRef = useRef<((ticketId: string) => void) | null>(null);

  const setOnSelectTicketCallback = useCallback((cb: (ticketId: string) => void) => {
    onSelectTicketRef.current = cb;
  }, []);

  // Helper to extract ticket number e.g. TIC-1042 or CRM-000125
  const extractTicketNumber = (title: string, message: string): string | undefined => {
    const match = `${title} ${message}`.match(/(?:TIC|CRM)[-_ ]?\d+/i);
    return match ? match[0].toUpperCase().replace(/\s+/, '-') : undefined;
  };

  // Load persistent notifications from PostgreSQL
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        api.get('/notifications?limit=30'),
        api.get('/notifications/unread-count')
      ]);

      if (notifRes.data.success) {
        setNotifications(notifRes.data.data);
      }
      if (countRes.data.success) {
        setUnreadCount(countRes.data.unreadCount ?? countRes.data.count ?? 0);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
    }
  }, [isAuthenticated, refreshNotifications]);

  // Dismiss a floating toast
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    // Broadcast dismiss to other browser tabs
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'DISMISS_TOAST', id });
    }

    // Pull next queued toast into visible stack
    setTimeout(() => {
      if (queueRef.current.length > 0) {
        const nextToast = queueRef.current.shift()!;
        setToasts((prev) => {
          if (prev.length < MAX_VISIBLE_TOASTS && !prev.some((t) => t.id === nextToast.id)) {
            return [...prev, nextToast];
          }
          return prev;
        });
      }
    }, 100);
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.patch(`/notifications/${id}/read`);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'SYNC_UNREAD_COUNT' });
      }
    } catch (err) {
      console.warn('Failed to mark notification read on backend:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await api.patch('/notifications/read-all');
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'SYNC_UNREAD_COUNT' });
      }
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
    }
  }, []);

  // Click on toast: dismiss, mark read, navigate to ticket
  const clickToast = useCallback(
    async (toast: ToastNotification) => {
      dismissToast(toast.id);
      await markAsRead(toast.id);

      // Open ticket in UI if callback registered
      if (toast.ticketId && onSelectTicketRef.current) {
        onSelectTicketRef.current(toast.ticketId);
      }
    },
    [dismissToast, markAsRead]
  );

  // Add toast with max-5 visible stack and queuing
  const addToast = useCallback((raw: Partial<ToastNotification>) => {
    const id = raw.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Deduplicate against seen IDs
    if (seenIdsRef.current.has(id)) {
      return;
    }
    seenIdsRef.current.add(id);

    const ticketNumber = raw.ticketNumber || extractTicketNumber(raw.title || '', raw.message || '');
    const newToast: ToastNotification = {
      id,
      title: raw.title || 'Notification',
      message: raw.message || '',
      type: raw.type || 'INFO',
      ticketNumber,
      ticketId: raw.ticketId,
      customerName: raw.customerName,
      subject: raw.subject,
      channel: raw.channel || 'EMAIL',
      priority: raw.priority || 'MEDIUM',
      description: raw.description,
      link: raw.link,
      createdAt: raw.createdAt || new Date().toISOString(),
      autoDismissMs: DEFAULT_AUTO_DISMISS_MS
    };

    setToasts((prev) => {
      if (prev.length < MAX_VISIBLE_TOASTS) {
        return [...prev, newToast];
      } else {
        queueRef.current.push(newToast);
        return prev;
      }
    });

    // Update notifications list & unread count in bell dropdown
    setNotifications((prev) => [
      {
        id: newToast.id,
        title: newToast.title,
        message: newToast.message,
        type: newToast.type,
        ticketId: newToast.ticketId,
        isRead: false,
        createdAt: newToast.createdAt
      },
      ...prev
    ]);
    setUnreadCount((prev) => prev + 1);
  }, []);

  // Multi-tab synchronization using BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const bc = new BroadcastChannel('crm_notifications_sync');
    broadcastChannelRef.current = bc;

    bc.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'NEW_NOTIFICATION') {
        addToast(data.payload);
      } else if (data.type === 'DISMISS_TOAST') {
        setToasts((prev) => prev.filter((t) => t.id !== data.id));
      } else if (data.type === 'SYNC_UNREAD_COUNT') {
        refreshNotifications();
      }
    };

    return () => {
      bc.close();
      broadcastChannelRef.current = null;
    };
  }, [addToast, refreshNotifications]);

  // Connect to SSE Stream when authenticated
  useEffect(() => {
    if (!token || !user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const sseUrl = `/api/v1/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      console.log('[SSE] Connected to real-time notification stream');
    });

    es.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(event.data);
        addToast(payload);

        // Broadcast to other open browser tabs
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'NEW_NOTIFICATION',
            payload
          });
        }
      } catch (err) {
        console.warn('[SSE] Error parsing notification event:', err);
      }
    });

    es.onerror = () => {
      // EventSource automatically handles reconnection
      console.debug('[SSE] Stream disconnected or retrying...');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [token, user, addToast]);

  // Fallback & multi-tab redundancy via Socket.IO
  useEffect(() => {
    if (!token || !user) return;

    const socket = getSocket();
    const handleSocketNotification = (payload: any) => {
      if (!payload) return;
      // Filter if targeted to another user
      if (payload.userId && payload.userId !== user.id) {
        return;
      }

      addToast(payload);

      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'NEW_NOTIFICATION',
          payload
        });
      }
    };

    socket.on('notification:new', handleSocketNotification);

    return () => {
      socket.off('notification:new', handleSocketNotification);
    };
  }, [token, user, addToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        markAsRead,
        markAllAsRead,
        dismissToast,
        clickToast,
        addToast,
        refreshNotifications,
        setOnSelectTicketCallback
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};

export const useRealtimeNotifications = useNotification;
