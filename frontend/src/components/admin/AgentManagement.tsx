import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { User } from '../../types';
import {
  Plus,
  Shield,
  Ticket,
  Search,
  Edit2,
  Trash2,
  Power,
  Users,
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AgentManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [agents, setAgents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'AGENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add form state
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('agent123');
  const [addRole, setAddRole] = useState<'ADMIN' | 'AGENT'>('AGENT');
  const [addPhone, setAddPhone] = useState('');

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'ADMIN' | 'AGENT'>('AGENT');
  const [editPhone, setEditPhone] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/agents');
      if (res.data.success) {
        setAgents(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load agents', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load agent team');
    } finally {
      setIsLoading(false);
    }
  };

  // CREATE
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFullName.trim() || !addEmail.trim() || !addPassword) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);
      const res = await api.post('/agents', {
        fullName: addFullName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        role: addRole,
        phone: addPhone.trim() || undefined
      });

      if (res.data.success) {
        setShowAddModal(false);
        setAddFullName('');
        setAddEmail('');
        setAddPassword('agent123');
        setAddRole('AGENT');
        setAddPhone('');
        showToast('Agent created successfully');
        loadAgents();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to create agent');
    } finally {
      setActionLoading(false);
    }
  };

  // OPEN EDIT MODAL
  const openEditModal = (ag: User) => {
    setEditingAgent(ag);
    setEditFullName(ag.fullName);
    setEditEmail(ag.email);
    setEditPassword('');
    setEditRole(ag.role === 'ADMIN' ? 'ADMIN' : 'AGENT');
    setEditPhone(ag.phone || '');
    setEditIsActive(ag.isActive);
    setErrorMessage(null);
  };

  // UPDATE
  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);
      const payload: any = {
        fullName: editFullName.trim(),
        email: editEmail.trim(),
        role: editRole,
        phone: editPhone.trim() || null,
        isActive: editIsActive
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await api.put(`/agents/${editingAgent.id}`, payload);
      if (res.data.success) {
        setEditingAgent(null);
        showToast('Agent updated successfully');
        loadAgents();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to update agent');
    } finally {
      setActionLoading(false);
    }
  };

  // TOGGLE ACTIVE / DEACTIVATE
  const handleToggleActive = async (ag: User, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentUser?.id === ag.id && ag.isActive) {
      alert('You cannot deactivate your own current admin session.');
      return;
    }

    try {
      const res = await api.put(`/agents/${ag.id}`, {
        isActive: !ag.isActive
      });
      if (res.data.success) {
        showToast(ag.isActive ? 'Agent deactivated' : 'Agent activated');
        loadAgents();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle agent status');
    }
  };

  // DELETE
  const handleDeleteAgent = async () => {
    if (!deletingAgent) return;

    try {
      setActionLoading(true);
      setErrorMessage(null);
      const res = await api.delete(`/agents/${deletingAgent.id}`);
      if (res.data.success) {
        setDeletingAgent(null);
        showToast('Agent deleted and active tickets returned to queue');
        loadAgents();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to delete agent');
    } finally {
      setActionLoading(false);
    }
  };

  // Computed metrics
  const totalAgents = agents.length;
  const activeCount = agents.filter((a) => a.isActive).length;
  const adminCount = agents.filter((a) => a.role === 'ADMIN').length;
  const totalWorkload = agents.reduce((acc, a) => acc + (a.activeTicketCount || 0), 0);

  // Filtered agents
  const filteredAgents = useMemo(() => {
    return agents.filter((ag) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ag.fullName.toLowerCase().includes(q) ||
        ag.email.toLowerCase().includes(q) ||
        (ag.phone && ag.phone.toLowerCase().includes(q));

      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'ADMIN' ? ag.role === 'ADMIN' : ag.role !== 'ADMIN');

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? ag.isActive : !ag.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [agents, search, roleFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Agent Team Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create, manage, and assign roles for support agents and administrators.
          </p>
        </div>

        {currentUser?.role === 'ADMIN' && (
          <button
            onClick={() => {
              setErrorMessage(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Agent</span>
          </button>
        )}
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Total Team</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {totalAgents}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Registered members</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Active Agents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {activeCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Eligible for ticket triage</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Administrators</span>
            <Shield className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
            {adminCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Full system RBAC access</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">Active Tickets</span>
            <Ticket className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">
            {totalWorkload}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Assigned workload</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 shadow-sm"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 shadow-sm"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admins Only</option>
            <option value="AGENT">Agents Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="DISABLED">Disabled Only</option>
          </select>
        </div>
      </div>

      {/* Agents Table */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading agent team...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          No agent profiles match your current search or filters.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Agent</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Active Workload</th>
                  <th className="py-3.5 px-4">Status</th>
                  {currentUser?.role === 'ADMIN' && (
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredAgents.map((ag) => {
                  const isCurrent = currentUser?.id === ag.id;
                  return (
                    <tr
                      key={ag.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              ag.avatarUrl ||
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                            }
                            alt={ag.fullName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {ag.fullName}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded border border-indigo-500/20">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {ag.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            ag.role === 'ADMIN'
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {ag.role === 'ADMIN' ? 'Admin' : 'Agent'}
                        </span>
                      </td>

                      {/* Contact Phone */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {ag.phone || '—'}
                      </td>

                      {/* Workload */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                          <Ticket className="w-3.5 h-3.5" />
                          {ag.activeTicketCount || 0} active
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            ag.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ag.isActive
                                ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                                : 'bg-rose-500 dark:bg-rose-400'
                            }`}
                          ></span>
                          {ag.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Actions */}
                      {currentUser?.role === 'ADMIN' && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => openEditModal(ag)}
                              title="Edit Agent Details"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle Active / Deactivate Button */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleActive(ag, e)}
                              disabled={isCurrent && ag.isActive}
                              title={
                                isCurrent && ag.isActive
                                  ? 'Cannot deactivate yourself'
                                  : ag.isActive
                                  ? 'Deactivate Agent'
                                  : 'Activate Agent'
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                isCurrent && ag.isActive
                                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                  : ag.isActive
                                  ? 'text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-800'
                                  : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMessage(null);
                                setDeletingAgent(ag);
                              }}
                              disabled={isCurrent}
                              title={
                                isCurrent
                                  ? 'Cannot delete your own admin account'
                                  : 'Delete Agent Profile'
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                isCurrent
                                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD AGENT (CREATE) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAgent}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Register New Agent
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={addFullName}
                onChange={(e) => setAddFullName(e.target.value)}
                placeholder="Marcus Vance"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="marcus.v@crm.local"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Temporary Password *
              </label>
              <input
                type="password"
                required
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  System Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="AGENT">Support Agent</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+1 555-0192"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: EDIT AGENT (UPDATE) */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateAgent}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Edit Agent Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                New Password (leave blank to keep unchanged)
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  System Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="AGENT">Support Agent</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-0"
              />
              <label
                htmlFor="editIsActive"
                className="text-xs text-slate-700 dark:text-slate-300 font-medium"
              >
                Account is Active and eligible for assignment
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION (DELETE) */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Delete Agent
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <strong className="text-slate-900 dark:text-white">
                {deletingAgent.fullName}
              </strong>{' '}
              ({deletingAgent.email})?
            </p>

            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
              ⚠️ Any tickets assigned to this agent ({deletingAgent.activeTicketCount || 0}{' '}
              active) will be safely unassigned and returned to the open queue.
            </p>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAgent}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
