export type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TicketCategory =
  | 'HARDWARE'
  | 'SOFTWARE'
  | 'NETWORK'
  | 'ACCOUNT_ACCESS'
  | 'BILLING'
  | 'GENERAL_INQUIRY';

export type Channel = 'WHATSAPP' | 'EMAIL' | 'PORTAL';

export type UserRole = 'ADMIN' | 'TIER_1_AGENT' | 'TIER_2_AGENT' | 'AGENT';

export type Sentiment = 'CALM' | 'FRUSTRATED' | 'ANGRY' | 'URGENT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  department?: string;
  avatarUrl?: string;
  phone?: string;
  isActive?: boolean;
  activeTicketCount?: number;
  assignedActiveTickets?: number;
}

export interface SupportPlanMetrics {
  planType: string;
  planName: string;
  allocatedHours: number;
  usedHours: number;
  remainingHours: number;
  usagePercentage: number;
  isDepleted: boolean;
  isLow: boolean;
  overageHours: number;
  overageAmount: number;
  hourlyRate: number;
  workingHoursWindow: string;
  isWithinWorkingHours: boolean;
  workingHoursNote: string;
}

export interface TicketWorkLog {
  id: string;
  ticketId: string;
  agentId?: string;
  agentName: string;
  durationHours: number;
  description: string;
  isBillable: boolean;
  createdAt: string;
}

export interface SupportPlanConfig {
  code: string;
  name: string;
  description: string;
  hoursIncluded: number;
  hourlyRate: number;
  price: number;
  isAdhoc: boolean;
  workingHoursWindow: string;
  workingHoursLabel: string;
  slaResponseHours: number;
  slaResolutionHours: number;
  status?: {
    isOpen: boolean;
    message: string;
  };
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  isVip: boolean;
  avatarUrl?: string;
  notes?: string;
  sourceChannel: Channel;
  supportPlanType?: string;
  supportPlanName?: string;
  allocatedHours?: number;
  usedHours?: number;
  hourlyRate?: number;
  workingHoursWindow?: string;
  planStatus?: string;
  planRenewalDate?: string;
  planMetrics?: SupportPlanMetrics;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tickets: number;
  };
  tickets?: Ticket[];
  recentCommunications?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  channel: Channel | 'INTERNAL';
  body: string;
  externalMessageId?: string;
  attachments?: string;
  createdAt: string;
}

export interface TicketNote {
  id: string;
  ticketId: string;
  authorId: string;
  author: {
    id: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
  };
  content: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface TicketAuditLog {
  id: string;
  ticketId: string;
  actorId?: string;
  actorName: string;
  action: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    role: string;
  };
  ticket?: {
    ticketNumber: string;
    title: string;
    priority: TicketPriority;
  };
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  channel: Channel;
  sourceIdentifier?: string;
  aiExtracted: boolean;
  aiConfidence?: number;
  aiSummary?: string;
  sentiment: Sentiment;
  customerId: string;
  customer: Customer;
  assignedToId?: string;
  assignedTo?: User;
  resolutionNotes?: string;
  resolvedAt?: string;
  closedAt?: string;
  firstResponseAt?: string;
  slaBreached: boolean;
  slaResponseDue?: string;
  slaResolutionDue?: string;
  totalTimeHours?: number;
  workLogs?: TicketWorkLog[];
  messages?: TicketMessage[];
  notes?: TicketNote[];
  auditLogs?: TicketAuditLog[];
  _count?: {
    messages: number;
    notes: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  counts: {
    total: number;
    active: number;
    new: number;
    open: number;
    inProgress: number;
    waitingForCustomer: number;
    resolved: number;
    closed: number;
    customers: number;
    agents: number;
  };
  priorities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  channels: {
    whatsapp: number;
    email: number;
    portal: number;
  };
  sla: {
    breachedCount: number;
    onTrackCount: number;
    complianceRate: number;
  };
  categoryDistribution: Array<{
    category: TicketCategory;
    count: number;
  }>;
  recentActivity: TicketAuditLog[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  ticketId?: string;
  isRead: boolean;
  createdAt: string;
}

