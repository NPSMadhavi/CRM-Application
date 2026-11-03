import { prisma } from '../src/config/db.js';

async function updateSeedWithPlans() {
  console.log('[Plan Migration] Updating customers with support plans & hours...');

  // 1. Update David Miller (Apex Technologies) -> Ad-hoc 4 Hours
  await prisma.customer.updateMany({
    where: { name: 'David Miller' },
    data: {
      supportPlanType: 'ADHOC_4H',
      supportPlanName: 'Ad-hoc 4-Hour Pack',
      allocatedHours: 4.0,
      usedHours: 1.5,
      hourlyRate: 85.0,
      workingHoursWindow: 'MON_FRI_9AM_6PM',
      planStatus: 'ACTIVE'
    }
  });

  // 2. Update Emily Watson (Sterling Global Corp) -> 20h Retainer
  await prisma.customer.updateMany({
    where: { name: 'Emily Watson' },
    data: {
      supportPlanType: 'RETAINER_20H',
      supportPlanName: 'Standard 20h Monthly Retainer',
      allocatedHours: 20.0,
      usedHours: 8.5,
      hourlyRate: 75.0,
      workingHoursWindow: 'MON_SAT_8AM_8PM',
      planStatus: 'ACTIVE'
    }
  });

  // 3. Update Liam Gallagher (Manchester Media Ltd) -> Ad-hoc 4 Hours (DEPLETED / Overage)
  await prisma.customer.updateMany({
    where: { name: 'Liam Gallagher' },
    data: {
      supportPlanType: 'ADHOC_4H',
      supportPlanName: 'Ad-hoc 4-Hour Pack',
      allocatedHours: 4.0,
      usedHours: 4.5,
      hourlyRate: 85.0,
      workingHoursWindow: 'MON_FRI_9AM_6PM',
      planStatus: 'DEPLETED'
    }
  });

  // 4. Update Sophia Rodriguez (Nexus AI Labs) -> 50h Enterprise
  await prisma.customer.updateMany({
    where: { name: 'Sophia Rodriguez' },
    data: {
      supportPlanType: 'ENTERPRISE_50H',
      supportPlanName: 'Enterprise 50h Retainer & SLA',
      allocatedHours: 50.0,
      usedHours: 12.0,
      hourlyRate: 65.0,
      workingHoursWindow: '24X7',
      planStatus: 'ACTIVE'
    }
  });

  // Add work log to Ticket 1 (TIC-1001)
  const ticket1 = await prisma.ticket.findFirst({ where: { ticketNumber: 'TIC-1001' } });
  if (ticket1) {
    await prisma.ticket.update({
      where: { id: ticket1.id },
      data: { totalTimeHours: 1.5 }
    });
    const existingLog = await prisma.ticketWorkLog.findFirst({ where: { ticketId: ticket1.id } });
    if (!existingLog) {
      await prisma.ticketWorkLog.create({
        data: {
          ticketId: ticket1.id,
          agentName: 'Marcus Vance',
          durationHours: 1.5,
          description: 'Analyzed Cisco ASA gateway logs, detected DTLS packet fragmentation on remote peer, adjusted tunnel profile to TLS fallback mode.',
          isBillable: true
        }
      });
    }
  }

  console.log('✅ Support plans and initial work logs successfully seeded!');
  process.exit(0);
}

updateSeedWithPlans().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
