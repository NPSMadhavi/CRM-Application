import React, { useEffect, useState } from 'react';
import {
  Bell,
  MessageSquare,
  UserCheck,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  ExternalLink,
  Mail,
  User,
  Clock
} from 'lucide-react';
import { useNotification, ToastNotification } from '../../context/NotificationContext';

interface ToastItemProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onClick: (toast: ToastNotification) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isEntering, setIsEntering] = useState(true);

  const durationMs = toast.autoDismissMs || 7000;

  useEffect(() => {
    const enterTimer = setTimeout(() => setIsEntering(false), 50);
    return () => clearTimeout(enterTimer);
  }, []);

  // Auto-dismiss countdown bar with pause on hover
  useEffect(() => {
    if (isHovered) return;

    const interval = 100;
    const step = (interval / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(toast.id);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isHovered, durationMs, onDismiss, toast.id]);

  // Compute icon and style based on notification type
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'TICKET_CREATED':
        return {
          icon: <Mail className="w-4 h-4 text-blue-400" />,
          badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          badgeLabel: 'New Email Ticket',
          accentBorder: 'border-l-blue-500'
        };
      case 'CUSTOMER_REPLY':
        return {
          icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          badgeLabel: 'Customer Reply',
          accentBorder: 'border-l-emerald-500'
        };
      case 'TICKET_ASSIGNED':
      case 'TICKET_REASSIGNED':
        return {
          icon: <UserCheck className="w-4 h-4 text-purple-400" />,
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          badgeLabel: type === 'TICKET_REASSIGNED' ? 'Reassigned' : 'Assigned',
          accentBorder: 'border-l-purple-500'
        };
      case 'TICKET_STATUS_CHANGED':
        return {
          icon: <RefreshCw className="w-4 h-4 text-amber-400" />,
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          badgeLabel: 'Status Changed',
          accentBorder: 'border-l-amber-500'
        };
      case 'TICKET_RESOLVED':
        return {
          icon: <CheckCircle className="w-4 h-4 text-green-400" />,
          badgeBg: 'bg-green-500/20 text-green-300 border-green-500/30',
          badgeLabel: 'Resolved',
          accentBorder: 'border-l-green-500'
        };
      case 'TICKET_REOPENED':
        return {
          icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          badgeLabel: 'Reopened',
          accentBorder: 'border-l-rose-500'
        };
      default:
        return {
          icon: <Bell className="w-4 h-4 text-indigo-400" />,
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          badgeLabel: 'Notice',
          accentBorder: 'border-l-indigo-500'
        };
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'LOW':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'MEDIUM':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Just now';
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const typeConfig = getTypeConfig(toast.type);
  const displaySubject = toast.subject || toast.title;
  const displaySnippet = toast.description || toast.message;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pointer-events-auto relative w-96 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl bg-slate-900/95 border border-slate-700/80 border-l-4 ${typeConfig.accentBorder} shadow-2xl backdrop-blur-md transition-all duration-300 ease-out cursor-pointer hover:border-slate-500 hover:shadow-indigo-500/10 ${
        isEntering ? 'translate-x-full opacity-0 scale-95' : 'translate-x-0 opacity-100 scale-100'
      }`}
      onClick={() => onClick(toast)}
      role="alert"
    >
      <div className="p-4">
        {/* Top Badges Row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center flex-wrap gap-1.5">
            <div className="p-1 rounded-md bg-slate-800 border border-slate-700/60 flex items-center justify-center">
              {typeConfig.icon}
            </div>
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeConfig.badgeBg}`}>
              {typeConfig.badgeLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
              <Mail className="w-2.5 h-2.5 text-blue-400" />
              <span>Email</span>
            </span>
            {toast.priority && (
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getPriorityBadge(toast.priority)}`}>
                {toast.priority}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {toast.ticketNumber && (
              <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                #{toast.ticketNumber.replace('#', '')}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Customer Name */}
        {toast.customerName && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium mb-1">
            <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">{toast.customerName}</span>
          </div>
        )}

        {/* Subject / Title */}
        <h4 className="text-sm font-semibold text-white leading-snug line-clamp-1 mb-1">
          {displaySubject}
        </h4>

        {/* Short Issue Description / Snippet */}
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-3">
          {displaySnippet}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{formatTimestamp(toast.createdAt)}</span>
          </span>
          <span className="flex items-center gap-1 text-indigo-400 font-medium group-hover:underline">
            <span>Click to view ticket</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-0.5 w-full bg-slate-800">
        <div
          className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const GlobalNotificationContainer: React.FC = () => {
  const { toasts, dismissToast, clickToast } = useNotification();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed top-6 right-6 z-[9999] flex flex-col items-end space-y-3 pointer-events-none select-none"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onClick={clickToast}
        />
      ))}
    </div>
  );
};
