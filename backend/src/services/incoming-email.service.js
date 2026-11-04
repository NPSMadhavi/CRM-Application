import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotificationService } from './notificationService.js';
import { emitToAll, emitToTicket } from '../config/socket.js';
import { detectTicketDetails } from './aiService.js';
import { extractCleanReply } from './email-reply-parser.service.js';
import { generateAcknowledgementEmail } from './email-template.service.js';
import { sendEmail } from './emailService.js';

export class IncomingEmailService {
  static client = null;
  static mailboxLock = null;
  static isListening = false;
  static isProcessing = false;
  static watchdogTimer = null;
  static reconnectTimer = null;
  static reconnectAttempts = 0;
  static MAX_RECONNECT_ATTEMPTS = 20;
  static WATCHDOG_INTERVAL_MS = 20000; // 20s fallback watchdog

  /**
   * Initializes a new ImapFlow client with sanitized logging and TLS
   */
  static createClient() {
    const host = process.env.IMAP_HOST || 'imap.gmail.com';
    const port = parseInt(process.env.IMAP_PORT || '993', 10);
    const secure = process.env.IMAP_TLS === 'true' || port === 993;
    const user = process.env.IMAP_USER || process.env.SUPPORT_EMAIL || 'chandra2001ks@gmail.com';
    const pass = process.env.IMAP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

    return new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      logger: false,
      emitLogs: false
    });
  }

  /**
   * Non-destructive connection check
   */
  static async checkConnection() {
    const user = process.env.IMAP_USER || process.env.SUPPORT_EMAIL;
    const pass = process.env.IMAP_PASSWORD || process.env.SMTP_PASS;

    if (!user || !pass) {
      logger.warn('[GMAIL IMAP] User or password not configured');
      return false;
    }

    const testClient = this.createClient();
    try {
      await testClient.connect();
      logger.info('✓ Gmail IMAP connection: CONNECTED and authenticated');
      await testClient.logout();
      return true;
    } catch (err) {
      logger.error(`✗ Gmail IMAP connection failed: ${err?.message || err}`);
      try {
        await testClient.logout();
      } catch {}
      return false;
    }
  }

  /**
   * Retrieves or initializes persistent UID watermark in PostgreSQL
   */
  static async getOrInitWatermark(client) {
    const existing = await prisma.integration.findUnique({
      where: { name: 'GMAIL_IMAP' }
    });

    const currentUidValidity = client.mailbox?.uidValidity ? String(client.mailbox.uidValidity) : null;

    if (existing && existing.config) {
      const cfg = existing.config;

      // Check for UIDVALIDITY changes
      if (currentUidValidity && cfg.uidValidity && String(cfg.uidValidity) !== currentUidValidity) {
        logger.warn(`[GMAIL IMAP] UIDVALIDITY changed from ${cfg.uidValidity} to ${currentUidValidity}! Reinitializing baseline.`);
        let highestUid = 0;
        try {
          const uids = await client.search({ all: true }, { uid: true });
          if (Array.isArray(uids) && uids.length > 0) highestUid = Math.max(...uids);
        } catch {}

        await prisma.integration.update({
          where: { name: 'GMAIL_IMAP' },
          data: {
            config: {
              ...cfg,
              uidValidity: currentUidValidity,
              initialBaselineUid: highestUid,
              lastProcessedUid: highestUid,
              reinitializedAt: new Date().toISOString()
            }
          }
        });

        return { lastProcessedUid: highestUid, isFirstInit: false };
      }

      const lastProcessedUid = typeof cfg.lastProcessedUid === 'number'
        ? cfg.lastProcessedUid
        : (typeof cfg.initialBaselineUid === 'number' ? cfg.initialBaselineUid : 0);

      logger.info(`[GMAIL IMAP] Restored lastProcessedUid: ${lastProcessedUid}`);
      logger.info(`[GMAIL IMAP] Listening for emails after UID: ${lastProcessedUid}`);
      return { lastProcessedUid, isFirstInit: false };
    }

    // First-time initialization: determine highest existing UID in mailbox
    let currentHighestUid = 0;
    try {
      const allUids = await client.search({ all: true }, { uid: true });
      if (Array.isArray(allUids) && allUids.length > 0) {
        currentHighestUid = Math.max(...allUids);
      }
      if (client.mailbox && client.mailbox.uidNext && client.mailbox.uidNext > 1) {
        currentHighestUid = Math.max(currentHighestUid, client.mailbox.uidNext - 1);
      }
    } catch (err) {
      logger.warn(`[GMAIL IMAP] Could not determine highest UID via search: ${err?.message}`);
      if (client.mailbox && client.mailbox.uidNext) {
        currentHighestUid = Math.max(0, client.mailbox.uidNext - 1);
      }
    }

    // Persist initial baseline
    await prisma.integration.upsert({
      where: { name: 'GMAIL_IMAP' },
      update: {
        status: 'CONNECTED',
        enabled: true,
        config: {
          lastProcessedUid: currentHighestUid,
          initialBaselineUid: currentHighestUid,
          uidValidity: currentUidValidity,
          initializedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString()
        }
      },
      create: {
        name: 'GMAIL_IMAP',
        type: 'EMAIL',
        status: 'CONNECTED',
        enabled: true,
        config: {
          lastProcessedUid: currentHighestUid,
          initialBaselineUid: currentHighestUid,
          uidValidity: currentUidValidity,
          initializedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString()
        }
      }
    });

    logger.info(`[GMAIL IMAP] Initial mailbox UID: ${currentHighestUid}`);
    logger.info(`[GMAIL IMAP] Historical emails ignored up to UID ${currentHighestUid}`);
    logger.info('[GMAIL IMAP] Listening for new emails');

    return { lastProcessedUid: currentHighestUid, isFirstInit: true };
  }

  /**
   * Updates lastProcessedUid in PostgreSQL AFTER message is saved
   */
  static async updateLastProcessedUid(newUid) {
    try {
      const existing = await prisma.integration.findUnique({
        where: { name: 'GMAIL_IMAP' }
      });
      const cfg = existing?.config || {};

      await prisma.integration.update({
        where: { name: 'GMAIL_IMAP' },
        data: {
          status: 'CONNECTED',
          config: {
            ...cfg,
            lastProcessedUid: newUid,
            lastSyncAt: new Date().toISOString()
          }
        }
      });
      logger.info(`[GMAIL IMAP] Advanced watermark lastProcessedUid to ${newUid}`);
    } catch (err) {
      logger.error(`[GMAIL IMAP] Failed updating watermark: ${err?.message}`);
    }
  }

  /**
   * Starts Gmail IMAP IDLE listener
   */
  static async startListener() {
    if (this.isListening) {
      logger.warn('[GMAIL IMAP] Listener is already active');
      return;
    }

    const user = process.env.IMAP_USER || process.env.SUPPORT_EMAIL;
    const pass = process.env.IMAP_PASSWORD || process.env.SMTP_PASS;
    if (!user || !pass) {
      logger.warn('[GMAIL IMAP] Credentials not set. Skipping IMAP IDLE listener.');
      return;
    }

    try {
      logger.info('[GMAIL IMAP] Connecting...');
      this.client = this.createClient();

      this.client.on('error', (err) => {
        logger.error(`[GMAIL IMAP] Connection error: ${err?.message || err}`);
        this.handleDisconnect();
      });

      this.client.on('close', () => {
        logger.warn('[GMAIL IMAP] Connection closed');
        this.handleDisconnect();
      });

      await this.client.connect();
      logger.info('[GMAIL IMAP] Connected');
      logger.info('[GMAIL IMAP] Authenticated');

      // Select INBOX with mailbox lock
      this.mailboxLock = await this.client.getMailboxLock('INBOX');
      logger.info('[GMAIL IMAP] INBOX selected');

      if (this.client.mailbox?.uidValidity) {
        logger.info(`[GMAIL IMAP] UIDVALIDITY: ${this.client.mailbox.uidValidity}`);
      }

      await this.getOrInitWatermark(this.client);
      this.isListening = true;
      this.reconnectAttempts = 0;

      // Process any messages that arrived while backend was down
      await this.processPendingMessages();

      // Listen for new mailbox updates
      this.client.on('exists', async (data) => {
        logger.info(`[GMAIL IMAP] Mailbox update detected (messages: ${data.count}, prev: ${data.prevCount})`);
        await this.processPendingMessages();
      });

      logger.info('[GMAIL IMAP] IDLE active');

      // Start 20-second watchdog fallback
      this.startWatchdog();
    } catch (err) {
      logger.error(`[GMAIL IMAP] Failed to start listener: ${err?.message || err}`);
      this.handleDisconnect();
    }
  }

  /**
   * Watchdog timer: checks for missed emails every 20 seconds
   */
  static startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(async () => {
      if (this.isListening && !this.isProcessing) {
        try {
          await this.processPendingMessages();
        } catch (err) {
          logger.warn(`[GMAIL IMAP] Watchdog poll error: ${err?.message}`);
        }
      }
    }, this.WATCHDOG_INTERVAL_MS);
  }

  /**
   * Graceful disconnection and exponential backoff reconnection
   */
  static handleDisconnect() {
    this.isListening = false;
    if (this.mailboxLock) {
      try { this.mailboxLock.release(); } catch {}
      this.mailboxLock = null;
    }
    if (this.client) {
      try { this.client.close(); } catch {}
      this.client = null;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('[GMAIL IMAP] Max reconnect attempts reached. Waiting before retrying.');
      this.reconnectAttempts = 0;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 2s, 5s, 10s, 20s, 30s, 60s max
    const delays = [2000, 5000, 10000, 20000, 30000, 60000];
    const delay = delays[Math.min(this.reconnectAttempts - 1, delays.length - 1)];

    logger.info(`[GMAIL IMAP] Connection lost. Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.startListener();
      } catch (err) {
        logger.error(`[GMAIL IMAP] Reconnection failed: ${err?.message}`);
      }
    }, delay);
  }

  /**
   * Stops listener cleanly
   */
  static async stopListener() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isListening = false;
    if (this.mailboxLock) {
      try { this.mailboxLock.release(); } catch {}
      this.mailboxLock = null;
    }
    if (this.client) {
      try {
        await this.client.logout();
      } catch {}
      this.client = null;
    }
    logger.info('[GMAIL IMAP] Listener stopped cleanly');
  }

  /**
   * Manual inbox check / sync trigger
   */
  static async checkInboxOnce() {
    logger.info('[GMAIL IMAP] Manual inbox check requested');
    return this.processPendingMessages();
  }

  /**
   * Fetch and process pending messages with UID > lastProcessedUid
   */
  static async processPendingMessages() {
    if (this.isProcessing) {
      logger.debug('[GMAIL IMAP] Message processing already in progress. Skipping.');
      return { processed: 0, errors: 0 };
    }

    this.isProcessing = true;
    let processedCount = 0;
    let errorCount = 0;

    let standaloneClient = null;
    let clientToUse = this.client;
    let lockToUse = null;

    try {
      if (!clientToUse || !clientToUse.usable) {
        standaloneClient = this.createClient();
        await standaloneClient.connect();
        lockToUse = await standaloneClient.getMailboxLock('INBOX');
        clientToUse = standaloneClient;
      }

      // 1. Force IMAP socket synchronization via NOOP
      try {
        await clientToUse.noop();
      } catch (noopErr) {
        logger.debug(`[GMAIL IMAP] NOOP ping error: ${noopErr?.message}`);
      }

      const existing = await prisma.integration.findUnique({
        where: { name: 'GMAIL_IMAP' }
      });
      const cfg = existing?.config || {};
      const lastProcessedUid = typeof cfg.lastProcessedUid === 'number' ? cfg.lastProcessedUid : 0;

      // 2. Query status to verify mailbox count and live uidNext
      let liveUidNext = clientToUse.mailbox?.uidNext || 0;
      let mailboxMessages = clientToUse.mailbox?.exists || 0;
      try {
        const status = await clientToUse.status('INBOX', { uidNext: true, messages: true });
        if (status) {
          if (status.uidNext) liveUidNext = status.uidNext;
          if (typeof status.messages === 'number') mailboxMessages = status.messages;
        }
      } catch (statusErr) {
        logger.debug(`[GMAIL IMAP] Status check error: ${statusErr?.message}`);
      }

      logger.info(`[GMAIL IMAP] Polling INBOX: lastProcessedUid=${lastProcessedUid}, uidNext=${liveUidNext}, messagesCount=${mailboxMessages}`);

      // 3. Find UIDs strictly greater than lastProcessedUid (Primary range query)
      let uidsToProcess = [];
      try {
        const query = lastProcessedUid > 0 ? { uid: `${lastProcessedUid + 1}:*` } : { all: true };
        const found = await clientToUse.search(query, { uid: true });
        if (Array.isArray(found)) {
          uidsToProcess = found.filter((uid) => uid > lastProcessedUid).sort((a, b) => a - b);
        }
      } catch (searchErr) {
        logger.warn(`[GMAIL IMAP] Range search failed: ${searchErr?.message}`);
      }

      // 4. Fallback search: if range query returned nothing but status indicates pending messages, search all UIDs
      if (uidsToProcess.length === 0) {
        try {
          const allUids = await clientToUse.search({ all: true }, { uid: true });
          if (Array.isArray(allUids)) {
            uidsToProcess = allUids.filter((uid) => uid > lastProcessedUid).sort((a, b) => a - b);
          }
        } catch (allErr) {
          logger.warn(`[GMAIL IMAP] Fallback all search failed: ${allErr?.message}`);
        }
      }

      if (uidsToProcess.length === 0) {
        logger.info(`[GMAIL IMAP] INBOX up to date (watermark: ${lastProcessedUid}, uidNext: ${liveUidNext})`);
        return { processed: 0, errors: 0 };
      }

      logger.info(`[GMAIL IMAP] Found ${uidsToProcess.length} new message(s) to process: [${uidsToProcess.join(', ')}]`);

      for (const uid of uidsToProcess) {
        logger.info(`[GMAIL IMAP] New UID detected: ${uid}`);
        try {
          const messageData = await clientToUse.download(String(uid), undefined, { uid: true });
          if (!messageData || !messageData.content) {
            logger.warn(`[GMAIL IMAP] Could not read message content for UID ${uid}`);
            continue;
          }

          const parsed = await simpleParser(messageData.content);
          logger.info(`[GMAIL IMAP] Email parsed: "${parsed.subject || '(No Subject)'}" from ${parsed.from?.text}`);

          await this.processSingleParsedEmail(parsed, uid, clientToUse);

          // Advance watermark in PostgreSQL AFTER successful processing
          await this.updateLastProcessedUid(uid);
          processedCount++;
          logger.info(`[GMAIL IMAP] Ticket processing completed for UID ${uid}`);
        } catch (procErr) {
          logger.error(`[GMAIL IMAP] Error processing UID ${uid}: ${procErr?.message || procErr}`);
          errorCount++;
          // Do not skip the UID watermark so it can be retried safely
          break;
        }
      }
    } catch (err) {
      logger.error(`[GMAIL IMAP] Pending message cycle error: ${err?.message}`);
      errorCount++;
    } finally {
      if (lockToUse) {
        try { lockToUse.release(); } catch {}
      }
      if (standaloneClient) {
        try { await standaloneClient.logout(); } catch {}
      }
      this.isProcessing = false;
    }

    return { processed: processedCount, errors: errorCount };
  }

  /**
   * Process a single parsed email:
   * 1. Check duplicate
   * 2. Save attachments
   * 3. Match / create customer
   * 4. Match existing ticket or create new ticket (OPEN, UNASSIGNED, source: EMAIL)
   * 5. Save incoming TicketMessage and EmailMessage
   * 6. Create database Notification & SSE stream
   */
  static async processSingleParsedEmail(parsed, uid, client) {
    const fromAddress = parsed.from?.value?.[0]?.address || '';
    const fromName = parsed.from?.value?.[0]?.name || '';
    const subject = parsed.subject || '(No Subject)';
    const messageId = parsed.messageId || `<uid-${uid}-${Date.now()}@imap.gmail.com>`;

    // Skip automated system emails
    const isAutomated =
      /^(no-?reply|notification|mailer-daemon|postmaster)@/i.test(fromAddress) ||
      fromAddress.includes('google.com') && fromAddress.includes('noreply');

    if (isAutomated) {
      logger.info(`[GMAIL IMAP] Skipped automated system email from ${fromAddress} (UID: ${uid})`);
      try {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      } catch {}
      return;
    }

    // Check duplicate external Message-ID
    const existingEmail = await prisma.emailMessage.findFirst({
      where: {
        OR: [
          { messageId },
          { providerMessageId: messageId }
        ]
      }
    });

    if (existingEmail) {
      logger.info(`[GMAIL IMAP] Email already processed previously (Message-ID: ${messageId})`);
      try {
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      } catch {}
      return;
    }

    // Resolve recipient
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'chandra2001ks@gmail.com';
    let toAddress = supportEmail;
    if (Array.isArray(parsed.to)) {
      toAddress = parsed.to[0]?.value?.[0]?.address || supportEmail;
    } else if (parsed.to?.value?.[0]?.address) {
      toAddress = parsed.to.value[0].address;
    }

    // Extract body text & HTML
    const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const bodyHtml = typeof parsed.html === 'string' ? parsed.html : undefined;

    // References header extraction
    let references = undefined;
    if (Array.isArray(parsed.references)) {
      references = parsed.references.join(' ');
    } else if (typeof parsed.references === 'string') {
      references = parsed.references;
    }
    const inReplyTo = parsed.inReplyTo || undefined;

    // Save attachments to disk
    const savedAttachments = [];
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

    if (parsed.attachments && parsed.attachments.length > 0) {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const att of parsed.attachments) {
        try {
          const safeName = att.filename ? att.filename.replace(/[^a-zA-Z0-9._-]/g, '_') : `file_${Date.now()}`;
          const diskFileName = `att-${Date.now()}-${safeName}`;
          const diskPath = path.join(uploadDir, diskFileName);

          await fs.promises.writeFile(diskPath, att.content);

          savedAttachments.push({
            fileName: diskFileName,
            originalName: att.filename || diskFileName,
            mimeType: att.contentType || 'application/octet-stream',
            fileSize: att.size || att.content.length,
            storagePath: diskPath,
            publicUrl: `/uploads/${diskFileName}`
          });
        } catch (attErr) {
          logger.warn(`[GMAIL IMAP] Could not save attachment ${att.filename}: ${attErr?.message}`);
        }
      }
    }

    // AI Classification (optional metadata extraction)
    const aiDetails = await detectTicketDetails(bodyText, {
      name: fromName,
      email: fromAddress
    });

    const finalCustomerName = fromName || aiDetails.customerName || fromAddress.split('@')[0] || 'Customer';
    const finalCustomerEmail = fromAddress.toLowerCase().trim();

    // Customer matching / creation
    let customer = await prisma.customer.findFirst({
      where: { email: finalCustomerEmail }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: finalCustomerName,
          email: finalCustomerEmail,
          sourceChannel: 'EMAIL',
          company: finalCustomerEmail.includes('@') ? finalCustomerEmail.split('@')[1] : null
        }
      });
      logger.info(`[GMAIL IMAP] Created new customer profile: ${customer.name} (${customer.id})`);
    }

    // Threading Detection:
    // 1. Look for In-Reply-To or References matching existing EmailMessage
    let matchedTicket = null;
    const refIds = [];
    if (inReplyTo) refIds.push(inReplyTo);
    if (references) {
      const tokens = references.match(/<[^>]+>/g) || references.split(/\s+/);
      refIds.push(...tokens);
    }

    if (refIds.length > 0) {
      const priorEmail = await prisma.emailMessage.findFirst({
        where: {
          OR: [
            { messageId: { in: refIds } },
            { providerMessageId: { in: refIds } }
          ],
          ticketId: { not: null }
        },
        include: { ticket: true }
      });

      if (priorEmail && priorEmail.ticket) {
        matchedTicket = priorEmail.ticket;
        logger.info(`[GMAIL IMAP] Threading matched via In-Reply-To/References to Ticket #${matchedTicket.ticketNumber}`);
      }
    }

    // 2. Look for ticket number pattern in subject (e.g. TIC-1042 or CRM-000125)
    if (!matchedTicket) {
      const match = subject.match(/(?:TIC|CRM)[-_ ]?(\d+)/i);
      if (match) {
        const queryTerm = match[0].toUpperCase().replace(/\s+/, '-');
        matchedTicket = await prisma.ticket.findFirst({
          where: {
            OR: [
              { ticketNumber: queryTerm },
              { ticketNumber: { contains: match[1] } }
            ]
          }
        });
        if (matchedTicket) {
          logger.info(`[GMAIL IMAP] Threading matched via Subject #${matchedTicket.ticketNumber}`);
        }
      }
    }

    if (matchedTicket) {
      // APPEND CUSTOMER REPLY TO EXISTING TICKET
      const cleanReplyBody = extractCleanReply(bodyText, bodyHtml);
      const newMsg = await prisma.ticketMessage.create({
        data: {
          ticketId: matchedTicket.id,
          senderType: 'CUSTOMER',
          senderName: customer.name,
          senderEmail: customer.email,
          channel: 'EMAIL',
          body: cleanReplyBody,
          externalMessageId: messageId,
          attachments: savedAttachments.length > 0 ? JSON.stringify(savedAttachments) : null
        }
      });

      await prisma.emailMessage.create({
        data: {
          ticketId: matchedTicket.id,
          ticketMessageId: newMsg.id,
          customerId: customer.id,
          direction: 'INBOUND',
          fromAddress: `${fromName} <${fromAddress}>`,
          toAddress,
          senderEmail: fromAddress,
          recipientEmail: toAddress,
          subject,
          bodyText,
          bodyHtml,
          messageId,
          providerMessageId: messageId,
          inReplyTo: inReplyTo || null,
          references: references || null,
          status: 'RECEIVED'
        }
      });

      // Update ticket activity
      const updatedTicket = await prisma.ticket.update({
        where: { id: matchedTicket.id },
        data: {
          updatedAt: new Date()
        },
        include: { customer: true, assignedTo: true }
      });

      await prisma.ticketAuditLog.create({
        data: {
          ticketId: matchedTicket.id,
          actorName: customer.name,
          action: 'CUSTOMER_REPLIED',
          details: `Customer replied via Email: "${subject}"`
        }
      });

      // Notify assigned agent or admins
      await NotificationService.notifyCustomerReply(updatedTicket, customer, newMsg);

      emitToTicket(matchedTicket.id, 'message:received', {
        ticketId: matchedTicket.id,
        message: newMsg,
        ticket: updatedTicket
      });
      emitToAll('ticket:updated', { ticket: updatedTicket });

      logger.info(`[GMAIL IMAP] Appended reply to ticket: ${matchedTicket.ticketNumber}`);
    } else {
      // CREATE NEW TICKET
      // Strict rule: status = OPEN, assignedToId = null, channel = EMAIL
      const count = await prisma.ticket.count();
      const ticketNumber = `TIC-${1000 + count + 1}`;

      const now = new Date();
      const slaResponseDue = new Date(now.getTime() + 4 * 3600 * 1000);
      const slaResolutionDue = new Date(now.getTime() + 24 * 3600 * 1000);

      const newTicket = await prisma.ticket.create({
        data: {
          ticketNumber,
          title: subject,
          description: bodyText,
          status: 'OPEN',
          priority: aiDetails.priority || 'MEDIUM',
          category: aiDetails.category || 'GENERAL_INQUIRY',
          channel: 'EMAIL',
          sourceIdentifier: messageId,
          aiExtracted: true,
          aiConfidence: aiDetails.confidence || 0.85,
          aiSummary: aiDetails.summary,
          sentiment: aiDetails.sentiment || 'CALM',
          customerId: customer.id,
          assignedToId: null, // STRICT RULE: null (Unassigned)
          slaResponseDue,
          slaResolutionDue,
          messages: {
            create: {
              senderType: 'CUSTOMER',
              senderName: customer.name,
              senderEmail: customer.email,
              channel: 'EMAIL',
              body: bodyText,
              externalMessageId: messageId,
              attachments: savedAttachments.length > 0 ? JSON.stringify(savedAttachments) : null
            }
          },
          auditLogs: {
            create: [
              {
                actorName: 'AI Classification Engine',
                action: 'AI_DETECTED',
                details: `Auto-categorized as ${aiDetails.category || 'TECHNICAL'} (${aiDetails.priority || 'MEDIUM'} priority, ${aiDetails.sentiment || 'CALM'} sentiment)`
              },
              {
                actorName: 'System (IMAP)',
                action: 'EMAIL_INBOUND_CREATED',
                details: `Ticket created from incoming email: "${subject}"`
              }
            ]
          }
        },
        include: {
          customer: true,
          assignedTo: true,
          messages: true
        }
      });

      const initialMessage = newTicket.messages[0];

      await prisma.emailMessage.create({
        data: {
          ticketId: newTicket.id,
          ticketMessageId: initialMessage?.id || null,
          customerId: customer.id,
          direction: 'INBOUND',
          fromAddress: `${fromName} <${fromAddress}>`,
          toAddress,
          senderEmail: fromAddress,
          recipientEmail: toAddress,
          subject,
          bodyText,
          bodyHtml,
          messageId,
          providerMessageId: messageId,
          inReplyTo: inReplyTo || null,
          references: references || null,
          status: 'RECEIVED'
        }
      });

      // Send Automated Acknowledgement Email to customer immediately
      try {
        const existingAck = await prisma.emailMessage.findFirst({
          where: {
            ticketId: newTicket.id,
            direction: 'OUTBOUND',
            subject: { contains: 'Support Request Received' }
          }
        });

        if (!existingAck && fromAddress) {
          const { subject: ackSubject, html: ackHtml, text: ackText } = generateAcknowledgementEmail({
            ticket: newTicket,
            customer
          });

          const ackResult = await sendEmail({
            to: fromAddress,
            subject: ackSubject,
            text: ackText,
            html: ackHtml,
            inReplyTo: messageId || undefined,
            references: messageId || undefined,
            ticketId: newTicket.id
          });

          // Create SYSTEM message so the conversation displays "Automated Acknowledgement Sent"
          const sysMsg = await prisma.ticketMessage.create({
            data: {
              ticketId: newTicket.id,
              senderType: 'SYSTEM',
              senderName: 'System',
              senderEmail: process.env.SMTP_FROM_EMAIL || 'chandra2001ks@gmail.com',
              channel: 'EMAIL',
              body: ackText,
              externalMessageId: ackResult.messageId || null
            }
          });

          if (ackResult.emailRecordId) {
            await prisma.emailMessage.update({
              where: { id: ackResult.emailRecordId },
              data: { ticketMessageId: sysMsg.id }
            });
          }

          await prisma.ticketAuditLog.create({
            data: {
              ticketId: newTicket.id,
              actorName: 'System (Email Service)',
              action: 'ACKNOWLEDGEMENT_SENT',
              details: `Automated acknowledgement email sent to ${fromAddress}`
            }
          });

          emitToTicket(newTicket.id, 'message:received', {
            ticketId: newTicket.id,
            message: sysMsg,
            ticket: newTicket
          });

          logger.info(`[GMAIL IMAP] Sent automated acknowledgement to ${fromAddress} for #${newTicket.ticketNumber}`);
        }
      } catch (ackErr) {
        logger.error(`[GMAIL IMAP] Failed to send automated acknowledgement: ${ackErr?.message}`);
      }

      // Dispatch Notification to Super Admins / Admins & trigger SSE stream
      await NotificationService.notifyNewEmailTicket(newTicket, customer, initialMessage);

      emitToAll('ticket:created', { ticket: newTicket });

      logger.info(`[GMAIL IMAP] Ticket created: ${newTicket.ticketNumber} (status: OPEN, assignedToId: null)`);
      logger.info('[GMAIL IMAP] Notification created and dispatched via SSE');
    }

    // Mark email as \Seen in Gmail
    try {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
    } catch (flagErr) {
      logger.warn(`[GMAIL IMAP] Failed to mark \\Seen for UID ${uid}: ${flagErr?.message}`);
    }
  }
}
