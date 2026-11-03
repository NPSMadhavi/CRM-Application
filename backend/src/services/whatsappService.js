import axios from 'axios';
import { logger } from '../utils/logger.js';

const WA_API_URL = 'https://graph.facebook.com';
const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

/**
 * Verify Webhook GET request from Meta
 */
export function verifyWebhook(mode, token, challenge) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'crm_wa_verify_token_secure_xyz';

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[WhatsApp] Webhook challenge verified successfully');
    return challenge;
  }
  logger.warn('[WhatsApp] Webhook verification failed. Token mismatch.');
  return null;
}

/**
 * Parse incoming WhatsApp Webhook payload
 */
export function parseIncomingWhatsAppPayload(body) {
  try {
    if (!body || !body.entry || !body.entry[0]) return null;

    const entry = body.entry[0];
    const changes = entry.changes && entry.changes[0];
    if (!changes || !changes.value) return null;

    const value = changes.value;
    const messages = value.messages;
    if (!messages || messages.length === 0) return null;

    const message = messages[0];
    const contacts = value.contacts && value.contacts[0];

    const senderPhone = message.from;
    const senderName = contacts?.profile?.name || `Customer +${senderPhone}`;
    const messageId = message.id;
    const timestamp = message.timestamp ? new Date(parseInt(message.timestamp, 10) * 1000) : new Date();

    let messageText = '';
    let attachments = [];

    if (message.type === 'text') {
      messageText = message.text?.body || '';
    } else if (message.type === 'image') {
      messageText = message.image?.caption || '[Image received via WhatsApp]';
      attachments.push({ type: 'image', id: message.image?.id, mime_type: message.image?.mime_type });
    } else if (message.type === 'document') {
      messageText = message.document?.caption || `[Document: ${message.document?.filename || 'File'}]`;
      attachments.push({ type: 'document', id: message.document?.id, filename: message.document?.filename });
    } else if (message.type === 'audio' || message.type === 'voice') {
      messageText = '[Voice note received via WhatsApp]';
    } else {
      messageText = `[Received WhatsApp message of type: ${message.type}]`;
    }

    return {
      channel: 'WHATSAPP',
      messageId,
      senderPhone,
      senderName,
      senderEmail: null,
      messageText,
      attachments,
      timestamp,
      raw: body
    };
  } catch (err) {
    logger.error('[WhatsApp] Failed to parse payload:', err.message);
    return null;
  }
}

/**
 * Send outbound WhatsApp message to customer
 */
export async function sendWhatsAppMessage(recipientPhone, text) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Clean phone number (strip spaces, dashes, leading + for meta API)
  const cleanPhone = String(recipientPhone).replace(/[^0-9]/g, '');

  logger.info(`[WhatsApp Outbound] To: ${cleanPhone} | Message: "${text.substring(0, 60)}..."`);

  // If token is missing or dummy/mock, simulate sending and return success
  if (!token || token.startsWith('mock_') || token.startsWith('your_') || !phoneId || phoneId.startsWith('your_')) {
    logger.info(`[WhatsApp Outbound MOCK] Simulated message sent successfully to +${cleanPhone}`);
    return {
      success: true,
      simulated: true,
      messageId: `wamid.MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    };
  }

  try {
    const url = `${WA_API_URL}/${WA_API_VERSION}/${phoneId}/messages`;
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const messageId = response.data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    logger.error('[WhatsApp Outbound Error]', error.response?.data || error.message);
    // Don't crash workflow if outbound fails in non-prod
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

