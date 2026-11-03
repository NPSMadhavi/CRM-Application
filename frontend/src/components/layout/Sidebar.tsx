import React from 'react';
import {
  LayoutDashboard,
  Ticket,
  Users,
  UserCheck,
  Radio,
  Headphones,
  Sparkles,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openTicketCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, openTicketCount = 0 }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tickets', label: 'Tickets', icon: Ticket, badge: openTicketCount },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'agents', label: 'Agent Team', icon: UserCheck, adminOnly: true },
    { id: 'simulator', label: 'Channel Simulator', icon: Radio, highlight: true }
  ];

  return (
    <aside className="w-52 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen select-none transition-colors duration-200 shrink-0">
      {/* Brand Header */}
      <div className="px-3.5 py-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight truncate">Helpdesk</span>
              <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30">
                CRM
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              IT Support Suite
            </p>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
          Workspace
        </div>
        {navItems.map((item) => {
          if (item.adminOnly && user?.role !== 'ADMIN') return null;
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {item.highlight && !isActive && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Sparkles className="w-2 h-2" />
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current Agent Profile & Logout */}
      <div className="p-2.5 px-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={user?.fullName}
            className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-900 dark:text-white truncate">{user?.fullName}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          title="Sign Out"
          className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-900 transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
