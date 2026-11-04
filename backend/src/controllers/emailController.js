import { IncomingEmailService } from '../services/incoming-email.service.js';
import { sendEmail, verifySmtpConnection } from '../services/emailService.js';
import { prisma } from '../config/db.js';

export async function syncEmails(req, res, next) {
  try {
    const result = await IncomingEmailService.checkInboxOnce();
    res.json({
      success: true,
      message: `Email sync completed. Processed ${result.processed} new email(s).`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getEmailStatus(req, res, next) {
  try {
    const integration = await prisma.integration.findUnique({
      where: { name: 'GMAIL_IMAP' }
    });

    const isSmtpWorking = await verifySmtpConnection();
    const isImapListening = IncomingEmailService.isListening;

    res.json({
      success: true,
      data: {
        imap: {
          isListening: isImapListening,
          host: process.env.IMAP_HOST,
          port: process.env.IMAP_PORT,
          user: process.env.IMAP_USER || process.env.SUPPORT_EMAIL,
          tls: process.env.IMAP_TLS === 'true'
        },
        smtp: {
          verified: isSmtpWorking,
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER || process.env.SUPPORT_EMAIL
        },
        watermark: integration?.config || null
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function testOutgoingEmail(req, res, next) {
  try {
    const { toEmail } = req.body;
    const recipient = toEmail || req.user?.email || process.env.SUPPORT_EMAIL;

    const result = await sendEmail({
      to: recipient,
      subject: `[CRM Test] Gmail SMTP Verification - ${new Date().toLocaleString()}`,
      text: 'This is a test email sent from Customer IT Support CRM via Gmail SMTP.\nIf you received this, your SMTP settings are configured properly.'
    });

    res.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error
    });
  } catch (err) {
    next(err);
  }
}
