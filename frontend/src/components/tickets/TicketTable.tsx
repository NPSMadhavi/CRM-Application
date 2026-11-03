import React from 'react';
import { Ticket } from '../../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ChannelBadge } from './ChannelBadge';
import { UserCheck, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TicketTableProps {
  tickets: Ticket[];
  isLoading: boolean;
  onSelectTicket: (ticket: Ticket) => void;
  onAssignToMe: (ticketId: string, e: React.MouseEvent) => void;
}

export const TicketTable: React.FC<TicketTableProps> = ({
  tickets,
  isLoading,
  onSelectTicket,
  onAssignToMe
}) => {
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading tickets...</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No tickets matching current filters</p>
        <p className="text-xs text-slate-500 mt-1">Try resetting search or filters, or simulate an inbound message.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4">Ticket</th>
              <th className="py-3.5 px-4">Customer & Issue</th>
              <th className="py-3.5 px-4">Channel</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Priority</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Assignee</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {tickets.map((ticket) => {
              const isAssignedToMe = ticket.assignedToId === user?.id;

              return (
                <tr
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  {/* Ticket Number & AI indicator */}
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{ticket.ticketNumber}</span>
                      {ticket.aiExtracted && (
                        <span title="AI Extracted & Classified" className="text-purple-600 dark:text-purple-400">
                          <Sparkles className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Customer & Issue Title */}
                  <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                      {ticket.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{ticket.customer?.name}</span>
                      {ticket.customer?.company && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 dark:text-slate-500">{ticket.customer.company}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="text-slate-400 dark:text-slate-500">
                        {new Date(ticket.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </td>

                  {/* Channel */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <ChannelBadge channel={ticket.channel} />
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">
                      {ticket.category?.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <PriorityBadge priority={ticket.priority} />
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={ticket.status} size="sm" />
                  </td>

                  {/* Assignee */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {ticket.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={ticket.assignedTo.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={ticket.assignedTo.fullName}
                          className="w-6 h-6 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                        />
                        <span className={`text-xs ${isAssignedToMe ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                          {isAssignedToMe ? 'You' : ticket.assignedTo.fullName}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => onAssignToMe(ticket.id, e)}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 transition-colors"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Take Ticket</span>
                      </button>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center text-xs font-semibold text-slate-500 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-400 gap-1 transition-colors">
                      View
                      <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
