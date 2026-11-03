import React from 'react';
import { Channel } from '../../types';
import { MessageSquare, Mail, Globe } from 'lucide-react';

interface ChannelBadgeProps {
  channel: Channel;
}

export const ChannelBadge: React.FC<ChannelBadgeProps> = ({ channel }) => {
  if (channel === 'WHATSAPP') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
        <MessageSquare className="w-3 h-3 text-emerald-400" />
        WhatsApp
      </span>
    );
  }

  if (channel === 'EMAIL') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
        <Mail className="w-3 h-3 text-blue-400" />
        Email
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
      <Globe className="w-3 h-3 text-purple-400" />
      Portal
    </span>
  );
};

