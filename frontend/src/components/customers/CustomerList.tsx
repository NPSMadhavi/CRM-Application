import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Customer } from '../../types';
import {
  Mail,
  Phone,
  Building,
  Ticket,
  Plus,
  Search,
  ChevronRight,
  Star,
  Clock,
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap
} from 'lucide-react';

interface CustomerListProps {
  onSelectTicket?: (ticketId: string) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({ onSelectTicket }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New customer form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newIsVip, setNewIsVip] = useState(false);
  const [newPlanType, setNewPlanType] = useState('ADHOC_4H');

  // Plan Management Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planActionType, setPlanActionType] = useState<'RELOAD' | 'SWITCH'>('RELOAD');
  const [selectedPlanCode, setSelectedPlanCode] = useState('ADHOC_4H');
  const [reloadHoursInput, setReloadHoursInput] = useState<number>(4);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);

  useEffect(() => {
    loadCustomers();
  }, [search]);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const res = await api.get('/support-plans');
      if (res.data.success) {
        setAvailablePlans(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load support plans', err);
    }
  };

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/customers', { params: { search } });
      if (res.data.success) {
        setCustomers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCustomer = async (cust: Customer) => {
    try {
      const res = await api.get(`/customers/${cust.id}`);
      if (res.data.success) {
        setSelectedCustomer(res.data.customer);
      }
    } catch (err) {
      setSelectedCustomer(cust);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await api.post('/customers', {
        name: newName.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        company: newCompany.trim() || undefined,
        isVip: newIsVip,
        supportPlanType: newPlanType
      });

      if (res.data.success) {
        setShowAddModal(false);
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewCompany('');
        setNewIsVip(false);
        setNewPlanType('ADHOC_4H');
        loadCustomers();
      }
    } catch (err) {
      console.error('Failed to create customer', err);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      setIsUpdatingPlan(true);
      const payload: any = {};
      if (planActionType === 'SWITCH') {
        payload.planCode = selectedPlanCode;
      } else {
        payload.reloadHours = Number(reloadHoursInput);
      }

      const res = await api.put(`/customers/${selectedCustomer.id}/plan`, payload);
      if (res.data.success) {
        setSelectedCustomer(res.data.customer);
        setShowPlanModal(false);
        loadCustomers();
      }
    } catch (err) {
      console.error('Failed to update support plan', err);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Directory Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Customer Directory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Maintain customer profiles, contracted support working hours, ad-hoc quota balances, and history.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* Search & Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, email, or phone..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 shadow-sm"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Showing <span className="font-bold text-slate-900 dark:text-white">{customers.length}</span> customer accounts
        </div>
      </div>

      {/* Table Design for Customers */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading customer directory...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500 dark:text-slate-400 shadow-sm">
          No customer accounts found matching your query.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Company</th>
                  <th className="py-3.5 px-4">Support Plan & Hours</th>
                  <th className="py-3.5 px-4">Working Window</th>
                  <th className="py-3.5 px-4">Channel</th>
                  <th className="py-3.5 px-4">Tickets</th>
                  <th className="py-3.5 px-4">Joined</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {customers.map((c) => {
                  const metrics = c.planMetrics;
                  const isDepleted = metrics?.isDepleted;
                  const isAdhoc = c.supportPlanType?.startsWith('ADHOC') || (!c.supportPlanType && c.allocatedHours === 4);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* Customer Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500/10 to-indigo-500/20 dark:from-indigo-600/20 dark:to-cyan-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {c.name}
                              </p>
                              {c.isVip && (
                                <span title="VIP Account">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">ID: {c.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {c.company ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            {c.company}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 italic">Direct Client</span>
                        )}
                      </td>

                      {/* Support Plan & Hours Balance */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5 min-w-[170px]">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isAdhoc
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60'
                              }`}
                            >
                              <Zap className="w-2.5 h-2.5" />
                              {c.supportPlanName || (isAdhoc ? 'Ad-hoc 4-Hour Pack' : 'Standard Support')}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              ${c.hourlyRate || 85}/h
                            </span>
                          </div>

                          {/* Hours meter bar */}
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isDepleted
                                  ? 'bg-rose-500'
                                  : (metrics?.usagePercentage || 0) > 75
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, metrics?.usagePercentage || 0)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            {isDepleted ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Exhausted (+{metrics?.overageHours || 0}h overage)
                              </span>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {metrics?.remainingHours ?? 0}h
                                </span>{' '}
                                left of {metrics?.allocatedHours ?? 4}h
                              </span>
                            )}
                            <span className="text-slate-400">
                              {metrics?.usedHours ?? 0}h logged
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Working Hours Window */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              metrics?.isWithinWorkingHours
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                metrics?.isWithinWorkingHours ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                              }`}
                            />
                            <span>{metrics?.isWithinWorkingHours ? 'Open Now' : 'Off Hours'}</span>
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {c.workingHoursWindow === '24X7'
                              ? '24/7/365 Coverage'
                              : c.workingHoursWindow === 'MON_SAT_8AM_8PM'
                              ? 'Mon-Sat 8am-8pm'
                              : 'Mon-Fri 9am-6pm'}
                          </p>
                        </div>
                      </td>

                      {/* Source Channel */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {c.sourceChannel || 'DIRECT'}
                        </span>
                      </td>

                      {/* Ticket Count */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-semibold text-[11px]">
                          <Ticket className="w-3 h-3" />
                          {c._count?.tickets || 0}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCustomer(c);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-end p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-l sm:border border-slate-200 dark:border-slate-800 sm:rounded-3xl w-full max-w-xl h-full sm:h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{selectedCustomer.name}</h3>
                    {selectedCustomer.isVip && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                        VIP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedCustomer.company || 'Direct Client'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
              {/* Contracted Support Plan & Working Hours Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-950 border border-indigo-200/80 dark:border-indigo-500/30 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedCustomer.planMetrics?.planName || selectedCustomer.supportPlanName || 'Support Contract'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPlanCode(selectedCustomer.supportPlanType || 'ADHOC_4H');
                      setShowPlanModal(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reload / Change Plan</span>
                  </button>
                </div>

                {/* Working Hours status alert */}
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                    selectedCustomer.planMetrics?.isWithinWorkingHours
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold text-[11px]">
                      {selectedCustomer.planMetrics?.workingHoursNote || 'Support window check'}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-900/60">
                    {selectedCustomer.workingHoursWindow || 'Standard'}
                  </span>
                </div>

                {/* Hours Metric Grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Contracted</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {selectedCustomer.planMetrics?.allocatedHours ?? selectedCustomer.allocatedHours ?? 4}h
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Logged Time</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedCustomer.planMetrics?.usedHours ?? selectedCustomer.usedHours ?? 0}h
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      selectedCustomer.planMetrics?.isDepleted
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Balance</span>
                    <span
                      className={`text-sm font-bold ${
                        selectedCustomer.planMetrics?.isDepleted
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {selectedCustomer.planMetrics?.isDepleted
                        ? `-${selectedCustomer.planMetrics?.overageHours}h`
                        : `${selectedCustomer.planMetrics?.remainingHours ?? 0}h`}
                    </span>
                  </div>
                </div>

                {/* Overage Warning if depleted */}
                {selectedCustomer.planMetrics?.isDepleted && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Contract Quota Exhausted!</span>
                      <p className="text-[11px] mt-0.5">
                        This client has incurred {selectedCustomer.planMetrics.overageHours} hours overage, totaling{' '}
                        <strong className="underline">${selectedCustomer.planMetrics.overageAmount.toFixed(2)}</strong> at their contracted rate of ${selectedCustomer.planMetrics.hourlyRate}/h.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <h5 className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  Contact & Channel
                </h5>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Email</span>
                    <span>{selectedCustomer.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Phone</span>
                    <span>{selectedCustomer.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Source Channel</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{selectedCustomer.sourceChannel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px]">VIP Status</span>
                    <span>{selectedCustomer.isVip ? 'Yes' : 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* Ticket History */}
              <div>
                <h5 className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Ticket History ({selectedCustomer.tickets?.length || 0})</span>
                </h5>
                <div className="space-y-2.5">
                  {selectedCustomer.tickets?.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">No tickets associated with this customer yet.</p>
                  ) : (
                    selectedCustomer.tickets?.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedCustomer(null);
                          if (onSelectTicket) onSelectTicket(t.id);
                        }}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-all text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">#{t.ticketNumber}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{t.title}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {t.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Management / Top-up Modal */}
      {showPlanModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdatePlan}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Support Plan & Hours</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Client: {selectedCustomer.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Switch between Top-up and Change Contract */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPlanActionType('RELOAD')}
                className={`py-2 rounded-lg transition-all ${
                  planActionType === 'RELOAD'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Top-up Ad-hoc Hours
              </button>
              <button
                type="button"
                onClick={() => setPlanActionType('SWITCH')}
                className={`py-2 rounded-lg transition-all ${
                  planActionType === 'SWITCH'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Switch Plan Contract
              </button>
            </div>

            {planActionType === 'RELOAD' ? (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Add pre-paid support hours to this customer's existing balance. Typically purchased in 4-hour ad-hoc blocks.
                </p>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Hours to Add
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 4, 8].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setReloadHoursInput(hrs)}
                        className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                          reloadHoursInput === hrs
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        +{hrs} Hours
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Or Custom Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={reloadHoursInput}
                    onChange={(e) => setReloadHoursInput(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex justify-between">
                  <span className="text-slate-500">Hourly Rate:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ${selectedCustomer.hourlyRate || 85}/hr
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select a contracted plan. Changing the plan updates hourly rates, monthly quota, and support hours coverage.
                </p>
                {availablePlans.map((p) => (
                  <div
                    key={p.code}
                    onClick={() => setSelectedPlanCode(p.code)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedPlanCode === p.code
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        ${p.price} ({p.hoursIncluded}h)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-mono">
                      <span>Window: {p.workingHoursLabel}</span>
                      <span>Rate: ${p.hourlyRate}/h</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingPlan}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
              >
                {isUpdatingPlan ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCustomer}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Add New Customer</h3>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Phone Number (WhatsApp)</label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+15551234567"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Company</label>
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Support Plan Contract</label>
              <select
                value={newPlanType}
                onChange={(e) => setNewPlanType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="ADHOC_4H">Ad-hoc 4-Hour Pack (Pre-paid, $85/h)</option>
                <option value="RETAINER_20H">Standard 20h Monthly Retainer ($75/h)</option>
                <option value="ENTERPRISE_50H">Enterprise 50h Retainer ($65/h, 24/7)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVip"
                checked={newIsVip}
                onChange={(e) => setNewIsVip(e.target.checked)}
                className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-0"
              />
              <label htmlFor="isVip" className="text-xs text-slate-700 dark:text-slate-300">
                Mark as VIP Customer (Priority routing)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Save Customer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
