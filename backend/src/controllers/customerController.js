import { prisma } from '../config/db.js';
import { calculateCustomerPlanMetrics, SUPPORT_PLANS } from '../services/supportPlanService.js';

export async function getCustomers(req, res, next) {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { company: { contains: q } }
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { tickets: true }
          },
          tickets: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true
            },
            take: 3,
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.customer.count({ where })
    ]);

    const enrichedCustomers = customers.map(c => ({
      ...c,
      planMetrics: calculateCustomerPlanMetrics(c)
    }));

    res.json({
      success: true,
      data: enrichedCustomers,
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

export async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        tickets: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedTo: {
              select: { id: true, fullName: true, avatarUrl: true }
            },
            _count: {
              select: { messages: true, notes: true, workLogs: true }
            }
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Communication history: aggregate messages across all customer's tickets
    const ticketIds = customer.tickets.map(t => t.id);
    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: { in: ticketIds } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      customer: {
        ...customer,
        planMetrics: calculateCustomerPlanMetrics(customer),
        recentCommunications: messages
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createCustomer(req, res, next) {
  try {
    const {
      name,
      email,
      phone,
      company,
      isVip,
      notes,
      sourceChannel,
      supportPlanType = 'ADHOC_4H',
      workingHoursWindow = 'MON_FRI_9AM_6PM'
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const matchedPlan = SUPPORT_PLANS.find(p => p.code === supportPlanType) || SUPPORT_PLANS[0];

    const customer = await prisma.customer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        isVip: Boolean(isVip),
        notes: notes || null,
        sourceChannel: sourceChannel || 'PORTAL',
        supportPlanType: matchedPlan.code,
        supportPlanName: matchedPlan.name,
        allocatedHours: matchedPlan.hoursIncluded,
        usedHours: 0.0,
        hourlyRate: matchedPlan.hourlyRate,
        workingHoursWindow: workingHoursWindow || matchedPlan.workingHoursWindow,
        planStatus: 'ACTIVE'
      }
    });

    res.status(201).json({
      success: true,
      customer: {
        ...customer,
        planMetrics: calculateCustomerPlanMetrics(customer)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, phone, company, isVip, notes } = req.body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        email: email !== undefined ? email : undefined,
        phone: phone !== undefined ? phone : undefined,
        company: company !== undefined ? company : undefined,
        isVip: isVip !== undefined ? Boolean(isVip) : undefined,
        notes: notes !== undefined ? notes : undefined
      }
    });

    res.json({
      success: true,
      customer: {
        ...updated,
        planMetrics: calculateCustomerPlanMetrics(updated)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerPlan(req, res, next) {
  try {
    const { id } = req.params;
    const {
      planCode,
      allocatedHours,
      usedHours,
      hourlyRate,
      workingHoursWindow,
      planStatus,
      reloadHours
    } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const updateData = {};

    if (planCode) {
      const plan = SUPPORT_PLANS.find(p => p.code === planCode);
      if (plan) {
        updateData.supportPlanType = plan.code;
        updateData.supportPlanName = plan.name;
        updateData.allocatedHours = plan.hoursIncluded;
        updateData.hourlyRate = plan.hourlyRate;
        updateData.workingHoursWindow = plan.workingHoursWindow;
        updateData.usedHours = 0.0; // Fresh plan renewal
        updateData.planStatus = 'ACTIVE';
      }
    }

    if (reloadHours) {
      // Ad-hoc top up: add additional hours to allocated balance
      const added = Math.max(0, Number(reloadHours));
      updateData.allocatedHours = (existing.allocatedHours || 0) + added;
      if (updateData.allocatedHours > (existing.usedHours || 0)) {
        updateData.planStatus = 'ACTIVE';
      }
    }

    if (allocatedHours !== undefined && !planCode && !reloadHours) {
      updateData.allocatedHours = Number(allocatedHours);
    }
    if (usedHours !== undefined) {
      updateData.usedHours = Math.max(0, Number(usedHours));
    }
    if (hourlyRate !== undefined) {
      updateData.hourlyRate = Number(hourlyRate);
    }
    if (workingHoursWindow !== undefined) {
      updateData.workingHoursWindow = workingHoursWindow;
    }
    if (planStatus !== undefined) {
      updateData.planStatus = planStatus;
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Support plan updated successfully',
      customer: {
        ...updated,
        planMetrics: calculateCustomerPlanMetrics(updated)
      }
    });
  } catch (error) {
    next(error);
  }
}
