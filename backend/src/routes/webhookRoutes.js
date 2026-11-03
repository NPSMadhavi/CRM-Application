import express from 'express';
import {
  verifyWhatsApp,
  handleWhatsApp,
  handleEmail,
  simulateIncoming,
  getWebhookLogs
} from '../controllers/webhookController.js';

const router = express.Router();

// WhatsApp Cloud API Webhook
router.get('/whatsapp', verifyWhatsApp);
router.post('/whatsapp', handleWhatsApp);

// Inbound Email Webhook
router.post('/email', handleEmail);

// Simulation & Testing endpoint (callable from dashboard/admin UI)
router.post('/simulate', simulateIncoming);

// Inspection logs
router.get('/logs', getWebhookLogs);

export default router;

