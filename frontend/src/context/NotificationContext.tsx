import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSocket } from '../services/socket';
import { AppNotification, Ticket } from '../types';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  ticketId?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  toasts: ToastItem[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissToast: (id: string) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      title: 'System Initialized',
      message: 'IT Support CRM is listening for WhatsApp & Email tickets.',
      type: 'TICKET_CREATED',
      isRead: false,
      createdAt: new Date().toISOString()
    }
  ]);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastItem = { ...toast, id };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      dismissToast(id);
    }, 6000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  useEffect(() => {
    const socket = getSocket();

    // 1. Listen for new tickets
    const handleTicketCreated = (data: { ticket: Ticket; notification?: AppNotification }) => {
      const ticket = data.ticket;
      const notifItem: AppNotification = {
        id: `notif-${Date.now()}`,
        title: `New ${ticket.channel} Ticket #${ticket.ticketNumber}`,
        message: `${ticket.customer.name}: ${ticket.title}`,
        type: 'TICKET_CREATED',
        ticketId: ticket.id,
        isRead: false,
        createdAt: new Date().toISOString()
      };

      setNotifications((prev) => [notifItem, ...prev]);

      addToast({
        title: `⚡ New Ticket #${ticket.ticketNumber} [${ticket.priority}]`,
        message: `${ticket.title} (${ticket.channel})`,
        type: ticket.priority === 'CRITICAL' ? 'error' : 'info',
        ticketId: ticket.id
      });
    };

    // 2. Listen for ticket updates
    const handleTicketUpdated = (data: { ticket: Ticket; oldStatus?: string; newStatus?: string }) => {
      if (data.newStatus) {
        addToast({
          title: `Ticket #${data.ticket.ticketNumber} Status Changed`,
          message: `Updated to ${data.newStatus}`,
          type: 'success',
          ticketId: data.ticket.id
        });
      }
    };

    // 3. Listen for incoming message
    const handleMessageReceived = (data: { ticketId: string; message: any; ticket: Ticket }) => {
      if (data.message.senderType === 'CUSTOMER') {
        addToast({
          title: `💬 New Reply on #${data.ticket?.ticketNumber || 'Ticket'}`,
          message: `${data.message.senderName}: "${data.message.body.substring(0, 50)}..."`,
          type: 'info',
          ticketId: data.ticketId
        });
      }
    };

    socket.on('ticket:created', handleTicketCreated);
    socket.on('ticket:updated', handleTicketUpdated);
    socket.on('message:received', handleMessageReceived);

    return () => {
      socket.off('ticket:created', handleTicketCreated);
      socket.off('ticket:updated', handleTicketUpdated);
      socket.off('message:received', handleMessageReceived);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        markAsRead,
        markAllAsRead,
        dismissToast,
        addToast
      }}
    >
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
              toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-600/50 text-rose-100'
                : toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-600/50 text-emerald-100'
                : 'bg-slate-900/95 border-indigo-500/40 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm">{toast.title}</h4>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">{toast.message}</p>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};

