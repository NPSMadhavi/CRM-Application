import { prisma } from '../config/db.js';
import { detectTicketDetails } from './aiService.js';
import { sendWhatsAppMessage } from './whatsappService.js';
import { sendEmail } from './emailService.js';
import { emitToAll, emitToTicket } from '../config/socket.js';
import { logger } from '../utils/logger.js';

/**
 * Generate a clean sequential Ticket Number, e.g. TIC-1042
 */
async function generateTicketNumber() {
  const count = await prisma.ticket.count();
  const nextNum = 1000 + count + 1;
  return `TIC-${nextNum}`;
}

/**
 * Calculate SLA response & resolution due dates
 */
function calculateSLADeadlines(category, priority) {
  const now = new Date();
  let responseHours = 4;
  let resolutionHours = 24;

  if (priority === 'CRITICAL') {
    responseHours = 1;
    resolutionHours = 4;
  } else if (priority === 'HIGH') {
    responseHours = 2;
    resolutionHours = 12;
  } else if (priority === 'LOW') {
    responseHours = 8;
    resolutionHours = 48;
  }

  const slaResponseDue = new Date(now.getTime() + responseHours * 3600 * 1000);
  const slaResolutionDue = new Date(now.getTime() + resolutionHours * 3600 * 1000);

  return { slaResponseDue, slaResolutionDue };
}

/**
 * Process incoming message from any channel (WhatsApp or Email)
 * Handles deduplication, AI entity detection, customer linking, ticket creation,
 * automatic acknowledgement, and real-time dashboard notification.
 */
