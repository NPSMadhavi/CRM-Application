import { prisma } from '../config/db.js';
import { updateTicketStatus, assignTicket, sendAgentReply, addInternalNote } from '../services/ticketService.js';
import { calculateCustomerPlanMetrics, logTicketWork } from '../services/supportPlanService.js';
import { emitToAll } from '../config/socket.js';
import { NotificationService } from '../services/notificationService.js';

export async function getTickets(req, res, next) {
  try {
    const {
      status,
      priority,
      category,
      channel,
      assignedToId,
      customerId,
      search,
      page = 1,
      limit = 25
    } = req.query;

    const where = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (channel && channel !== 'ALL') {
      where.channel = channel;
    }
    if (assignedToId) {
      if (assignedToId === 'UNASSIGNED') {
        where.assignedToId = null;
      } else if (assignedToId === 'ME') {
        where.assignedToId = req.user.id;
      } else {
        where.assignedToId = assignedToId;
      }
    }
    if (customerId) {
      where.customerId = customerId;
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { ticketNumber: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { email: { contains: q } } },
        { customer: { phone: { contains: q } } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: true,
          assignedTo: {
            select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
          },
          _count: {
            select: { messages: true, notes: true }
          }
        }
      }),
      prisma.ticket.count({ where })
    ]);

    const enrichedTickets = tickets.map(t => ({
      ...t,
      customer: t.customer ? {
        ...t.customer,
        planMetrics: calculateCustomerPlanMetrics(t.customer)
      } : null
    }));

    res.json({
      success: true,
      data: enrichedTickets,
      pagination: {
        page: parseInt(page, 10),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getTicketById(req, res, next) {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [{ id }, { ticketNumber: id }]
      },
      include: {
        customer: true,
        assignedTo: {
          select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
        },
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        notes: {
          include: {
            author: { select: { id: true, fullName: true, role: true, avatarUrl: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        workLogs: {
          orderBy: { createdAt: 'desc' }
        },
        auditLogs: {
          include: {
            actor: { select: { id: true, fullName: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const enrichedTicket = {
      ...ticket,
      customer: ticket.customer ? {
        ...ticket.customer,
        planMetrics: calculateCustomerPlanMetrics(ticket.customer)
      } : null
    };

    res.json({ success: true, ticket: enrichedTicket });
  } catch (error) {
    next(error);
  }
}

export async function createManualTicket(req, res, next) {
  try {
    const {
      title,
      description,
      customerName,
      customerEmail,
      customerPhone,
      category = 'GENERAL_INQUIRY',
      priority = 'MEDIUM',
      channel = 'PORTAL',
      assignedToId
    } = req.body;

    if (!title || !description || (!customerEmail && !customerPhone && !customerName)) {
      return res.status(400).json({ success: false, message: 'Title, description, and customer details are required' });
    }

    // Find or create customer
    let customer = null;
    if (customerEmail) {
      customer = await prisma.customer.findFirst({ where: { email: customerEmail } });
    }
    if (!customer && customerPhone) {
      customer = await prisma.customer.findFirst({ where: { phone: customerPhone } });
    }
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName || 'Customer',
          email: customerEmail || null,
          phone: customerPhone || null,
          sourceChannel: channel
        }
      });
    }

    const count = await prisma.ticket.count();
    const ticketNumber = `TIC-${1000 + count + 1}`;

    const newTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title,
        description,
        category,
        priority,
        channel,
        status: assignedToId ? 'ASSIGNED' : 'OPEN',
        customerId: customer.id,
        assignedToId: assignedToId || null,
        messages: {
          create: {
            senderType: 'AGENT',
            senderName: req.user.fullName,
            senderEmail: req.user.email,
            channel: channel || 'PORTAL',
            body: description
          }
        },
        auditLogs: {
          create: {
            actorId: req.user.id,
            actorName: req.user.fullName,
            action: 'MANUAL_CREATED',
            details: `Ticket created manually by agent ${req.user.fullName}`
          }
        }
      },
      include: {
        customer: true,
        assignedTo: true,
        messages: true
      }
    });

    emitToAll('ticket:created', { ticket: newTicket });

    await NotificationService.createAndDispatch({
      ticketId: newTicket.id,
      title: `New ${channel} Ticket #${newTicket.ticketNumber}`,
      message: `${customer.name}: ${newTicket.title}`,
      type: 'TICKET_CREATED'
    });

    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    const allowedStatuses = ['NEW', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    const updated = await updateTicketStatus(id, status, req.user, resolutionNotes);
    res.json({ success: true, ticket: updated });
  } catch (error) {
    next(error);
  }
}

export async function assign(req, res, next) {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    // If agentId is empty or 'ME', assign to current user
    const targetAgentId = (!agentId || agentId === 'ME') ? req.user.id : agentId;

    const updated = await assignTicket(id, targetAgentId, req.user);
    res.json({ success: true, ticket: updated });
  } catch (error) {
    next(error);
  }
}

export async function postReply(req, res, next) {
  try {
    const { id } = req.params;
    const { body, channel } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: 'Reply body cannot be empty' });
    }

    const result = await sendAgentReply({
      ticketId: id,
      user: req.user,
      body: body.trim(),
      channel
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function postNote(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Note content cannot be empty' });
    }

    const note = await addInternalNote({
      ticketId: id,
      user: req.user,
      content: content.trim()
    });

    res.status(201).json({ success: true, note });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const { id } = req.params;
    const logs = await prisma.ticketAuditLog.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, fullName: true, role: true } } }
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function logWork(req, res, next) {
  try {
    const { id } = req.params;
    const { durationHours, description, isBillable } = req.body;

    if (!durationHours || isNaN(Number(durationHours)) || Number(durationHours) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid duration in hours is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description of work done is required' });
    }

    const result = await logTicketWork(
      id,
      req.user?.id,
      req.user?.fullName || 'Agent',
      Number(durationHours),
      description.trim(),
      isBillable !== undefined ? Boolean(isBillable) : true
    );

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getTicketWorkLogs(req, res, next) {
  try {
    const { id } = req.params;
    const logs = await prisma.ticketWorkLog.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}


