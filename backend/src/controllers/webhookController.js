import { verifyWebhook, parseIncomingWhatsAppPayload } from '../services/whatsappService.js';
import { parseIncomingEmailPayload } from '../services/emailService.js';
import { processIncomingMessage } from '../services/ticketService.js';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

/**
 * WhatsApp Webhook Challenge Verification (GET)
 */
export function verifyWhatsApp(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verified = verifyWebhook(mode, token, challenge);
  if (verified) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Verification token mismatch');
}

/**
 * Handle incoming WhatsApp Webhook (POST)
 */
export async function handleWhatsApp(req, res, next) {
  try {
    const rawPayload = req.body;
    logger.info('[Webhook] Received WhatsApp event payload');

    const parsed = parseIncomingWhatsAppPayload(rawPayload);

    // If payload is a delivery receipt, read status, or empty, return 200 immediately
    if (!parsed) {
      return res.status(200).json({ status: 'ignored_non_message_event' });
    }

    // Process message
    const result = await processIncomingMessage(parsed);

    // Record webhook log
    await prisma.webhookLog.create({
      data: {
        channel: 'WHATSAPP',
        eventType: 'messages',
        payload: JSON.stringify(rawPayload),
        status: result.isDuplicate ? 'DUPLICATE_IGNORED' : 'SUCCESS',
        ticketId: result.ticket?.id || null
      }
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error('[Webhook WhatsApp Error]', error);

    try {
      await prisma.webhookLog.create({
        data: {
          channel: 'WHATSAPP',
          eventType: 'error',
          payload: JSON.stringify(req.body || {}),
          status: 'FAILED',
          errorMessage: error.message
        }
      });
    } catch (_) {}

    // WhatsApp expects 200 OK so it doesn't retry indefinitely
    return res.status(200).json({ success: false, error: error.message });
  }
}

/**
 * Handle incoming Email Webhook (POST)
 */
export async function handleEmail(req, res, next) {
  try {
    const rawPayload = req.body;
    logger.info('[Webhook] Received Email event payload');

    const parsed = parseIncomingEmailPayload(rawPayload);
    if (!parsed) {
      return res.status(400).json({ success: false, message: 'Invalid email payload structure' });
    }

    const result = await processIncomingMessage(parsed);

    await prisma.webhookLog.create({
      data: {
        channel: 'EMAIL',
        eventType: 'inbound_email',
        payload: JSON.stringify(rawPayload),
        status: result.isDuplicate ? 'DUPLICATE_IGNORED' : 'SUCCESS',
        ticketId: result.ticket?.id || null
      }
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error('[Webhook Email Error]', error);

    try {
      await prisma.webhookLog.create({
        data: {
          channel: 'EMAIL',
          eventType: 'error',
          payload: JSON.stringify(req.body || {}),
          status: 'FAILED',
          errorMessage: error.message
        }
      });
    } catch (_) {}

    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Simulator Endpoint: Test incoming WhatsApp or Email message from Admin UI
 */
export async function simulateIncoming(req, res, next) {
  try {
    const {
      channel = 'WHATSAPP', // 'WHATSAPP' or 'EMAIL'
      senderName,
      senderEmail,
      senderPhone,
      subject,
      messageText,
      messageId
    } = req.body;

    if (!messageText || !messageText.trim()) {
      return res.status(400).json({ success: false, message: 'messageText is required' });
    }

    const generatedMsgId = messageId || `${channel.toLowerCase()}_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const result = await processIncomingMessage({
      channel,
      messageId: generatedMsgId,
      senderName: senderName || (channel === 'WHATSAPP' ? 'Alex Rivera' : 'Elena Rostova'),
      senderEmail: senderEmail || (channel === 'EMAIL' ? 'elena.r@enterprise.com' : null),
      senderPhone: senderPhone || (channel === 'WHATSAPP' ? '+15559876543' : null),
      subject: subject || (channel === 'EMAIL' ? 'Urgent IT Issue' : undefined),
      messageText: messageText.trim()
    });

    res.status(200).json({
      success: true,
      simulated: true,
      channel,
      messageId: generatedMsgId,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get recent webhook logs
 */
export async function getWebhookLogs(req, res, next) {
  try {
    const logs = await prisma.webhookLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

