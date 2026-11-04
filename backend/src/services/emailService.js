import nodemailer from 'nodemailer';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

let transporter = null;

export function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER || process.env.SUPPORT_EMAIL || 'chandra2001ks@gmail.com';
   const pass = process.env.SMTP_PASS;

    if (pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        }
      });
      logger.info(`[Email Service] Configured Gmail SMTP: ${host}:${port} (secure: ${secure})`);
    } else {
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      logger.info('[Email Service] Configured in Development/Mock JSON transport mode');
    }
  }
  return transporter;
}

/**
 * Startup helper to verify SMTP connection
 */
export async function verifySmtpConnection() {
  try {
    const mailer = getTransporter();
    if (mailer.verify) {
      await mailer.verify();
      logger.info('✓ Gmail SMTP connection: CONNECTED and verified');
      return true;
    }
    return true;
  } catch (error) {
    logger.error(`✗ Gmail SMTP connection failed: ${error?.message || error}`);
    return false;
  }
}

/**
 * Send email (acknowledgement or agent reply) with strict threading headers and DB tracking
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  inReplyTo,
  references,
  ticketId,
  ticketMessageId
}) {
  const fromName = process.env.SMTP_FROM_NAME || 'Enterprise CRM Support';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'chandra2001ks@gmail.com';
  const fromAddress = `"${fromName}" <${fromEmail}>`;

  // Generate standardized unique Message-ID
  const domain = fromEmail.includes('@') ? fromEmail.split('@')[1] : 'gmail.com';
  const generatedMessageId = `<crm-out-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@${domain}>`;

  logger.info(`[Email Outbound] Preparing email to: ${to} | Subject: "${subject}" | In-Reply-To: ${inReplyTo || 'none'}`);

  // Create EmailMessage record in PENDING status
  let emailRecord = null;
  try {
    emailRecord = await prisma.emailMessage.create({
      data: {
        ticketId: ticketId || null,
        ticketMessageId: ticketMessageId || null,
        direction: 'OUTBOUND',
        fromAddress,
        toAddress: to,
        senderEmail: fromEmail,
        recipientEmail: to,
        subject,
        bodyText: text || '',
        bodyHtml: html || (text ? `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">${text.replace(/\n/g, '<br/>')}</div>` : ''),
        messageId: generatedMessageId,
        providerMessageId: generatedMessageId,
        inReplyTo: inReplyTo || null,
        references: references || null,
        status: 'PENDING'
      }
    });
  } catch (dbErr) {
    logger.warn(`[Email Outbound] Failed to create pending EmailMessage: ${dbErr?.message}`);
  }

  try {
    const mailer = getTransporter();

    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html: html || (text ? `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">${text.replace(/\n/g, '<br/>')}</div>` : ''),
      messageId: generatedMessageId,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined
    };

    const info = await mailer.sendMail(mailOptions);
    const actualMessageId = info.messageId || generatedMessageId;

    logger.info(`[Email Outbound] Sent successfully. MessageId: ${actualMessageId}`);

    if (emailRecord) {
      await prisma.emailMessage.update({
        where: { id: emailRecord.id },
        data: {
          status: 'SENT',
          providerMessageId: actualMessageId,
          sentAt: new Date()
        }
      });
    }

    return { success: true, messageId: actualMessageId, emailRecordId: emailRecord?.id };
  } catch (error) {
    logger.error(`[Email Outbound Error] ${error?.message || error}`);

    if (emailRecord) {
      await prisma.emailMessage.update({
        where: { id: emailRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error?.message || 'SMTP delivery failed',
          failureReason: error?.message || 'SMTP delivery failed'
        }
      });
    }

    return { success: false, error: error?.message || 'Failed to send email' };
  }
}

/**
 * Parse incoming webhook email payload (supports SendGrid, Mailgun, Postmark, and raw CRM JSON)
 */
export function parseIncomingEmailPayload(body) {
  try {
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
