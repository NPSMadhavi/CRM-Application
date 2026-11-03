import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { LoginPage } from './components/auth/LoginPage';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { StatCards } from './components/dashboard/StatCards';
import { TicketFilters } from './components/tickets/TicketFilters';
import { TicketTable } from './components/tickets/TicketTable';
import { TicketDetailModal } from './components/tickets/TicketDetailModal';
import { CreateTicketModal } from './components/tickets/CreateTicketModal';
import { CustomerList } from './components/customers/CustomerList';
import { AgentManagement } from './components/admin/AgentManagement';
import { ChannelSimulator } from './components/simulator/ChannelSimulator';
import api from './services/api';
import { Ticket, DashboardStats, User } from './types';
import { getSocket } from './services/socket';
import { Sparkles, Ticket as TicketIcon, Radio, Users, Plus } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);

  // Tickets & Stats state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [assignedToFilter, setAssignedToFilter] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardStats();
      loadTickets();
      loadAgents();

      const socket = getSocket();
      const onRefresh = () => {
        loadDashboardStats();
        loadTickets();
      };

      socket.on('ticket:created', onRefresh);
      socket.on('ticket:updated', onRefresh);

      return () => {
        socket.off('ticket:created', onRefresh);
        socket.off('ticket:updated', onRefresh);
      };
    }
  }, [isAuthenticated, statusFilter, priorityFilter, categoryFilter, channelFilter, assignedToFilter, searchQuery]);

  const loadDashboardStats = async () => {
    try {
      const res = await api.get('/analytics/dashboard');
      if (res.data.success) {
        setDashboardStats(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load dashboard stats', err);
    }
  };

  const loadTickets = async () => {
    try {
      setIsTicketsLoading(true);
      const params: any = {
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        channel: channelFilter,
        assignedToId: assignedToFilter || undefined,
        search: searchQuery || undefined
      };
      const res = await api.get('/tickets', { params });
      if (res.data.success) {
        setTickets(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setIsTicketsLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/agents');
      if (res.data.success) {
        setAgents(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load agents', err);
    }
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setCategoryFilter('ALL');
    setChannelFilter('ALL');
    setAssignedToFilter('');
    setSearchQuery('');
  };

  const handleAssignToMe = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/tickets/${ticketId}/assign`, { agentId: 'ME' });
      loadTickets();
      loadDashboardStats();
    } catch (err) {
      console.error('Failed to assign ticket', err);
    }
  };

  const handleKpiFilterClick = (filterType: string, value: string) => {
    setCurrentTab('tickets');
    if (filterType === 'status') {
      setStatusFilter(value === 'ACTIVE' ? 'OPEN' : value);
    } else if (filterType === 'priority') {
      setPriorityFilter(value);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
        theme === 'dark'
          ? 'dark bg-slate-950 text-slate-100'
          : 'light bg-slate-100 text-slate-900'
      }`}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openTicketCount={dashboardStats?.counts?.active || 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header: Cleaned to Search, Theme Settings & Alerts */}
        <TopNav
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          onSelectTicket={(id) => setSelectedTicketId(id)}
        />

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <div className="space-y-4">
              {dashboardStats && (
                <StatCards
                  stats={dashboardStats.counts}
                  priorities={dashboardStats.priorities}
                  channels={dashboardStats.channels}
                  sla={dashboardStats.sla}
                  onFilterClick={handleKpiFilterClick}
                />
              )}

              {/* Active Tickets Overview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Support Ticket Queue</h3>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30">
                      {tickets.length} showing
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowCreateTicketModal(true)}
                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Ticket</span>
                    </button>
                    <button
                      onClick={() => setCurrentTab('tickets')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold"
                    >
                      View All Tickets &rarr;
                    </button>
                  </div>
                </div>

                <TicketFilters
                  status={statusFilter}
                  setStatus={setStatusFilter}
                  priority={priorityFilter}
                  setPriority={setPriorityFilter}
                  category={categoryFilter}
                  setCategory={setCategoryFilter}
                  channel={channelFilter}
                  setChannel={setChannelFilter}
                  assignedTo={assignedToFilter}
                  setAssignedTo={setAssignedToFilter}
                  onReset={handleResetFilters}
                />

                <TicketTable
                  tickets={tickets.slice(0, 10)}
                  isLoading={isTicketsLoading}
                  onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
                  onAssignToMe={handleAssignToMe}
                />
              </div>
            </div>
          )}

          {/* TAB 2: ALL TICKETS */}
          {currentTab === 'tickets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Support Tickets</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Multi-channel ticket lifecycle, agent triage, and SLA resolution tracking.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateTicketModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Ticket</span>
                </button>
              </div>

              <TicketFilters
                status={statusFilter}
                setStatus={setStatusFilter}
                priority={priorityFilter}
                setPriority={setPriorityFilter}
                category={categoryFilter}
                setCategory={setCategoryFilter}
                channel={channelFilter}
                setChannel={setChannelFilter}
                assignedTo={assignedToFilter}
                setAssignedTo={setAssignedToFilter}
                onReset={handleResetFilters}
              />

              <TicketTable
                tickets={tickets}
                isLoading={isTicketsLoading}
                onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
                onAssignToMe={handleAssignToMe}
              />
            </div>
          )}

          {/* TAB 3: CUSTOMERS */}
          {currentTab === 'customers' && (
            <CustomerList onSelectTicket={(id) => setSelectedTicketId(id)} />
          )}

          {/* TAB 4: AGENTS (ADMIN) */}
          {currentTab === 'agents' && <AgentManagement />}

          {/* TAB 5: CHANNEL SIMULATOR */}
          {currentTab === 'simulator' && (
            <ChannelSimulator
              onTicketCreated={() => {
                loadDashboardStats();
                loadTickets();
              }}
            />
          )}
        </main>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={() => {
            loadDashboardStats();
            loadTickets();
          }}
        />
      )}

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={showCreateTicketModal}
        onClose={() => setShowCreateTicketModal(false)}
        onTicketCreated={() => {
          loadDashboardStats();
          loadTickets();
        }}
        agents={agents}
      />
    </div>
  );
};

