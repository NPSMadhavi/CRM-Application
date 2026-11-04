import { prisma } from '../config/db.js';
import { RealtimeNotificationService } from '../services/realtime-notification.service.js';
import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

export async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {
      OR: [
        { recipientId: req.user.id },
        { recipientId: null }
      ]
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          ticket: {
            select: { id: true, ticketNumber: true, title: true, status: true, priority: true }
          }
        }
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await prisma.notification.count({
      where: {
        OR: [
          { recipientId: req.user.id },
          { recipientId: null }
        ],
        isRead: false
      }
    });

    res.json({ success: true, count, unreadCount: count });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({ success: true, notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        OR: [
          { recipientId: req.user.id },
          { recipientId: null }
        ],
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({ success: true, count: result.count });
  } catch (err) {
    next(err);
  }
}

/**
 * SSE Stream endpoint
 * GET /api/notifications/stream
 * GET /api/v1/notifications/stream
 */
export async function streamNotifications(req, res) {
  let user = req.user;

  // Support query token for native EventSource
  if (!user && req.query.token) {
    try {
      const decoded = verifyToken(req.query.token);
      if (decoded && decoded.id) {
        user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, email: true, fullName: true, role: true, isActive: true }
        });
      }
    } catch (tokenErr) {
      logger.warn(`[SSE Stream] Token validation failed: ${tokenErr?.message}`);
    }
  }

  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Authentication required for notification stream' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  // Flush headers
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const cleanup = RealtimeNotificationService.addClient(user.id, res);

  req.on('close', () => {
    cleanup();
  });
}
