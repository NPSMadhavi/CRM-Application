import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { prisma } from '../config/db.js';
import { verifySmtpConnection, sendEmail } from '../services/emailService.js';
import { IncomingEmailService } from '../services/incoming-email.service.js';
import { NotificationService } from '../services/notificationService.js';
import { RealtimeNotificationService } from '../services/realtime-notification.service.js';
import { processIncomingMessage } from '../services/ticketService.js';
import { generateToken } from '../utils/jwt.js';
import { generateAgentReplyEmail, generateAcknowledgementEmail } from '../services/email-template.service.js';
import { extractCleanReply } from '../services/email-reply-parser.service.js';

describe('Two-Way Email Integration & Antigravity Real-Time Notification Suite', () => {
  let adminUser;
  let agentUser;
  let adminToken;
  let agentToken;

  beforeAll(async () => {
    // Fetch or create admin and agent for testing
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin.test@crm.local',
          fullName: 'Test Admin',
          role: 'ADMIN',
          passwordHash: 'dummy'
        }
      });
    }
    adminToken = generateToken(adminUser);

    agentUser = await prisma.user.findFirst({ where: { role: 'AGENT' } });
    if (!agentUser) {
      agentUser = await prisma.user.create({
        data: {
          email: 'agent.test@crm.local',
          fullName: 'Test Agent',
          role: 'AGENT',
          passwordHash: 'dummy'
        }
      });
    }
    agentToken = generateToken(agentUser);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // 1. SMTP Tests
  it('1. SMTP Connection Verification: verifySmtpConnection connects successfully to Gmail SMTP', async () => {
    const isConnected = await verifySmtpConnection();
    expect(typeof isConnected).toBe('boolean');
    expect(isConnected).toBe(true);
  });

  it('2. Outgoing Email: sendEmail sends email with threading headers and persists EmailMessage', async () => {
    const testRecipient = 'chandra2001ks@gmail.com';
    const result = await sendEmail({
      to: testRecipient,
      subject: `[TIC-9999] Test Automated Verification ${Date.now()}`,
      text: 'Automated test of outgoing email threading and persistence.',
      inReplyTo: '<orig-msg-123@gmail.com>',
      references: '<orig-msg-123@gmail.com>'
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.emailRecordId).toBeDefined();

    // Verify record in PostgreSQL
    const emailRecord = await prisma.emailMessage.findUnique({
      where: { id: result.emailRecordId }
    });
    expect(emailRecord).toBeDefined();
    expect(emailRecord.direction).toBe('OUTBOUND');
    expect(emailRecord.status).toBe('SENT');
    expect(emailRecord.inReplyTo).toBe('<orig-msg-123@gmail.com>');
  });

  // 2. IMAP Tests & Historical Watermark Protection
  it('3. IMAP Connection Verification: checkConnection connects to Gmail IMAP safely', async () => {
    const isConnected = await IncomingEmailService.checkConnection();
    expect(isConnected).toBe(true);
  });

  it('4. Historical Email Protection: Watermark is restored from PostgreSQL without re-importing old emails', async () => {
    const integration = await prisma.integration.findUnique({
      where: { name: 'GMAIL_IMAP' }
    });
    expect(integration).toBeDefined();
    expect(integration.config).toBeDefined();
    expect(integration.config.lastProcessedUid).toBeGreaterThan(0);
    expect(integration.config.initialBaselineUid).toBeGreaterThan(0);
  });

  // 3. Ticket Creation & Strict Rules
  it('5. Ticket Creation Strict Rules: Incoming email creates ticket with status=OPEN, assignedToId=null, channel=EMAIL', async () => {
    const testEmail = `cust.test.${Date.now()}@example.com`;
    const res = await processIncomingMessage({
      channel: 'EMAIL',
      messageId: `<msg-strict-${Date.now()}@mail.com>`,
      senderEmail: testEmail,
      senderName: 'Strict Test Customer',
      subject: 'Critical server outage in eu-west-1',
      messageText: 'Production database is unreachable'
    });

    expect(res.isNewTicket).toBe(true);
    expect(res.ticket).toBeDefined();
    expect(res.ticket.status).toBe('OPEN');
    expect(res.ticket.assignedToId).toBeNull();
    expect(res.ticket.channel).toBe('EMAIL');

    // Verify automated acknowledgement was sent and persisted
    const ackSysMsg = await prisma.ticketMessage.findFirst({
      where: {
        ticketId: res.ticket.id,
        senderType: 'SYSTEM'
      }
    });
    expect(ackSysMsg).toBeDefined();
    expect(ackSysMsg.body).toContain('Enterprise CRM Support');
    expect(ackSysMsg.body).toContain(res.ticket.ticketNumber);

    // Verify acknowledgement audit log
    const ackAudit = await prisma.ticketAuditLog.findFirst({
      where: {
        ticketId: res.ticket.id,
        action: 'ACKNOWLEDGEMENT_SENT'
      }
    });
    expect(ackAudit).toBeDefined();
  });

  // 4. Idempotency Check
  it('6. Idempotency: Duplicate messageId does not create a second ticket or message', async () => {
    const sharedMsgId = `<dup-test-${Date.now()}@mail.com>`;
    const firstRun = await processIncomingMessage({
      channel: 'EMAIL',
      messageId: sharedMsgId,
      senderEmail: `cust.dup.${Date.now()}@example.com`,
      senderName: 'Duplicate Check User',
      subject: 'Initial email',
      messageText: 'Initial message body'
    });
    expect(firstRun.isNewTicket).toBe(true);

    const secondRun = await processIncomingMessage({
      channel: 'EMAIL',
      messageId: sharedMsgId,
      senderEmail: `cust.dup.${Date.now()}@example.com`,
      senderName: 'Duplicate Check User',
      subject: 'Initial email re-sent',
      messageText: 'Initial message body re-sent'
    });
    expect(secondRun.isDuplicate).toBe(true);
    expect(secondRun.ticket.id).toBe(firstRun.ticket.id);
  });

  // 5. Customer Reply Threading
  it('7. Customer Reply Threading: Appends reply to existing conversation instead of creating new ticket', async () => {
    const customerEmail = `cust.thread.${Date.now()}@example.com`;
    const initialRun = await processIncomingMessage({
      channel: 'EMAIL',
      messageId: `<thread-init-${Date.now()}@mail.com>`,
      senderEmail: customerEmail,
      senderName: 'Thread Test Customer',
      subject: 'VPN Connection Issues',
      messageText: 'Cannot connect to company VPN'
    });

    const ticketId = initialRun.ticket.id;

    const replyRun = await processIncomingMessage({
      channel: 'EMAIL',
      messageId: `<thread-reply-${Date.now()}@mail.com>`,
      senderEmail: customerEmail,
      senderName: 'Thread Test Customer',
      subject: `Re: [${initialRun.ticket.ticketNumber}] VPN Connection Issues`,
      messageText: 'Here is my IP address: 192.168.1.50\n\nOn Wed, Nov 4, 2026, 10:01 Enterprise CRM Support wrote:\n> please provide your IP address'
    });

    expect(replyRun.isNewTicket).toBe(false);
    expect(replyRun.ticket.id).toBe(ticketId);

    // Verify clean reply was extracted without quoted previous history
    const replyMsg = await prisma.ticketMessage.findFirst({
      where: {
        ticketId: ticketId,
        senderType: 'CUSTOMER'
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(replyMsg).toBeDefined();
    expect(replyMsg.body).toContain('Here is my IP address: 192.168.1.50');
    expect(replyMsg.body).not.toContain('Enterprise CRM Support wrote:');

    // Verify customer reply notification was created
    const replyNotif = await prisma.notification.findFirst({
      where: {
        ticketId: ticketId,
        type: 'CUSTOMER_REPLY'
      }
    });
    expect(replyNotif).toBeDefined();
  });

  // 6. Notification Endpoints & SSE Streaming Engine
  it('8. Notification API: Returns unread count, list, and marks notification as read', async () => {
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(countRes.status).toBe(200);
    expect(countRes.body.success).toBe(true);
    expect(typeof countRes.body.unreadCount).toBe('number');

    const listRes = await request(app)
      .get('/api/notifications?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    if (listRes.body.data.length > 0) {
      const firstId = listRes.body.data[0].id;
      const readRes = await request(app)
        .patch(`/api/notifications/${firstId}/read`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(readRes.status).toBe(200);
      expect(readRes.body.success).toBe(true);
      expect(readRes.body.notification.isRead).toBe(true);
    }
  });

  it('9. Realtime SSE Service: Stream registration and user-specific event dispatch', async () => {
    const testUserId = adminUser.id;
    let writtenData = '';

    const mockRes = {
      writeHead: () => {},
      write: (data) => { writtenData += data; },
      end: () => {}
    };

    const cleanup = RealtimeNotificationService.addClient(testUserId, mockRes);
    expect(RealtimeNotificationService.getActiveConnectionsCount()).toBeGreaterThanOrEqual(1);

    const testPayload = {
      id: 'test-realtime-notif-1',
      userId: testUserId,
      title: 'New Email Ticket #TIC-1999',
      message: 'Alex Reynolds: VPN outage reported',
      type: 'TICKET_CREATED',
      ticketId: 'fake-ticket-id',
      ticketNumber: 'TIC-1999',
      customerName: 'Alex Reynolds',
      subject: 'VPN outage reported',
      channel: 'EMAIL',
      priority: 'HIGH',
      description: 'VPN outage reported',
      isRead: false,
      createdAt: new Date().toISOString()
    };

    RealtimeNotificationService.sendNotificationToUser(testUserId, testPayload);
    expect(writtenData).toContain('event: notification');
    expect(writtenData).toContain('TIC-1999');
    expect(writtenData).toContain('Alex Reynolds');

    cleanup();
  });

  // 7. Email Templates (Agent Reply & Automated Acknowledgement)
  it('10. Email Templates: Professional templates generate responsive HTML and plain-text alternatives', () => {
    const ticketMock = { ticketNumber: 'TIC-1025', title: 'Payment Processing Delay' };
    const customerMock = { name: 'Sarah Miller', email: 'sarah@example.com' };
    const agentMock = { fullName: 'Alex Reynolds' };

    // Test Agent Reply Template
    const agentReply = generateAgentReplyEmail({
      ticket: ticketMock,
      customer: customerMock,
      agent: agentMock,
      responseText: 'We have resolved the gateway timeout issue.\nPlease try your payment again.'
    });

    expect(agentReply.subject).toBe('Re: [TIC-1025] Payment Processing Delay');
    expect(agentReply.html).toContain('Enterprise CRM Support');
    expect(agentReply.html).toContain('TIC-1025');
    expect(agentReply.html).toContain('Sarah Miller');
    expect(agentReply.html).toContain('Alex Reynolds');
    expect(agentReply.html).toContain('Direct Reply Enabled');
    expect(agentReply.text).toContain('Enterprise CRM Support');
    expect(agentReply.text).toContain('TIC-1025');

    // Test Acknowledgement Template
    const ack = generateAcknowledgementEmail({
      ticket: ticketMock,
      customer: customerMock
    });

    expect(ack.subject).toBe('[CRM] Support Request Received — #TIC-1025');
    expect(ack.html).toContain('Enterprise CRM Support');
    expect(ack.html).toContain('Your Ticket ID:');
    expect(ack.html).toContain('TIC-1025');
    expect(ack.html).toContain('Payment Processing Delay');
    expect(ack.text).toContain('Hello Sarah Miller,');
    expect(ack.text).toContain('#TIC-1025');
  });

  // 8. Quoted Reply Parser
  it('11. Quoted Reply Parser: Strips Gmail and Outlook quote blocks while preserving customer text', () => {
    const rawGmailReply = `Thank you for the quick update! Everything is working now.

On Wed, Nov 4, 2026 at 10:01 AM Enterprise CRM Support <chandra2001ks@gmail.com> wrote:
> Hello Sarah,
> We have resolved the gateway timeout issue.
> Best regards,
> Alex Reynolds`;

    const cleanGmail = extractCleanReply(rawGmailReply);
    expect(cleanGmail).toBe('Thank you for the quick update! Everything is working now.');
    expect(cleanGmail).not.toContain('Enterprise CRM Support wrote:');
    expect(cleanGmail).not.toContain('We have resolved the gateway');

    const rawOutlookReply = `Issue is resolved.

-----Original Message-----
From: Enterprise CRM Support [mailto:chandra2001ks@gmail.com]
Sent: Wednesday, November 04, 2026 10:00 AM
To: Sarah Miller
Subject: [TIC-1025] Update`;

    const cleanOutlook = extractCleanReply(rawOutlookReply);
    expect(cleanOutlook).toBe('Issue is resolved.');
  });

  // 9. Manual Sync Endpoint
  it('12. Email Sync Endpoint: POST /api/v1/email/sync requires authentication and returns status', async () => {
    const unauth = await request(app).post('/api/v1/email/sync');
    expect(unauth.status).toBe(401);

    const authRes = await request(app)
      .post('/api/v1/email/sync')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(authRes.status).toBe(200);
    expect(authRes.body.success).toBe(true);
    expect(authRes.body.data).toHaveProperty('processed');
    expect(authRes.body.data).toHaveProperty('errors');
  }, 35000);
});
