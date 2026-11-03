import { prisma } from '../config/db.js';

export const SUPPORT_PLANS = [
  {
    code: 'ADHOC_4H',
    name: 'Ad-hoc 4-Hour Pack',
    description: 'Pre-paid 4 hours block for on-demand troubleshooting, emergency fixes, and ad-hoc IT tasks.',
    hoursIncluded: 4.0,
    hourlyRate: 85.0,
    price: 340.0,
    isAdhoc: true,
    workingHoursWindow: 'MON_FRI_9AM_6PM',
    workingHoursLabel: 'Mon – Fri, 9:00 AM – 6:00 PM',
    slaResponseHours: 4,
    slaResolutionHours: 24
  },
  {
    code: 'RETAINER_20H',
    name: 'Standard 20h Monthly Retainer',
    description: '20 contracted support hours per month with priority queue placement and scheduled maintenance.',
    hoursIncluded: 20.0,
    hourlyRate: 75.0,
    price: 1500.0,
    isAdhoc: false,
    workingHoursWindow: 'MON_SAT_8AM_8PM',
    workingHoursLabel: 'Mon – Sat, 8:00 AM – 8:00 PM',
    slaResponseHours: 2,
    slaResolutionHours: 12
  },
  {
    code: 'ENTERPRISE_50H',
    name: 'Enterprise 50h Retainer & SLA',
    description: '50 hours allocated monthly with dedicated engineer assignment, 24/7 coverage, and 1-hour SLA.',
    hoursIncluded: 50.0,
    hourlyRate: 65.0,
    price: 3250.0,
    isAdhoc: false,
    workingHoursWindow: '24X7',
    workingHoursLabel: '24/7/365 Round-the-clock',
    slaResponseHours: 1,
    slaResolutionHours: 6
  }
];

/**
 * Checks whether the current moment is within the specified support working hours window
 */
export function isWithinWorkingHours(windowType = 'MON_FRI_9AM_6PM') {
  if (windowType === '24X7') {
    return { isOpen: true, message: 'Active 24/7 Support Window' };
  }

  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const hour = now.getHours();

  if (windowType === 'MON_FRI_9AM_6PM') {
    const isWeekday = day >= 1 && day <= 5;
    const isWorkingHour = hour >= 9 && hour < 18;
    const isOpen = isWeekday && isWorkingHour;
    return {
      isOpen,
      message: isOpen
        ? 'Within Active Support Hours (9:00 AM – 6:00 PM)'
        : 'Outside Working Hours (Queue will resume Mon–Fri 9:00 AM)'
    };
  }

  if (windowType === 'MON_SAT_8AM_8PM') {
    const isMonSat = day >= 1 && day <= 6;
    const isWorkingHour = hour >= 8 && hour < 20;
    const isOpen = isMonSat && isWorkingHour;
    return {
      isOpen,
      message: isOpen
        ? 'Within Active Support Hours (8:00 AM – 8:00 PM)'
        : 'Outside Working Hours (Queue will resume at 8:00 AM)'
    };
  }

  return { isOpen: true, message: 'Support Available' };
}

/**
 * Calculate plan metrics for a customer
 */
export function calculateCustomerPlanMetrics(customer) {
  const allocated = Number(customer.allocatedHours || 4.0);
  const used = Number(customer.usedHours || 0.0);
  const rate = Number(customer.hourlyRate || 85.0);

  const remaining = Math.max(0, allocated - used);
  const isDepleted = used >= allocated;
  const isLow = remaining < 1.0 && !isDepleted;
  const overageHours = Math.max(0, used - allocated);
  const overageAmount = overageHours * rate;
  const usagePercentage = Math.min(100, (used / (allocated || 1)) * 100);

  const workingHoursStatus = isWithinWorkingHours(customer.workingHoursWindow);

  return {
    planType: customer.supportPlanType || 'ADHOC_4H',
    planName: customer.supportPlanName || 'Ad-hoc 4-Hour Pack',
    allocatedHours: allocated,
    usedHours: used,
    remainingHours: Number(remaining.toFixed(2)),
    usagePercentage: Number(usagePercentage.toFixed(1)),
    isDepleted,
    isLow,
    overageHours: Number(overageHours.toFixed(2)),
    overageAmount: Number(overageAmount.toFixed(2)),
    hourlyRate: rate,
    workingHoursWindow: customer.workingHoursWindow || 'MON_FRI_9AM_6PM',
    isWithinWorkingHours: workingHoursStatus.isOpen,
    workingHoursNote: workingHoursStatus.message
  };
}

/**
 * Log work duration on a ticket and decrement customer support plan hours
 */
export async function logTicketWork(ticketId, agentId, agentName, durationHours, description, isBillable = true) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { customer: true }
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const duration = Math.max(0.1, Number(durationHours));

  // 1. Create work log entry
  const workLog = await prisma.ticketWorkLog.create({
    data: {
      ticketId,
      agentId: agentId || null,
      agentName: agentName || 'Support Agent',
      durationHours: duration,
      description: description.trim(),
      isBillable: Boolean(isBillable)
    }
  });

  // 2. Update ticket total work hours
  const newTicketTotal = (ticket.totalTimeHours || 0) + duration;
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { totalTimeHours: newTicketTotal }
  });

  // 3. If billable, update customer used hours
  let updatedCustomer = ticket.customer;
  if (isBillable && ticket.customerId) {
    const newUsedHours = (ticket.customer.usedHours || 0) + duration;
    const planStatus = newUsedHours >= ticket.customer.allocatedHours ? 'DEPLETED' : 'ACTIVE';

    updatedCustomer = await prisma.customer.update({
      where: { id: ticket.customerId },
      data: {
        usedHours: newUsedHours,
        planStatus
      }
    });

    // 4. Log audit entry for tracking
    await prisma.ticketAuditLog.create({
      data: {
        ticketId,
        actorId: agentId || null,
        actorName: agentName || 'Support Agent',
        action: 'WORK_TIME_LOGGED',
        fieldChanged: 'usedHours',
        oldValue: `${ticket.customer.usedHours}h`,
        newValue: `${newUsedHours}h`,
        details: `Logged ${duration}h: "${description}". Customer plan balance: ${Math.max(0, updatedCustomer.allocatedHours - newUsedHours)}h remaining.`
      }
    });
  }

  return {
    workLog,
    ticketTotalHours: newTicketTotal,
    customerMetrics: calculateCustomerPlanMetrics(updatedCustomer)
  };
}

