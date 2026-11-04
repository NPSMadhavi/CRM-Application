import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  streamNotifications
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// SSE stream: handles its own auth via Bearer or query token
router.get('/stream', streamNotifications);

// Authenticated notification endpoints
router.use(authenticate);
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
