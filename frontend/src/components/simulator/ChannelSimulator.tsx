import React, { useState } from 'react';
import api from '../../services/api';
import {
  Radio,
  Send,
  MessageSquare,
  Mail,
  Sparkles,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

interface ChannelSimulatorProps {
  onTicketCreated?: () => void;
}

export const ChannelSimulator: React.FC<ChannelSimulatorProps> = ({ onTicketCreated }) => {
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [senderName, setSenderName] = useState('Alex Rivera');
  const [senderPhone, setSenderPhone] = useState('+15559876543');
  const [senderEmail, setSenderEmail] = useState('alex.rivera@enterprise.com');
  const [subject, setSubject] = useState('Emergency: Network VPN dropping repeatedly');
  const [messageText, setMessageText] = useState(
    'Hi Support Desk, my Cisco AnyConnect VPN disconnects every few minutes when I connect from home. I have tried restarting my machine but error 412 still occurs. Please help ASAP!'
  );
  const [messageId, setMessageId] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const presets = [
    {
      title: '🚨 Critical VPN / Network Outage (WhatsApp)',
      channel: 'WHATSAPP' as const,
      name: 'Michael Scott',
      phone: '+15551239999',
      email: 'michael.s@dundermifflin.com',
      subject: '',
      text: 'URGENT: Entire regional office cannot connect to company VPN or access internal customer files. We have 20 reps sitting idle!'
    },
    {
      title: '💻 Broken Hardware Laptop Display (Email)',
      channel: 'EMAIL' as const,
      name: 'Jordan Belfort',
      phone: '+15554320000',
      email: 'jordan.b@stratton.io',
      subject: 'Hardware failure: Lenovo ThinkPad screen blinking',
      text: 'Good morning IT team, my ThinkPad P1 Gen 5 monitor screen started flickering aggressively with vertical green artifacts. I need a replacement or loaner laptop for an executive meeting this afternoon.'
    },
    {
      title: '🔑 Active Directory / 2FA Lockout (WhatsApp)',
      channel: 'WHATSAPP' as const,
      name: 'Sarah Connor',
      phone: '+15557778888',
      email: 'sarah.c@cyberdyne.org',
      subject: '',
      text: 'Hello, my account got locked out after 3 wrong password attempts on the SSO portal. Could an admin unlock it and trigger an authenticator reset? My phone is +15557778888.'
    },
    {
      title: '♻️ Deduplication Test (Duplicate Msg ID)',
      channel: 'WHATSAPP' as const,
      name: 'David Miller',
      phone: '+15551234567',
      email: 'david.m@apextech.com',
      subject: '',
      text: 'Testing deduplication: Sending duplicate message with fixed ID to verify no duplicate ticket is created.',
      fixedId: 'dedup_test_fixed_msg_id_1001'
    }
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setChannel(preset.channel);
    setSenderName(preset.name);
    setSenderPhone(preset.phone);
    setSenderEmail(preset.email);
    setSubject(preset.subject);
    setMessageText(preset.text);
    setMessageId(preset.fixedId || '');
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      setIsSimulating(true);
      setSimulationResult(null);

      const res = await api.post('/webhooks/simulate', {
        channel,
        senderName: senderName.trim(),
        senderPhone: channel === 'WHATSAPP' ? senderPhone.trim() : null,
        senderEmail: channel === 'EMAIL' ? senderEmail.trim() : null,
        subject: channel === 'EMAIL' ? subject.trim() : undefined,
        messageText: messageText.trim(),
        messageId: messageId.trim() || undefined
      });

      if (res.data.success) {
        setSimulationResult(res.data);
        if (onTicketCreated) onTicketCreated();
      }
    } catch (err: any) {
      console.error('Simulation failed', err);
      setSimulationResult({
        success: false,
        error: err.response?.data?.message || err.message
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-100 via-indigo-50 to-white dark:from-purple-950/60 dark:via-indigo-950/40 dark:to-slate-900 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 dark:border-purple-500/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Inbound Channel Simulator & AI Verification
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Simulate live customer messages coming via WhatsApp Business Cloud API or inbound Email webhooks.
              Observe real-time AI entity detection, deduplication protection, auto-acknowledgement dispatch, and Socket.IO dashboard broadcast.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2.5">
          Quick Demo Scenarios
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(p)}
              className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition-all text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium shadow-sm"
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* Simulator Form & Live Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <form
          onSubmit={handleSimulate}
          className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="font-bold text-sm text-slate-900 dark:text-white">Simulate Message Payload</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChannel('WHATSAPP')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  channel === 'WHATSAPP'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel('EMAIL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  channel === 'EMAIL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Customer Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {channel === 'WHATSAPP' ? (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">WhatsApp Phone</label>
                <input
                  type="text"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Customer Email</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {channel === 'EMAIL' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Issue description"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Raw Message Body (Processed by AI Engine)
            </label>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Enter customer message here..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Custom Message ID (Optional - for Deduplication testing)
            </label>
            <input
              type="text"
              value={messageId}
              onChange={(e) => setMessageId(e.target.value)}
              placeholder="Leave empty for auto-generated unique ID"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 font-mono rounded-xl p-2 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSimulating || !messageText.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing AI Entity Extraction...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Simulate Inbound Message</span>
              </>
            )}
          </button>
        </form>

        {/* Live Result View */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Live Execution Response</span>
              {simulationResult?.isDuplicate && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Deduplication Triggered
                </span>
              )}
              {simulationResult?.isNewTicket && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  New Ticket Created
                </span>
              )}
            </div>

            {simulationResult ? (
              <div className="space-y-4">
                {simulationResult.isDuplicate ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Duplicate Message Prevented
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      Message ID already exists. Skipped duplicate ticket creation and mapped to existing Ticket #{simulationResult.ticket?.ticketNumber}.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Ticket Generated Badge */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                          Generated Ticket
                        </span>
                        <div className="text-lg font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                          #{simulationResult.ticket?.ticketNumber}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                          {simulationResult.ticket?.category}
                        </span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                          Priority: {simulationResult.ticket?.priority}
                        </div>
                      </div>
                    </div>

                    {/* AI Extraction Details */}
                    <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>AI Extraction Insights</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Customer: </span>
                          <span className="font-semibold">{simulationResult.ticket?.customer?.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Sentiment: </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{simulationResult.ticket?.sentiment}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">AI Confidence: </span>
                          <span className="font-semibold">{Math.round((simulationResult.ticket?.aiConfidence || 0.9) * 100)}%</span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500">Channel: </span>
                          <span className="font-semibold">{simulationResult.ticket?.channel}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-purple-200 dark:border-purple-500/20 text-slate-600 dark:text-slate-300 italic">
                        "{simulationResult.ticket?.aiSummary}"
                      </div>
                    </div>

                    {/* Auto-Acknowledgement preview */}
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Automatic Customer Acknowledgement Sent (Feature 3)</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mt-1">
                        "We have received your support request. Your Ticket ID is #{simulationResult.ticket?.ticketNumber}. Our support team will contact you within a few hours."
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs space-y-2">
                <Sparkles className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Ready to simulate incoming channel traffic</p>
                <p className="text-[11px]">Select a preset or enter details on the left, then click Simulate.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Webhook Endpoint: /api/webhooks/whatsapp & /api/webhooks/email</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Socket.IO Broadcast: Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
