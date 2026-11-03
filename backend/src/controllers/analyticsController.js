import { prisma } from '../config/db.js';

export async function getDashboardStats(req, res, next) {
  try {
    const [
      totalTickets,
      newTickets,
      openTickets,
      inProgressTickets,
      waitingTickets,
      resolvedTickets,
      closedTickets,
      criticalTickets,
      highTickets,
      mediumTickets,
      lowTickets,
      whatsappTickets,
      emailTickets,
      portalTickets,
      totalCustomers,
      totalAgents
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'NEW' } }),
      prisma.ticket.count({ where: { status: 'OPEN' } }),
      prisma.ticket.count({ where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.ticket.count({ where: { status: 'WAITING_FOR_CUSTOMER' } }),
      prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      prisma.ticket.count({ where: { status: 'CLOSED' } }),

      prisma.ticket.count({ where: { priority: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticket.count({ where: { priority: 'HIGH', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticket.count({ where: { priority: 'MEDIUM', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticket.count({ where: { priority: 'LOW', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),

      prisma.ticket.count({ where: { channel: 'WHATSAPP' } }),
      prisma.ticket.count({ where: { channel: 'EMAIL' } }),
      prisma.ticket.count({ where: { channel: 'PORTAL' } }),

      prisma.customer.count(),
      prisma.user.count({ where: { isActive: true } })
    ]);

    // Active tickets total (all non-resolved, non-closed)
    const activeTickets = newTickets + openTickets + inProgressTickets + waitingTickets;

    // SLA health calculation
    const now = new Date();
    const breachedCount = await prisma.ticket.count({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        OR: [
          { slaBreached: true },
          { slaResolutionDue: { lt: now } }
        ]
      }
    });

    const slaComplianceRate = activeTickets > 0
      ? Math.round(((activeTickets - breachedCount) / activeTickets) * 100)
      : 100;

    // Category breakdown
    const categories = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCOUNT_ACCESS', 'BILLING', 'GENERAL_INQUIRY'];
    const categoryDistribution = await Promise.all(
      categories.map(async (cat) => {
        const count = await prisma.ticket.count({ where: { category: cat } });
        return { category: cat, count };
      })
    );

    // Recent 5 activity logs
    const recentActivity = await prisma.ticketAuditLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: {
          select: { ticketNumber: true, title: true, priority: true }
        }
      }
    });

    res.json({
      success: true,
      data: {
        counts: {
          total: totalTickets,
          active: activeTickets,
          new: newTickets,
          open: openTickets,
          inProgress: inProgressTickets,
          waitingForCustomer: waitingTickets,
          resolved: resolvedTickets,
          closed: closedTickets,
          customers: totalCustomers,
          agents: totalAgents
        },
        priorities: {
          critical: criticalTickets,
          high: highTickets,
          medium: mediumTickets,
          low: lowTickets
        },
        channels: {
          whatsapp: whatsappTickets,
          email: emailTickets,
          portal: portalTickets
        },
        sla: {
          breachedCount,
          onTrackCount: Math.max(0, activeTickets - breachedCount),
          complianceRate: slaComplianceRate
        },
        categoryDistribution,
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
}

