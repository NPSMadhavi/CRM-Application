import { logger } from '../utils/logger.js';
import { prisma } from '../config/db.js';

/**
 * RealtimeNotificationService (SSE)
 * Maintains active Server-Sent Events client streams per authenticated user.
 * Supports multiple simultaneous browser tabs, heartbeat keepalive, and clean disconnection.
 */
export class RealtimeNotificationService {
  // Map of userId -> Set of active Response objects
  private_userClients = new Map();
  static userClients = new Map();
  static heartbeatTimer = null;

  /**
   * Initializes SSE heartbeat keep-alive (every 25s)
   */
  static init() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 25000);
  }

  /**
   * Clean shutdown of SSE service
   */
  static shutdown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const [userId, clientSet] of this.userClients.entries()) {
      for (const res of clientSet) {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
    this.userClients.clear();
    logger.info('[Realtime SSE] Notification service shutdown cleanly');
  }

  /**
   * Returns count of active SSE client connections across all users
   */
  static getActiveConnectionsCount() {
    let count = 0;
    for (const clientSet of this.userClients.values()) {
      count += clientSet.size;
    }
    return count;
  }

  /**
   * Registers a client SSE connection for an authenticated user
   */
  static addClient(userId, res) {
    this.init();

    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    const clientSet = this.userClients.get(userId);
    clientSet.add(res);

    logger.info(`[Realtime SSE] User ${userId} connected. Total tabs for user: ${clientSet.size}`);

    // Send initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', userId, timestamp: new Date().toISOString() })}\n\n`);

    const cleanup = () => {
      const currentSet = this.userClients.get(userId);
      if (currentSet) {
        currentSet.delete(res);
        if (currentSet.size === 0) {
          this.userClients.delete(userId);
        }
      }
      logger.info(`[Realtime SSE] User ${userId} disconnected. Remaining tabs: ${currentSet ? currentSet.size : 0}`);
    };

    return cleanup;
  }

  /**
   * Pushes a notification event to all active sessions/tabs of a specific user
   */
  static sendNotificationToUser(userId, notification) {
    const clientSet = this.userClients.get(userId);
    if (!clientSet || clientSet.size === 0) {
      return;
    }

    const payload = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;

    for (const res of clientSet) {
      try {
        res.write(payload);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      } catch (err) {
        logger.warn(`[Realtime SSE] Failed writing to client for user ${userId}: ${err?.message}`);
      }
    }
    logger.info(`[Realtime SSE] Dispatched notification ${notification.type} to user ${userId} across ${clientSet.size} active tab(s)`);
  }

  /**
   * Dispatches a notification to all active Admins
   */
  static async broadcastToAdmins(notification) {
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true }
      });

      for (const admin of admins) {
        this.sendNotificationToUser(admin.id, {
          ...notification,
          userId: admin.id
        });
      }
    } catch (err) {
      logger.warn(`[Realtime SSE] Failed to broadcast notification to admins: ${err?.message}`);
    }
  }

  /**
   * Dispatches a notification to all active users (Admins & Agents)
   */
  static async broadcastToAll(notification) {
    try {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      for (const u of users) {
        this.sendNotificationToUser(u.id, {
          ...notification,
          userId: u.id
        });
      }
    } catch (err) {
      logger.warn(`[Realtime SSE] Failed to broadcast notification to all: ${err?.message}`);
    }
  }

  /**
   * Sends heartbeat ping to prevent connection timeouts across firewalls/proxies
   */
  static sendHeartbeat() {
    const comment = `: ping ${Date.now()}\n\n`;
    for (const [userId, clientSet] of this.userClients.entries()) {
      for (const res of clientSet) {
        try {
          res.write(comment);
        } catch {
          clientSet.delete(res);
        }
      }
      if (clientSet.size === 0) {
        this.userClients.delete(userId);
      }
    }
  }
}
