import React, { useState, useEffect } from 'react';
import {
  Ticket,
  TicketStatus,
  User
} from '../../types';
import api from '../../services/api';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ChannelBadge } from './ChannelBadge';
import { joinTicketRoom, leaveTicketRoom } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Send,
  Lock,
  MessageSquare,
  Sparkles,
  Clock,
  Building,
  Mail,
  Phone,
  CheckCircle2,
  History,
  AlertTriangle,
  Briefcase,
  Zap,
  Shield
} from 'lucide-react';

interface TicketDetailModalProps {
  ticketId: string | null;
  onClose: () => void;
  onTicketUpdated: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticketId,
  onClose,
  onTicketUpdated
}) => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'conversation' | 'worklogs' | 'audit'>('conversation');

  // Work log form state
  const [durationHours, setDurationHours] = useState('1.0');
  const [workDescription, setWorkDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [isSubmittingWorkLog, setIsSubmittingWorkLog] = useState(false);

  // Composer state
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [replyText, setReplyText] = useState('');
  const [replyChannel, setReplyChannel] = useState<'WHATSAPP' | 'EMAIL'>('EMAIL');
  const [isSending, setIsSending] = useState(false);

  // Status Change State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const cannedResponses = [
    { label: 'Select quick canned reply...', text: '' },
    {
      label: 'Requesting diagnostic logs / screenshot',
      text: 'Thank you for providing the details. To help us troubleshoot further, could you please provide a screenshot of the error message or any relevant log files?'
    },
    {
      label: 'Investigating with Tier 2 Infrastructure Team',
      text: 'Our engineering team is currently investigating the incident on the backend infrastructure. We are actively working on a fix and will update you shortly.'
    },
    {
      label: 'Scheduled maintenance / Known incident',
      text: 'This is a known issue related to today’s network upgrade. Our team has applied a hotfix. Please refresh your session and verify if it is working.'
    },
    {
      label: 'Resolution Confirmation',
      text: 'We have resolved the reported issue. Please test on your end and let us know if everything is functioning as expected. Have a great day!'
    }
  ];

  useEffect(() => {
    if (ticketId) {
      loadTicket();
      loadAgents();
      joinTicketRoom(ticketId);
    }
    return () => {
      if (ticketId) leaveTicketRoom(ticketId);
    };
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      if (res.data.success) {
        setTicket(res.data.ticket);
        setReplyChannel(res.data.ticket.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL');
      }
    } catch (err) {
      console.error('Failed to load ticket', err);
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

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;
    if (newStatus === 'RESOLVED') {
      setShowResolveModal(true);
      return;
    }
    try {
      await api.patch(`/tickets/${ticket.id}/status`, { status: newStatus });
      loadTicket();
      onTicketUpdated();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const submitResolution = async () => {
    if (!ticket) return;
    try {
      await api.patch(`/tickets/${ticket.id}/status`, {
        status: 'RESOLVED',
        resolutionNotes: resolutionNote.trim() || 'Resolved by support team'
      });
      setShowResolveModal(false);
      setResolutionNote('');
      loadTicket();
      onTicketUpdated();
    } catch (err) {
      console.error('Failed to resolve ticket', err);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!ticket) return;
    try {
      await api.patch(`/tickets/${ticket.id}/assign`, { agentId });
      loadTicket();
      onTicketUpdated();
    } catch (err) {
      console.error('Failed to assign ticket', err);
    }
  };

  const handleLogWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !durationHours || !workDescription.trim()) return;

    try {
      setIsSubmittingWorkLog(true);
      const res = await api.post(`/tickets/${ticket.id}/work-logs`, {
        durationHours: Number(durationHours),
        description: workDescription.trim(),
        isBillable
      });

      if (res.data.success) {
        setWorkDescription('');
        setDurationHours('1.0');
        loadTicket();
        onTicketUpdated();
      }
    } catch (err) {
      console.error('Failed to log work hours', err);
    } finally {
      setIsSubmittingWorkLog(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !ticket) return;

    try {
      setIsSending(true);
      if (composerMode === 'reply') {
        await api.post(`/tickets/${ticket.id}/reply`, {
          body: replyText.trim(),
          channel: replyChannel
        });
      } else {
        await api.post(`/tickets/${ticket.id}/note`, {
          content: replyText.trim()
        });
      }
      setReplyText('');
      loadTicket();
      onTicketUpdated();
    } catch (err) {
      console.error('Failed to send message/note', err);
    } finally {
      setIsSending(false);
    }
  };

  if (!ticketId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto transition-colors duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl">
              #{ticket?.ticketNumber}
            </span>
            {ticket && <StatusBadge status={ticket.status} />}
            {ticket && <PriorityBadge priority={ticket.priority} />}
            {ticket && <ChannelBadge channel={ticket.channel} />}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Created {ticket ? new Date(ticket.createdAt).toLocaleString() : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-y-auto">
          {/* Main Conversation & Details Area (2 cols) */}
          <div className="lg:col-span-2 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/60">
            {/* Ticket Subject Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800/80">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{ticket?.title}</h2>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Category:</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {ticket?.category?.replace('_', ' ')}
                </span>
                {ticket?.sentiment && (
                  <>
                    <span>•</span>
                    <span>Sentiment:</span>
                    <span
                      className={`font-semibold ${
                        ticket.sentiment === 'URGENT' || ticket.sentiment === 'ANGRY'
                          ? 'text-rose-600 dark:text-rose-400'
                          : ticket.sentiment === 'FRUSTRATED'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {ticket.sentiment}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* AI Entity & Intent Detection Banner */}
            {ticket?.aiExtracted && (
              <div className="m-4 p-4 rounded-2xl bg-gradient-to-r from-purple-100/70 via-indigo-50/50 to-white dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-slate-900 border border-purple-200 dark:border-purple-500/30 shadow-sm">
                <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 font-semibold mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>AI-Powered Ticket Intelligence</span>
                  </div>
                  <span className="bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 text-[10px]">
                    Confidence {Math.round((ticket.aiConfidence || 0.9) * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">{ticket.aiSummary}</p>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('conversation')}
                className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'conversation'
                    ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Conversation & History</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
                  {ticket?.messages?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('worklogs')}
                className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'worklogs'
                    ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Time Tracking & Work Logs</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
                  {ticket?.workLogs?.length || 0} ({ticket?.totalTimeHours || 0}h)
                </span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'audit'
                    ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Trail & Activity</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
                  {ticket?.auditLogs?.length || 0}
                </span>
              </button>
            </div>

            {/* Tab 1: Conversation Messages Stream */}
            {activeTab === 'conversation' && (
              <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[380px]">
                {/* Initial Description */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {ticket?.customer?.name} (Original Request)
                    </span>
                    <span>{ticket ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {ticket?.description}
                  </p>
                </div>

                {/* Messages & Notes Stream */}
                {ticket?.messages?.map((msg) => {
                  const isCustomer = msg.senderType === 'CUSTOMER';
                  const isSystem = msg.senderType === 'SYSTEM';

                  if (isSystem) {
                    return (
                      <div
                        key={msg.id}
                        className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-800 dark:text-indigo-300 flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-indigo-900 dark:text-indigo-200 text-[11px]">
                            Automated Acknowledgement Sent
                          </p>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{msg.body}</p>
                          <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-1 inline-block">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-xs shadow-sm ${
                          isCustomer
                            ? 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-200 dark:border-slate-700/60'
                            : 'bg-indigo-600 text-white rounded-tr-sm shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-80">
                          <span className="font-bold">{msg.senderName}</span>
                          <span className="text-[10px]">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Internal Notes */}
                {ticket?.notes && ticket.notes.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase mb-2 block">
                      Internal Agent Notes
                    </span>
                    <div className="space-y-2">
                      {ticket.notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200"
                        >
                          <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-400 font-semibold mb-1">
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              {note.author?.fullName}
                            </span>
                            <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Work Logs & Hours */}
            {activeTab === 'worklogs' && (
              <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[460px]">
                {/* Plan Quota & Hours Overview Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-950 border border-indigo-200 dark:border-indigo-500/30 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {ticket?.customer?.planMetrics?.planName || ticket?.customer?.supportPlanName || 'Ad-hoc Support Contract'}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ticket?.customer?.planMetrics?.isWithinWorkingHours
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {ticket?.customer?.planMetrics?.workingHoursNote || 'Support Window'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Contracted</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {ticket?.customer?.planMetrics?.allocatedHours ?? 4}h
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Used to Date</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        {ticket?.customer?.planMetrics?.usedHours ?? 0}h
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-xl border ${
                        ticket?.customer?.planMetrics?.isDepleted
                          ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Remaining</span>
                      <span
                        className={`text-sm font-bold ${
                          ticket?.customer?.planMetrics?.isDepleted
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {ticket?.customer?.planMetrics?.isDepleted
                          ? `-${ticket.customer.planMetrics.overageHours}h Overage`
                          : `${ticket?.customer?.planMetrics?.remainingHours ?? 0}h`}
                      </span>
                    </div>
                  </div>

                  {ticket?.customer?.planMetrics?.isDepleted && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        Client quota exhausted. Billable hours will incur overage charges at $
                        {ticket?.customer?.planMetrics?.hourlyRate || 85}/hr.
                      </span>
                    </div>
                  )}
                </div>

                {/* Log Time Form */}
                <form
                  onSubmit={handleLogWork}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
                >
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Log Time Worked on this Ticket</span>
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Quick Hours:</span>
                      {['0.5', '1.0', '1.5', '2.0', '4.0'].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setDurationHours(h)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            durationHours === h
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Duration (Hours)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.1"
                          required
                          value={durationHours}
                          onChange={(e) => setDurationHours(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Work Description / Tasks Completed
                        </label>
                        <input
                          type="text"
                          required
                          value={workDescription}
                          onChange={(e) => setWorkDescription(e.target.value)}
                          placeholder="e.g., Investigated database timeout, adjusted connection pool, verified fix"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={isBillable}
                          onChange={(e) => setIsBillable(e.target.checked)}
                          className="rounded text-indigo-600 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-0"
                        />
                        <span>Bill against customer plan quota</span>
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmittingWorkLog || !workDescription.trim()}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
                      >
                        {isSubmittingWorkLog ? 'Logging...' : 'Save Work Log'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Work Log Entries */}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                    Work History for #{ticket?.ticketNumber} ({ticket?.workLogs?.length || 0} entries)
                  </h5>

                  {ticket?.workLogs && ticket.workLogs.length > 0 ? (
                    ticket.workLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs space-y-1 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                              {log.durationHours} hrs
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">{log.agentName}</span>
                            {log.isBillable ? (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                Billable
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                Non-billable
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mt-1 pl-1">{log.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic p-3">No work hours logged on this ticket yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Audit Logs */}
            {activeTab === 'audit' && (
              <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[380px]">
                {ticket?.auditLogs?.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs flex items-start justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.action}</span>
                      <p className="text-slate-700 dark:text-slate-300 mt-0.5">{log.details || `Updated ${log.fieldChanged}`}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Actor: {log.actorName}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Composer Footer (Only shown on Conversation tab) */}
            {activeTab === 'conversation' && (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/80">
                {/* Composer Header Controls */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setComposerMode('reply')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        composerMode === 'reply'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Reply to Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('note')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        composerMode === 'note'
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      Internal Note
                    </button>
                  </div>

                  {composerMode === 'reply' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Send via:</span>
                      <select
                        value={replyChannel}
                        onChange={(e) => setReplyChannel(e.target.value as any)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1"
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="EMAIL">Email</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Canned Responses Dropdown */}
                {composerMode === 'reply' && (
                  <div className="mb-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) setReplyText(e.target.value);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 rounded-lg px-3 py-1.5 focus:outline-none"
                    >
                      {cannedResponses.map((cr, idx) => (
                        <option key={idx} value={cr.text}>
                          {cr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Text Input */}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      composerMode === 'reply'
                        ? `Type response to send via ${replyChannel}...`
                        : 'Add private internal note visible only to support agents...'
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !replyText.trim()}
                    className={`p-3 rounded-xl text-white font-semibold flex items-center justify-center transition-all ${
                      composerMode === 'reply'
                        ? 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'
                        : 'bg-amber-600 hover:bg-amber-500 disabled:opacity-50'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Sidebar: Meta, Customer Profile & Actions (1 col) */}
          <div className="p-5 space-y-5 bg-slate-50 dark:bg-slate-950/40">
            {/* Status Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                Ticket Lifecycle Status
              </label>
              <select
                value={ticket?.status}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 shadow-sm"
              >
                <option value="NEW">New</option>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Agent Assignee */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Assigned Agent
                </label>
                <button
                  onClick={() => user && handleAssignAgent(user.id)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Assign to Me
                </button>
              </div>
              <select
                value={ticket?.assignedToId || ''}
                onChange={(e) => handleAssignAgent(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 shadow-sm"
              >
                <option value="">-- Unassigned --</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.fullName} ({ag.role?.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* SLA Target Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2 shadow-sm">
              <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  SLA Target Due
                </span>
                <span className={ticket?.slaBreached ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                  {ticket?.slaBreached ? 'Breached' : 'Within Target'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>First Response Due:</span>
                  <span className="text-slate-800 dark:text-slate-300 font-mono">
                    {ticket?.slaResponseDue ? new Date(ticket.slaResponseDue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '4 Hours'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Resolution Due:</span>
                  <span className="text-slate-800 dark:text-slate-300 font-mono">
                    {ticket?.slaResolutionDue ? new Date(ticket.slaResolutionDue).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '24 Hours'}
                  </span>
                </div>
              </div>
            </div>

            {/* Support Contract & Hours Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Support Plan & Time
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    ticket?.customer?.planMetrics?.isWithinWorkingHours
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {ticket?.customer?.planMetrics?.isWithinWorkingHours ? 'Open Now' : 'Off Hours'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {ticket?.customer?.planMetrics?.planName || ticket?.customer?.supportPlanName || 'Ad-hoc 4-Hour Pack'}
                  </span>
                  <span className="font-mono text-slate-500">${ticket?.customer?.hourlyRate || 85}/h</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Window:{' '}
                  {ticket?.customer?.workingHoursWindow === '24X7'
                    ? '24/7/365'
                    : ticket?.customer?.workingHoursWindow === 'MON_SAT_8AM_8PM'
                    ? 'Mon-Sat 8am-8pm'
                    : 'Mon-Fri 9am-6pm'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-slate-700 dark:text-slate-300">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">On This Ticket</span>
                  <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {ticket?.totalTimeHours || 0} hrs
                  </span>
                </div>
                <div
                  className={`p-2 rounded-lg border ${
                    ticket?.customer?.planMetrics?.isDepleted
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                      : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Client Balance</span>
                  <span
                    className={`font-bold font-mono ${
                      ticket?.customer?.planMetrics?.isDepleted
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {ticket?.customer?.planMetrics?.isDepleted
                      ? `-${ticket.customer.planMetrics.overageHours}h`
                      : `${ticket?.customer?.planMetrics?.remainingHours ?? 0}h`}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Profile Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-3 shadow-sm">
              <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                <span>Customer Profile</span>
                {ticket?.customer?.isVip && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                    VIP Customer
                  </span>
                )}
              </div>
              <div className="space-y-2 text-slate-700 dark:text-slate-300 text-xs">
                <div className="font-bold text-slate-900 dark:text-white text-sm">{ticket?.customer?.name}</div>
                {ticket?.customer?.company && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{ticket.customer.company}</span>
                  </div>
                )}
                {ticket?.customer?.email && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{ticket.customer.email}</span>
                  </div>
                )}
                {ticket?.customer?.phone && (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>{ticket.customer.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Details Display (if already resolved) */}
            {ticket?.status === 'RESOLVED' && ticket.resolutionNotes && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resolution Recorded</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300">{ticket.resolutionNotes}</p>
                <span className="text-[10px] text-slate-500">
                  Resolved at {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resolution Note Prompt Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Resolve Ticket #{ticket?.ticketNumber}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide resolution details and steps taken. This will automatically notify the customer via their channel ({ticket?.channel}).
            </p>
            <textarea
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g., Reset credentials in Active Directory, cleared VPN routing table, verified customer connection successfully."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-3 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={submitResolution}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Confirm & Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
