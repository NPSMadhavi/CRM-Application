import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const isMock = !process.env.SMTP_USER || process.env.SMTP_USER === 'support@example.com' || process.env.SMTP_HOST === 'localhost';

    if (isMock) {
      // Use JSON transport for mock/development testing without an external mail server
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      logger.info('[Email Service] Configured in Development/Mock JSON transport mode');
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      logger.info(`[Email Service] Configured with SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    }
  }
  return transporter;
}

/**
 * Send email (acknowledgement or agent reply)
 */
export async function sendEmail({ to, subject, text, html, inReplyTo, references }) {
  try {
    const mailer = getTransporter();
    const fromAddress = process.env.SMTP_FROM || 'IT Support Desk <support@example.com>';

    logger.info(`[Email Outbound] To: ${to} | Subject: "${subject}"`);

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html: html || `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">${text.replace(/\n/g, '<br/>')}</div>`,
      inReplyTo,
      references
    };

    const info = await mailer.sendMail(mailOptions);
    logger.info(`[Email Outbound] Sent successfully. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('[Email Outbound Error]', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Parse incoming webhook email payload (supports common providers: Mailgun, SendGrid, Postmark, and raw JSON)
 */
export function parseIncomingEmailPayload(body) {
  try {
    // 1. SendGrid Inbound Parse format
    if (body.from && (body.text || body.html)) {
      const fromRaw = body.from;
      let senderEmail = fromRaw;
      let senderName = 'Support Customer';

      const emailMatch = fromRaw.match(/<([^>]+)>/);
      if (emailMatch) {
        senderEmail = emailMatch[1];
        senderName = fromRaw.replace(/<[^>]+>/, '').trim().replace(/['"]/g, '');
      }

      const messageId = body.headers?.match(/Message-ID:\s*<([^>]+)>/i)?.[1] ||
                        body['message-id'] ||
                        `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      return {
        channel: 'EMAIL',
        messageId,
        senderEmail,
        senderName: senderName || 'Support Customer',
        senderPhone: null,
        subject: body.subject || 'Support Request',
        messageText: body.text || body.html?.replace(/<[^>]+>/g, ' ') || '',
        attachments: [],
        timestamp: new Date()
      };
    }

    // 2. Direct clean CRM JSON payload
    if (body.senderEmail && (body.messageText || body.body)) {
      return {
        channel: 'EMAIL',
        messageId: body.messageId || `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        senderEmail: body.senderEmail,
        senderName: body.senderName || 'Customer',
        senderPhone: body.senderPhone || null,
        subject: body.subject || 'IT Support Ticket',
        messageText: body.messageText || body.body,
        attachments: body.attachments || [],
        timestamp: new Date()
      };
    }

    return null;
  } catch (err) {
    logger.error('[Email Service] Failed to parse email payload:', err.message);
    return null;
  }
}