export async function processIncomingMessage({
  channel,
  messageId,
  senderPhone,
  senderEmail,
  senderName,
  messageText,
  subject,
  attachments = [],
  rawPayload = {}
}) {
  logger.info(`[TicketService] Processing incoming message from ${channel} (ID: ${messageId || 'none'})`);

  // 1. DEDUPLICATION CHECK: Check if this exact external message ID was already processed
  if (messageId) {
    const existingMsg = await prisma.ticketMessage.findFirst({
      where: { externalMessageId: messageId },
      include: { ticket: { include: { customer: true, assignedTo: true } } }
    });

    if (existingMsg) {
      logger.warn(`[TicketService] Duplicate message ignored (ID: ${messageId}). Belongs to Ticket #${existingMsg.ticket.ticketNumber}`);
      return {
        isDuplicate: true,
        ticket: existingMsg.ticket,
        message: existingMsg
      };
    }
  }

  // 2. AI-POWERED EXTRACTION
  const aiResult = await detectTicketDetails(messageText, {
    name: senderName,
    email: senderEmail,
    phone: senderPhone
  });

  const finalCustomerEmail = senderEmail || aiResult.customerEmail;
  const finalCustomerPhone = senderPhone || aiResult.customerPhone;
  const finalCustomerName = senderName || aiResult.customerName || 'Customer';

  // 3. FIND OR CREATE CUSTOMER
  let customer = null;
  if (finalCustomerEmail) {
    customer = await prisma.customer.findFirst({ where: { email: finalCustomerEmail } });
  }
  if (!customer && finalCustomerPhone) {
    customer = await prisma.customer.findFirst({ where: { phone: finalCustomerPhone } });
  }

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: finalCustomerName,
        email: finalCustomerEmail,
        phone: finalCustomerPhone,
        sourceChannel: channel,
        company: finalCustomerEmail ? finalCustomerEmail.split('@')[1] : null
      }
    });
    logger.info(`[TicketService] Created new customer profile: ${customer.name} (${customer.id})`);
  } else {
    // Keep customer details updated
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: customer.name === 'Support Customer' ? finalCustomerName : customer.name,
        phone: customer.phone || finalCustomerPhone,
        email: customer.email || finalCustomerEmail
      }
    });
  }

  // 4. CHECK FOR EXISTING OPEN TICKET (Conversation Threading)
  // If customer has an active ticket (NEW, OPEN, ASSIGNED, IN_PROGRESS, WAITING_FOR_CUSTOMER),
  // append incoming message to that thread rather than cluttering with duplicate tickets.
  const activeTicket = await prisma.ticket.findFirst({
    where: {
      customerId: customer.id,
      status: {
        in: ['NEW', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER']
      }
    },
    orderBy: { updatedAt: 'desc' },
    include: { customer: true, assignedTo: true }
  });

  if (activeTicket) {
    logger.info(`[TicketService] Customer has open ticket #${activeTicket.ticketNumber}. Appending follow-up message.`);

    // Create message under existing ticket
    const newMsg = await prisma.ticketMessage.create({
      data: {
        ticketId: activeTicket.id,
        senderType: 'CUSTOMER',
        senderName: finalCustomerName,
        senderEmail: finalCustomerEmail,
        senderPhone: finalCustomerPhone,
        channel,
        body: messageText,
        externalMessageId: messageId,
        attachments: attachments.length ? JSON.stringify(attachments) : null
      }
    });

    // Update ticket status to WAITING_FOR_CUSTOMER if it was in waiting, or update timestamp
    const updatedTicket = await prisma.ticket.update({
      where: { id: activeTicket.id },
      data: {
        status: activeTicket.status === 'WAITING_FOR_CUSTOMER' ? 'OPEN' : activeTicket.status,
        updatedAt: new Date()
      },
      include: {
        customer: true,
        assignedTo: true,
        messages: { orderBy: { createdAt: 'asc' } },
        notes: { include: { author: true }, orderBy: { createdAt: 'desc' } }
      }
    });

    // Log audit
    await prisma.ticketAuditLog.create({
      data: {
        ticketId: activeTicket.id,
        actorName: finalCustomerName,
        action: 'MESSAGE_RECEIVED',
        details: `Follow-up received via ${channel}`
      }
    });

    // Realtime notification
    emitToTicket(activeTicket.id, 'message:received', {
      ticketId: activeTicket.id,
      message: newMsg,
      ticket: updatedTicket
    });

    return {
      isNewTicket: false,
      ticket: updatedTicket,
      message: newMsg
    };
  }

  // 5. CREATE NEW TICKET
  const ticketNumber = await generateTicketNumber();
  const { slaResponseDue, slaResolutionDue } = calculateSLADeadlines(aiResult.category, aiResult.priority);

  const ticketTitle = subject || aiResult.title || `${aiResult.category} Issue from ${finalCustomerName}`;

  const newTicket = await prisma.ticket.create({
    data: {
      ticketNumber,
      title: ticketTitle,
      description: messageText,
      status: 'NEW',
      priority: aiResult.priority,
      category: aiResult.category,
      channel,
      sourceIdentifier: finalCustomerPhone || finalCustomerEmail || messageId,
      aiExtracted: true,
      aiConfidence: aiResult.aiConfidence,
      aiSummary: aiResult.summary,
      sentiment: aiResult.sentiment,
      customerId: customer.id,
      slaResponseDue,
      slaResolutionDue,
      messages: {
        create: {
          senderType: 'CUSTOMER',
          senderName: finalCustomerName,
          senderEmail: finalCustomerEmail,
          senderPhone: finalCustomerPhone,
          channel,
          body: messageText,
          externalMessageId: messageId,
          attachments: attachments.length ? JSON.stringify(attachments) : null
        }
      },
      auditLogs: {
        create: [
          {
            actorName: 'AI Classification Engine',
            action: 'AI_DETECTED',
            details: `Auto-categorized as ${aiResult.category} (${aiResult.priority} priority, ${aiResult.sentiment} sentiment)`
          },
          {
            actorName: 'System',
            action: 'CREATED',
            details: `Ticket created automatically via ${channel}`
          }
        ]
      }
    },
    include: {
      customer: true,
      assignedTo: true,
      messages: true,
      notes: true,
      auditLogs: true
    }
  });

  logger.info(`[TicketService] Created Ticket #${newTicket.ticketNumber} [${newTicket.category}] Priority: ${newTicket.priority}`);

  // 6. AUTOMATIC CUSTOMER ACKNOWLEDGEMENT (Feature 3)
  const acknowledgementText = `We have received your support request. Your Ticket ID is #${newTicket.ticketNumber}. Our support team will contact you within a few hours.`;

  try {
    if (channel === 'WHATSAPP' && finalCustomerPhone) {
      await sendWhatsAppMessage(finalCustomerPhone, acknowledgementText);
    } else if (channel === 'EMAIL' && finalCustomerEmail) {
      await sendEmail({
        to: finalCustomerEmail,
        subject: `[Ticket #${newTicket.ticketNumber}] We have received your request: ${newTicket.title}`,
        text: acknowledgementText
      });
    }

    // Record acknowledgement in conversation history
    await prisma.ticketMessage.create({
      data: {
        ticketId: newTicket.id,
        senderType: 'SYSTEM',
        senderName: 'Auto-Acknowledgement Bot',
        channel,
        body: acknowledgementText
      }
    });

    await prisma.ticketAuditLog.create({
      data: {
        ticketId: newTicket.id,
        actorName: 'System Bot',
        action: 'ACKNOWLEDGEMENT_SENT',
        details: `Sent automated receipt confirmation via ${channel}`
      }
    });
  } catch (ackErr) {
    logger.warn('[TicketService] Failed to send automatic acknowledgement:', ackErr.message);
  }

  // 7. REAL-TIME DASHBOARD NOTIFICATION (Feature 4 & 9)
  const notification = await prisma.notification.create({
    data: {
      ticketId: newTicket.id,
      title: `New ${newTicket.priority} Ticket #${newTicket.ticketNumber}`,
      message: `${newTicket.customer.name} reported: "${newTicket.title}"`,
      type: 'TICKET_CREATED'
    }
  });

  emitToAll('ticket:created', {
    ticket: newTicket,
    notification
  });

  return {
    isNewTicket: true,
    ticket: newTicket
  };
}

