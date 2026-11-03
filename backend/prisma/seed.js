import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding database with realistic IT Support CRM data...');

  // Clean existing data
  try {
    await prisma.ticketAuditLog.deleteMany();
    await prisma.ticketNote.deleteMany();
    await prisma.ticketMessage.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    await prisma.categoryConfig.deleteMany();
  } catch (e) {
    console.log('[Seed] Note: Clean step completed or skipped.');
  }

  // 1. Create Users
  const adminPass = await bcrypt.hash('admin123', 10);
  const agentPass = await bcrypt.hash('agent123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@crm.local',
      passwordHash: adminPass,
      fullName: 'Alex Reynolds (Admin)',
      role: 'ADMIN',
      department: 'IT Operations & Leadership',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      phone: '+1-555-0100'
    }
  });

  const agent1 = await prisma.user.create({
    data: {
      email: 'sarah.chen@crm.local',
      passwordHash: agentPass,
      fullName: 'Sarah Chen',
      role: 'TIER_1_AGENT',
      department: 'Helpdesk & Client Support',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      phone: '+1-555-0101'
    }
  });

  const agent2 = await prisma.user.create({
    data: {
      email: 'marcus.vance@crm.local',
      passwordHash: agentPass,
      fullName: 'Marcus Vance',
      role: 'TIER_2_AGENT',
      department: 'Network & Infrastructure',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      phone: '+1-555-0102'
    }
  });

  const agent3 = await prisma.user.create({
    data: {
      email: 'elena.rostova@crm.local',
      passwordHash: agentPass,
      fullName: 'Elena Rostova',
      role: 'AGENT',
      department: 'Enterprise Application Support',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      phone: '+1-555-0103'
    }
  });

  console.log('[Seed] Created Users: Admin, Sarah Chen, Marcus Vance, Elena Rostova');

  // 2. Create Customers with realistic Support Contracts & Working Hours
  const customer1 = await prisma.customer.create({
    data: {
      name: 'David Miller',
      email: 'david.m@apextech.com',
      phone: '+15551234567',
      company: 'Apex Technologies',
      isVip: false,
      sourceChannel: 'WHATSAPP',
      supportPlanType: 'ADHOC_4H',
      supportPlanName: 'Ad-hoc 4-Hour Pack',
      allocatedHours: 4.0,
      usedHours: 1.5,
      hourlyRate: 85.0,
      workingHoursWindow: 'MON_FRI_9AM_6PM',
      planStatus: 'ACTIVE'
    }
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Emily Watson',
      email: 'emily.watson@sterlingcorp.com',
      phone: '+15559876543',
      company: 'Sterling Global Corp',
      isVip: true,
      sourceChannel: 'EMAIL',
      supportPlanType: 'RETAINER_20H',
      supportPlanName: 'Standard 20h Monthly Retainer',
      allocatedHours: 20.0,
      usedHours: 8.5,
      hourlyRate: 75.0,
      workingHoursWindow: 'MON_SAT_8AM_8PM',
      planStatus: 'ACTIVE'
    }
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Liam Gallagher',
      email: 'liam.g@manchester-media.co.uk',
      phone: '+447700900123',
      company: 'Manchester Media Ltd',
      isVip: false,
      sourceChannel: 'WHATSAPP',
      supportPlanType: 'ADHOC_4H',
      supportPlanName: 'Ad-hoc 4-Hour Pack',
      allocatedHours: 4.0,
      usedHours: 4.5, // 0.5h overage
      hourlyRate: 85.0,
      workingHoursWindow: 'MON_FRI_9AM_6PM',
      planStatus: 'DEPLETED'
    }
  });

  const customer4 = await prisma.customer.create({
    data: {
      name: 'Sophia Rodriguez',
      email: 'sophia.r@nexusai.io',
      phone: '+15554321098',
      company: 'Nexus AI Labs',
      isVip: false,
      sourceChannel: 'EMAIL',
      supportPlanType: 'ENTERPRISE_50H',
      supportPlanName: 'Enterprise 50h Retainer & SLA',
      allocatedHours: 50.0,
      usedHours: 12.0,
      hourlyRate: 65.0,
      workingHoursWindow: '24X7',
      planStatus: 'ACTIVE'
    }
  });

  console.log('[Seed] Created 4 Customers');

  // 3. Create Realistic Tickets
  const now = new Date();

  // Ticket 1: WhatsApp - Network VPN issue (Assigned to Marcus Vance)
  const ticket1 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TIC-1001',
      title: 'VPN connection repeatedly disconnects when remote working',
      description: 'Hi support team, since this morning my Cisco AnyConnect VPN client drops connection every 5-10 minutes with error 412: Remote peer not responding. I have tried restarting my home router but the issue persists.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      category: 'NETWORK',
      channel: 'WHATSAPP',
      sourceIdentifier: customer1.phone,
      aiExtracted: true,
      aiConfidence: 0.94,
      aiSummary: 'Customer experiencing recurrent Cisco AnyConnect VPN drops (Error 412) from remote environment.',
      sentiment: 'FRUSTRATED',
      customerId: customer1.id,
      assignedToId: agent2.id,
      slaResponseDue: new Date(now.getTime() + 2 * 3600 * 1000),
      slaResolutionDue: new Date(now.getTime() + 8 * 3600 * 1000),
      firstResponseAt: new Date(now.getTime() - 40 * 60 * 1000),
      messages: {
        create: [
          {
            senderType: 'CUSTOMER',
            senderName: customer1.name,
            senderPhone: customer1.phone,
            channel: 'WHATSAPP',
            body: 'Hi support team, since this morning my Cisco AnyConnect VPN client drops connection every 5-10 minutes with error 412: Remote peer not responding. I have tried restarting my home router but the issue persists.',
            externalMessageId: 'wamid.HBgLMTU1NTEyMzQ1Njc='
          },
          {
            senderType: 'SYSTEM',
            senderName: 'Auto-Acknowledgement Bot',
            channel: 'WHATSAPP',
            body: 'We have received your support request. Your Ticket ID is #TIC-1001. Our support team will contact you within a few hours.'
          },
          {
            senderType: 'AGENT',
            senderName: agent2.fullName,
            senderEmail: agent2.email,
            channel: 'WHATSAPP',
            body: 'Hello David, Marcus from Network Support here. I checked our gateway logs and see a DTLS MTU mismatch for your home ISP subnet. I have temporarily forced TLS mode on your profile. Could you please reconnect and let me know if it holds stable?'
          }
        ]
      },
      notes: {
        create: [
          {
            authorId: agent2.id,
            content: 'Customer is on Comcast residential with 1420 MTU. Switched client profile to TLS fallback to avoid UDP fragmentation.'
          }
        ]
      },
      auditLogs: {
        create: [
          { actorName: 'AI Classification Engine', action: 'AI_DETECTED', details: 'Classified as NETWORK with HIGH priority' },
          { actorName: 'System', action: 'CREATED', details: 'Ticket created via WhatsApp' },
          { actorName: 'System Bot', action: 'ACKNOWLEDGEMENT_SENT', details: 'Receipt confirmation sent to +15551234567' },
          { actorName: agent2.fullName, action: 'ASSIGNED', details: 'Self-assigned ticket' },
          { actorName: agent2.fullName, action: 'STATUS_CHANGED', fieldChanged: 'status', oldValue: 'ASSIGNED', newValue: 'IN_PROGRESS' }
        ]
      }
    }
  });

  // Ticket 2: Email - Critical Production Outage (Open)
  const ticket2 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TIC-1002',
      title: 'CRITICAL: Production ERP Database timeout affecting billing batch runs',
      description: 'Emergency: The overnight billing pipeline is failing with PostgreSQL deadlocks and connection pool exhaustion (500 Internal Server Error on ERP Portal). Operations are halted until this is cleared.',
      status: 'OPEN',
      priority: 'CRITICAL',
      category: 'SOFTWARE',
      channel: 'EMAIL',
      sourceIdentifier: customer2.email,
      aiExtracted: true,
      aiConfidence: 0.98,
      aiSummary: 'Critical production database lockup impacting ERP billing operations. Immediate DBA intervention required.',
      sentiment: 'URGENT',
      customerId: customer2.id,
      slaResponseDue: new Date(now.getTime() + 1 * 3600 * 1000),
      slaResolutionDue: new Date(now.getTime() + 4 * 3600 * 1000),
      messages: {
        create: [
          {
            senderType: 'CUSTOMER',
            senderName: customer2.name,
            senderEmail: customer2.email,
            channel: 'EMAIL',
            body: 'Emergency: The overnight billing pipeline is failing with PostgreSQL deadlocks and connection pool exhaustion (500 Internal Server Error on ERP Portal). Operations are halted until this is cleared.',
            externalMessageId: '<ERP-ALERT-20261103@sterlingcorp.com>'
          },
          {
            senderType: 'SYSTEM',
            senderName: 'Auto-Acknowledgement Bot',
            channel: 'EMAIL',
            body: 'We have received your support request. Your Ticket ID is #TIC-1002. Our support team will contact you within a few hours.'
          }
        ]
      },
      auditLogs: {
        create: [
          { actorName: 'AI Classification Engine', action: 'AI_DETECTED', details: 'Classified as SOFTWARE with CRITICAL priority and URGENT sentiment' },
          { actorName: 'System', action: 'CREATED', details: 'Ticket created via Email' },
          { actorName: 'System Bot', action: 'ACKNOWLEDGEMENT_SENT', details: 'Sent receipt email to emily.watson@sterlingcorp.com' }
        ]
      }
    }
  });

  // Ticket 3: WhatsApp - Hardware display issue (Assigned to Sarah Chen)
  const ticket3 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TIC-1003',
      title: 'ThinkPad docking station dual-monitor display not recognized',
      description: 'Good morning, my external Dell 27-inch monitors connected via the Lenovo Thunderbolt Dock stopped receiving video signal after rebooting today. USB peripherals plugged into the dock are working fine.',
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      category: 'HARDWARE',
      channel: 'WHATSAPP',
      sourceIdentifier: customer3.phone,
      aiExtracted: true,
      aiConfidence: 0.91,
      aiSummary: 'DisplayPort / HDMI video output failure on Lenovo Thunderbolt Dock with functional USB pass-through.',
      sentiment: 'CALM',
      customerId: customer3.id,
      assignedToId: agent1.id,
      slaResponseDue: new Date(now.getTime() + 4 * 3600 * 1000),
      slaResolutionDue: new Date(now.getTime() + 24 * 3600 * 1000),
      messages: {
        create: [
          {
            senderType: 'CUSTOMER',
            senderName: customer3.name,
            senderPhone: customer3.phone,
            channel: 'WHATSAPP',
            body: 'Good morning, my external Dell 27-inch monitors connected via the Lenovo Thunderbolt Dock stopped receiving video signal after rebooting today. USB peripherals plugged into the dock are working fine.',
            externalMessageId: 'wamid.HBgMNDQ3NzAwOTAwMTIz'
          },
          {
            senderType: 'SYSTEM',
            senderName: 'Auto-Acknowledgement Bot',
            channel: 'WHATSAPP',
            body: 'We have received your support request. Your Ticket ID is #TIC-1003. Our support team will contact you within a few hours.'
          }
        ]
      },
      auditLogs: {
        create: [
          { actorName: 'AI Classification Engine', action: 'AI_DETECTED', details: 'Classified as HARDWARE with MEDIUM priority' },
          { actorName: 'System', action: 'CREATED', details: 'Ticket created via WhatsApp' },
          { actorName: 'Alex Reynolds (Admin)', action: 'ASSIGNED', details: 'Assigned to Sarah Chen' }
        ]
      }
    }
  });

  // Ticket 4: Email - Account Access Password Reset (Resolved)
  const ticket4 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TIC-1004',
      title: 'Urgent: Locked out of Okta 2FA after changing phone',
      description: 'Hi IT Desk, I upgraded to a new mobile phone yesterday and no longer have access to my Okta Verify push notifications for Nexus AI single sign-on. Need a temporary bypass code or authenticator reset.',
      status: 'RESOLVED',
      priority: 'HIGH',
      category: 'ACCOUNT_ACCESS',
      channel: 'EMAIL',
      sourceIdentifier: customer4.email,
      aiExtracted: true,
      aiConfidence: 0.96,
      aiSummary: 'Customer replaced mobile device and is locked out of MFA / Okta Verify.',
      sentiment: 'URGENT',
      customerId: customer4.id,
      assignedToId: agent3.id,
      resolvedAt: new Date(now.getTime() - 30 * 60 * 1000),
      resolutionNotes: 'Verified employee identity via secondary manager confirmation. Reset Okta MFA factor and assisted with QR re-enrollment.',
      messages: {
        create: [
          {
            senderType: 'CUSTOMER',
            senderName: customer4.name,
            senderEmail: customer4.email,
            channel: 'EMAIL',
            body: 'Hi IT Desk, I upgraded to a new mobile phone yesterday and no longer have access to my Okta Verify push notifications for Nexus AI single sign-on. Need a temporary bypass code or authenticator reset.',
            externalMessageId: '<OKTA-RESET-20261103@nexusai.io>'
          },
          {
            senderType: 'SYSTEM',
            senderName: 'Auto-Acknowledgement Bot',
            channel: 'EMAIL',
            body: 'We have received your support request. Your Ticket ID is #TIC-1004. Our support team will contact you within a few hours.'
          },
          {
            senderType: 'AGENT',
            senderName: agent3.fullName,
            senderEmail: agent3.email,
            channel: 'EMAIL',
            body: 'Hello Sophia, I have generated an activation link for your new phone and reset your Okta MFA profile. You should receive an enrollment email shortly. Please reply once complete.'
          },
          {
            senderType: 'CUSTOMER',
            senderName: customer4.name,
            senderEmail: customer4.email,
            channel: 'EMAIL',
            body: 'Worked like a charm! Successfully logged into all tools. Thank you so much for the quick turnaround!'
          }
        ]
      },
      auditLogs: {
        create: [
          { actorName: 'AI Classification Engine', action: 'AI_DETECTED', details: 'Classified as ACCOUNT_ACCESS with HIGH priority' },
          { actorName: agent3.fullName, action: 'STATUS_CHANGED', fieldChanged: 'status', oldValue: 'IN_PROGRESS', newValue: 'RESOLVED', details: 'Verified ID and reset MFA factor.' }
        ]
      }
    }
  });

  // Ticket 5: Email - New Ticket
  const ticket5 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TIC-1005',
      title: 'Inquiry regarding additional Figma & JetBrains software licenses',
      description: 'Hello, our design engineering team is onboarding 3 new contract developers starting next Monday. We need quote details and procurement approval workflow for JetBrains All Products Pack and Figma Enterprise seats.',
      status: 'NEW',
      priority: 'LOW',
      category: 'BILLING',
      channel: 'EMAIL',
      sourceIdentifier: customer2.email,
      aiExtracted: true,
      aiConfidence: 0.88,
      aiSummary: 'License procurement request for JetBrains and Figma seats for 3 onboarding contractors.',
      sentiment: 'CALM',
      customerId: customer2.id,
      messages: {
        create: [
          {
            senderType: 'CUSTOMER',
            senderName: customer2.name,
            senderEmail: customer2.email,
            channel: 'EMAIL',
            body: 'Hello, our design engineering team is onboarding 3 new contract developers starting next Monday. We need quote details and procurement approval workflow for JetBrains All Products Pack and Figma Enterprise seats.',
            externalMessageId: '<LIC-QUOTE-REQ-1005@sterlingcorp.com>'
          },
          {
            senderType: 'SYSTEM',
            senderName: 'Auto-Acknowledgement Bot',
            channel: 'EMAIL',
            body: 'We have received your support request. Your Ticket ID is #TIC-1005. Our support team will contact you within a few hours.'
          }
        ]
      },
      auditLogs: {
        create: [
          { actorName: 'AI Classification Engine', action: 'AI_DETECTED', details: 'Classified as BILLING with LOW priority' },
          { actorName: 'System', action: 'CREATED', details: 'Ticket created via Email' }
        ]
      }
    }
  });

  console.log('[Seed] Created 5 sample Tickets with messages, notes, and audit logs');
  console.log('[Seed] Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

