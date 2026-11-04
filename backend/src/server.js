import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db.js';
import { initSocket } from './config/socket.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import supportPlanRoutes from './routes/supportPlanRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import emailRoutes from './routes/emailRoutes.js';

import { verifySmtpConnection } from './services/emailService.js';
import { IncomingEmailService } from './services/incoming-email.service.js';
import { RealtimeNotificationService } from './services/realtime-notification.service.js';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'support-ticket-crm-backend'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/support-plans', supportPlanRoutes);

// Notifications (both /api/notifications and /api/v1/notifications)
app.use('/api/notifications', notificationRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Email Sync & Status (both /api/email and /api/v1/email)
app.use('/api/email', emailRoutes);
app.use('/api/v1/email', emailRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '5000', 10);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', async () => {
    await connectDB();
    logger.info(`=======================================================`);
    logger.info(` Customer IT Support CRM Backend running on port ${PORT}`);
    logger.info(` Health Check: http://localhost:${PORT}/api/health`);
    logger.info(` Notification Stream: http://localhost:${PORT}/api/v1/notifications/stream`);
    logger.info(`=======================================================`);

    // Verify SMTP Connection
    await verifySmtpConnection();

    // Start Gmail IMAP IDLE Listener
    if (process.env.EMAIL_INBOUND_ENABLED === 'true') {
      IncomingEmailService.startListener().catch((err) => {
        logger.error(`[GMAIL IMAP] Startup error: ${err?.message}`);
      });
    }
  });
}

// Graceful process shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down server gracefully...');
  await IncomingEmailService.stopListener();
  RealtimeNotificationService.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default app;