/**
 * Update Ticket Status with lifecycle checks & notifications
 */
export async function updateTicketStatus(ticketId, newStatus, user, resolutionNotes = null) {
  const currentTicket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { customer: true, assignedTo: true }
  });

  if (!currentTicket) throw new Error('Ticket not found');

  const oldStatus = currentTicket.status;
  const updateData = { status: newStatus };

  if (newStatus === 'RESOLVED') {
    updateData.resolvedAt = new Date();
    updateData.resolutionNotes = resolutionNotes || 'Resolved by agent';
  } else if (newStatus === 'CLOSED') {
    updateData.closedAt = new Date();
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      customer: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: 'asc' } },
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      auditLogs: { orderBy: { createdAt: 'desc' } }
    }
  });

  // Audit log
  await prisma.ticketAuditLog.create({
    data: {
      ticketId,
      actorId: user.id,
      actorName: user.fullName,
      action: 'STATUS_CHANGED',
      fieldChanged: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      details: resolutionNotes ? `Resolution: ${resolutionNotes}` : null
    }
  });

  // Notify customer if resolved
  if (newStatus === 'RESOLVED') {
    const notifyMsg = `Your ticket #${updatedTicket.ticketNumber} has been resolved. Note: ${resolutionNotes || 'All requested items addressed.'}`;
    if (updatedTicket.channel === 'WHATSAPP' && updatedTicket.customer.phone) {
      await sendWhatsAppMessage(updatedTicket.customer.phone, notifyMsg);
    } else if (updatedTicket.channel === 'EMAIL' && updatedTicket.customer.email) {
      await sendEmail({
        to: updatedTicket.customer.email,
        subject: `[Resolved] Ticket #${updatedTicket.ticketNumber}: ${updatedTicket.title}`,
        text: notifyMsg
      });
    }
  }

  // Socket notification
  emitToTicket(ticketId, 'ticket:updated', { ticket: updatedTicket, oldStatus, newStatus });

  return updatedTicket;
}

