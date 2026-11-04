import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { RealtimeNotificationService } from './realtime-notification.service.js';
import { emitToAll } from '../config/socket.js';

export class NotificationService {
  /**
   * Persists a notification to PostgreSQL and dispatches via SSE & Socket.IO
   */
  static async createAndDispatch({ recipientId, ticketId, title, message, type, link, metadata }) {
    try {
      const record = await prisma.notification.create({
        data: {
          recipientId: recipientId || null,
          ticketId: ticketId || null,
          title,
          message,
          type: type || 'TICKET_CREATED',
          link: link || null,
          isRead: false
        }
      });

      const payload = {
        id: record.id,
        userId: recipientId || null,
        type: record.type,
        title: record.title,
        message: record.message,
        ticketId: record.ticketId || null,
        ticketNumber: metadata?.ticketNumber || null,
        customerName: metadata?.customerName || null,
        subject: metadata?.subject || null,
        channel: metadata?.channel || 'EMAIL',
        priority: metadata?.priority || 'MEDIUM',
        description: metadata?.description || null,
        link: record.link,
        isRead: record.isRead,
        createdAt: record.createdAt.toISOString()
      };

      if (recipientId) {
        RealtimeNotificationService.sendNotificationToUser(recipientId, payload);
      } else {
        await RealtimeNotificationService.broadcastToAdmins(payload);
      }

      // Also trigger socket for instantaneous delivery across all active tabs/sockets
      emitToAll('notification:new', payload);

      return record;
    } catch (err) {
      logger.error(`[NotificationService] Error creating notification: ${err?.message}`);
      return null;
    }
  }

  /**
   * Notify admins and agents of a newly created email ticket
   */
  static async notifyNewEmailTicket(ticket, customer, emailMessage) {
    try {
      const staffUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, email: true, role: true }
      });

      const title = `New Email Ticket #${ticket.ticketNumber}`;
      const message = `${customer?.name || 'Customer'}: ${ticket.title}`;
      const descSnippet = ticket.description ? ticket.description.trim().substring(0, 160) : '';

      const metadata = {
        ticketNumber: ticket.ticketNumber,
        customerName: customer?.name || 'Customer',
        subject: ticket.title,
        channel: 'EMAIL',
        priority: ticket.priority || 'MEDIUM',
        description: descSnippet
      };

      for (const staff of staffUsers) {
        await this.createAndDispatch({
          recipientId: staff.id,
          ticketId: ticket.id,
          title,
          message,
          type: 'TICKET_CREATED',
          link: null,
          metadata
        });
      }

      logger.info(`[NotificationService] Dispatched new email ticket notification #${ticket.ticketNumber} to ${staffUsers.length} user(s)`);
    } catch (err) {
      logger.warn(`[NotificationService] Failed to notify new email ticket: ${err?.message}`);
    }
  }

  /**
   * Notify assigned agent (or admins/agents if unassigned) of customer reply
   */
  static async notifyCustomerReply(ticket, customer, replyMessage) {
    try {
      const title = `New Reply on #${ticket.ticketNumber}`;
      const snippet = replyMessage.body ? replyMessage.body.trim().substring(0, 120) : 'New email response received';
      const message = `${customer?.name || 'Customer'}: "${snippet}"`;

      const metadata = {
        ticketNumber: ticket.ticketNumber,
        customerName: customer?.name || 'Customer',
        subject: ticket.title,
        channel: 'EMAIL',
        priority: ticket.priority || 'MEDIUM',
        description: snippet
      };

      if (ticket.assignedToId) {
        await this.createAndDispatch({
          recipientId: ticket.assignedToId,
          ticketId: ticket.id,
          title,
          message,
          type: 'CUSTOMER_REPLY',
          link: null,
          metadata
        });
        logger.info(`[NotificationService] Dispatched customer reply notification for #${ticket.ticketNumber} to assigned agent ${ticket.assignedToId}`);
      } else {
        const staffUsers = await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true }
        });
        for (const staff of staffUsers) {
          await this.createAndDispatch({
            recipientId: staff.id,
            ticketId: ticket.id,
            title,
            message,
            type: 'CUSTOMER_REPLY',
            link: null,
            metadata
          });
        }
        logger.info(`[NotificationService] Dispatched customer reply notification for unassigned #${ticket.ticketNumber} to ${staffUsers.length} user(s)`);
      }
    } catch (err) {
      logger.warn(`[NotificationService] Failed to notify customer reply: ${err?.message}`);
    }
  }

  /**
   * Notify newly assigned agent
   */
  static async notifyTicketAssigned(ticket, agent, actorUser) {
    try {
      if (!agent || !agent.id) return;
      const title = `Ticket #${ticket.ticketNumber} Assigned`;
      const message = `You were assigned ticket: "${ticket.title}" by ${actorUser?.fullName || 'Admin'}`;

      const metadata = {
        ticketNumber: ticket.ticketNumber,
        customerName: ticket.customer?.name || 'Customer',
        subject: ticket.title,
        channel: ticket.channel || 'EMAIL',
        priority: ticket.priority || 'MEDIUM',
        description: message
      };

      await this.createAndDispatch({
        recipientId: agent.id,
        ticketId: ticket.id,
        title,
        message,
        type: 'TICKET_ASSIGNED',
        link: null,
        metadata
      });
    } catch (err) {
      logger.warn(`[NotificationService] Failed to notify ticket assignment: ${err?.message}`);
    }
  }

  /**
   * Notify ticket status change
   */
  static async notifyStatusChanged(ticket, oldStatus, newStatus, actorUser) {
    try {
      let type = 'TICKET_STATUS_CHANGED';
      let title = `Ticket #${ticket.ticketNumber} Status Changed`;

      if (newStatus === 'RESOLVED') {
        type = 'TICKET_RESOLVED';
        title = `Ticket #${ticket.ticketNumber} Resolved`;
      } else if (oldStatus === 'RESOLVED') {
        type = 'TICKET_REOPENED';
        title = `Ticket #${ticket.ticketNumber} Reopened`;
      }

      const message = `Updated from ${oldStatus} to ${newStatus} by ${actorUser?.fullName || 'Agent'}`;

      const targetUserIds = new Set();
      if (ticket.assignedToId) targetUserIds.add(ticket.assignedToId);

      const staffUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      staffUsers.forEach(u => targetUserIds.add(u.id));

      if (actorUser?.id) {
        targetUserIds.delete(actorUser.id);
      }

      const metadata = {
        ticketNumber: ticket.ticketNumber,
        customerName: ticket.customer?.name || 'Customer',
        subject: ticket.title,
        channel: ticket.channel || 'EMAIL',
        priority: ticket.priority || 'MEDIUM',
        description: message
      };

      for (const userId of targetUserIds) {
        await this.createAndDispatch({
          recipientId: userId,
          ticketId: ticket.id,
          title,
          message,
          type,
          link: null,
          metadata
        });
      }
    } catch (err) {
      logger.warn(`[NotificationService] Failed to notify status change: ${err?.message}`);
    }
  }
}