/**
 * Assign or reassign ticket to an agent
 */
export async function assignTicket(ticketId, agentId, actorUser) {
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error('Agent not found');

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assignedToId: agentId,
      status: 'ASSIGNED'
    },
    include: {
      customer: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: 'asc' } },
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      auditLogs: { orderBy: { createdAt: 'desc' } }
    }
  });

  await prisma.ticketAuditLog.create({
    data: {
      ticketId,
      actorId: actorUser.id,
      actorName: actorUser.fullName,
      action: 'ASSIGNED',
      fieldChanged: 'assignedToId',
      newValue: agent.fullName,
      details: `Assigned to ${agent.fullName} (${agent.role})`
    }
  });

  // Notification for agent
  const notif = await prisma.notification.create({
    data: {
      recipientId: agentId,
      ticketId,
      title: `Ticket #${updatedTicket.ticketNumber} Assigned`,
      message: `You were assigned ticket: "${updatedTicket.title}"`,
      type: 'TICKET_ASSIGNED'
    }
  });

  emitToTicket(ticketId, 'ticket:updated', { ticket: updatedTicket, assignedTo: agent });
  emitToAll('notification:new', notif);

  return updatedTicket;
}

/**
 * Send an Agent Reply to the customer and log it
 */
export async function sendAgentReply({ ticketId, user, body, channel }) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { customer: true }
  });

  if (!ticket) throw new Error('Ticket not found');

  const targetChannel = channel || ticket.channel;

  // Send message to customer via chosen channel
  if (targetChannel === 'WHATSAPP' && ticket.customer.phone) {
    await sendWhatsAppMessage(ticket.customer.phone, body);
  } else if (targetChannel === 'EMAIL' && ticket.customer.email) {
    await sendEmail({
      to: ticket.customer.email,
      subject: `Re: [Ticket #${ticket.ticketNumber}] ${ticket.title}`,
      text: body
    });
  }

  // Create message record
  const msg = await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderType: 'AGENT',
      senderName: user.fullName,
      senderEmail: user.email,
      channel: targetChannel,
      body
    }
  });

  // Update ticket firstResponseAt if not already recorded
  const isFirstResponse = !ticket.firstResponseAt;
  const updateData = {
    updatedAt: new Date(),
    status: ticket.status === 'NEW' || ticket.status === 'ASSIGNED' ? 'IN_PROGRESS' : ticket.status
  };
  if (isFirstResponse) {
    updateData.firstResponseAt = new Date();
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: updateData,
    include: {
      customer: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: 'asc' } },
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } }
    }
  });

  // Audit
  await prisma.ticketAuditLog.create({
    data: {
      ticketId,
      actorId: user.id,
      actorName: user.fullName,
      action: 'REPLY_SENT',
      details: `Replied to customer via ${targetChannel}`
    }
  });

  emitToTicket(ticketId, 'message:received', {
    ticketId,
    message: msg,
    ticket: updatedTicket
  });

  return { message: msg, ticket: updatedTicket };
}

/**
 * Add internal agent note (private)
 */
export async function addInternalNote({ ticketId, user, content }) {
  const note = await prisma.ticketNote.create({
    data: {
      ticketId,
      authorId: user.id,
      content,
      isPrivate: true
    },
    include: { author: true }
  });

  await prisma.ticketAuditLog.create({
    data: {
      ticketId,
      actorId: user.id,
      actorName: user.fullName,
      action: 'NOTE_ADDED',
      details: 'Added internal note'
    }
  });

  const updatedTicket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: 'asc' } },
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } }
    }
  });

  emitToTicket(ticketId, 'ticket:updated', { ticket: updatedTicket, newNote: note });

  return note;
}

