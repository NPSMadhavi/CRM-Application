# CRM-Application — OmniDesk IT Support & Ticket Management CRM

A production-ready **Customer IT Support & Ticket Management CRM** built with **React.js (TypeScript + Tailwind CSS)**, **Node.js (Express.js ES Modules)**, and **PostgreSQL with Prisma ORM**.

Includes automatic ticket creation via **WhatsApp Business Cloud API** and **Email (IMAP/SMTP/Webhooks)**, **AI-powered entity extraction and categorization**, **automated customer acknowledgements**, **Socket.IO real-time dashboard notifications**, and a **built-in interactive channel simulator**.

---

## 🌟 Core Features Implemented

### 1. ⚡ Automatic Ticket Creation
- **WhatsApp Business API**: Webhook endpoint (`GET /api/webhooks/whatsapp` for Meta challenge verification and `POST /api/webhooks/whatsapp` for incoming messages). Captures text, documents, images, sender phone, profile name, and message IDs.
- **Email Ingestion**: Inbound webhook (`POST /api/webhooks/email`), IMAP email polling support, and outbound SMTP via Nodemailer.
- **Configurable**: Environment-variable driven with graceful local development simulation fallbacks.

### 2. 🧠 AI-Powered Ticket Detection
- **Entity Extraction**: Automatically extracts customer name, email, phone number, clean title, and technical issue description from unstructured incoming messages.
- **Smart Categorization**: Classifies into `HARDWARE`, `SOFTWARE`, `NETWORK`, `ACCOUNT_ACCESS`, `BILLING`, `GENERAL_INQUIRY`.
- **Urgency & Priority**: Detects `CRITICAL` (production down, server outage), `HIGH`, `MEDIUM`, `LOW`.
- **Sentiment & Intent**: Analyzes customer tone (`URGENT`, `ANGRY`, `FRUSTRATED`, `CALM`) and computes an AI confidence score.
- **Dual-Mode Engine**: Powered by Google Gemini API (`GEMINI_API_KEY`) with an integrated deterministic NLP rule engine as a zero-downtime offline fallback.

### 3. ✉️ Automatic Customer Acknowledgement
- Automatically responds immediately on ticket creation via the customer's incoming channel (WhatsApp or Email):
  > *"We have received your support request. Your Ticket ID is #TIC-XXXX. Our support team will contact you within a few hours."*
- Logs the acknowledgement into the ticket's conversation history so agents know the customer was notified.

### 4. 📊 Agent Dashboard & Real-Time Stats
- Live counters for **Active Workload**, **New**, **Open**, **In Progress**, **Waiting for Customer**, **Resolved**, and **Closed**.
- Priority breakdown (Critical, High, Medium, Low) and channel distribution (WhatsApp, Email, Portal).
- **SLA Tracking**: Real-time compliance rate, target response time countdown, and breach indicators.

### 5. 👥 Agent Management & RBAC
- JWT authentication with secure password hashing (`bcryptjs`).
- Role-based permissions: `ADMIN`, `TIER_1_AGENT`, `TIER_2_AGENT`, `AGENT`.
- One-click ticket self-assignment ("Assign to Me") and reassignment between team members.

### 6. 🔄 Complete Ticket Lifecycle
- Supported statuses: `NEW` ➔ `OPEN` ➔ `ASSIGNED` ➔ `IN_PROGRESS` ➔ `WAITING_FOR_CUSTOMER` ➔ `RESOLVED` ➔ `CLOSED`.
- Validation checks, resolution notes recording on resolve, and timestamp auditing (`firstResponseAt`, `resolvedAt`, `closedAt`).
- Distinct **Internal Notes** (marked with private lock, visible only to support staff) vs **Customer Replies**.

### 7. 👤 Customer Management
- Complete customer directory: Name, Email, Phone, Company, VIP badge.
- Customer profile drawer with lifetime ticket history and unified multi-channel communication history.

### 8. 🔍 Interactive Ticket Details View
- Full conversation history (customer messages, auto-acknowledgements, agent replies).
- AI extraction insights card displaying extracted parameters, sentiment, confidence, and executive summary.
- Response composer supporting WhatsApp & Email switching and **quick canned reply templates** (e.g. requesting logs, investigating with Level 2, resolution confirmation).
- Timestamped audit log trail tracking every field change and actor.

### 9. 🔔 Real-Time Notifications (Socket.IO)
- Instant browser notifications on new incoming tickets, ticket status changes, and incoming customer replies.
- Interactive notification center dropdown with unread badge counter.

### 10. ☀️ Dark Theme & White Theme Modes
- Full-suite dark mode and clean white/light theme toggling with smooth transitions.
- Quick theme toggle buttons in the Top Navigation, Sidebar, and Login screen.
- User theme preference automatically persisted in `localStorage`.

### 11. 🛡️ Deduplication Protection
- Deduplicates incoming messages using external message IDs (`externalMessageId` / WhatsApp Message ID / Email Message-ID).
- **Conversation Threading**: When an existing customer sends follow-up messages while having an active open ticket, the system automatically appends the message to the active ticket thread instead of creating duplicate tickets.

### 12. 📻 Built-in Inbound Channel Simulator
- Dedicated tab in the CRM UI allowing agents and admins to test and demo incoming WhatsApp messages and emails interactively.
- Includes pre-built scenarios (Critical VPN Outage, Hardware Display Failure, Account Lockout, and Deduplication test).

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript (TSX), Tailwind CSS, Lucide Icons, Socket.IO Client, Axios |
| **Backend** | Node.js (ES Modules `"type": "module"`), Express.js, Socket.IO, Nodemailer, Axios |
| **Database & ORM** | PostgreSQL with Prisma ORM (with zero-config SQLite option for instant testing) |
| **Deployment** | Docker & Docker Compose (`docker-compose.yml`) |

---

## 🚀 Quick Start Guide

### Option 1: Run with Docker Compose (PostgreSQL included)

```bash
docker-compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Adminer (Database UI): `http://localhost:8080` (System: PostgreSQL, Server: postgres, User: postgres, Password: postgrespassword, Database: crm_db)

---

### Option 2: Local Development (Instant Zero-Config Mode)

The project includes an automatic database setup script that seeds realistic demo tickets and agents out of the box.

#### 1. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### 2. Initialize Database & Seed Sample Data
```bash
cd ../backend
node prisma/setup-db.js
```
*(This creates `dev.db`, generates the Prisma Client, and seeds sample tickets, customers, and agents)*

#### 3. Start Backend Server
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

#### 4. Start Frontend
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

---

## 🔑 Pre-Seeded Demo Accounts

You can log in using any of the following pre-configured credentials (or use the **One-Click Demo Role** buttons on the login screen):

| Role | Email | Password | Access Level |
|---|---|---|---|
| **System Admin** | `admin@crm.local` | `admin123` | Full access (Agent management, all tickets, settings) |
| **Tier 2 Agent** | `marcus.vance@crm.local` | `agent123` | Network & Infrastructure tickets, assignment, resolution |
| **Tier 1 Agent** | `sarah.chen@crm.local` | `agent123` | Helpdesk & Client Support queue |
| **Support Agent** | `elena.rostova@crm.local` | `agent123` | Application Support queue |

---

## 🔌 API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Agent & Admin authentication
- `POST /api/auth/register` - Create new agent
- `GET /api/auth/me` - Current user profile and active workload

### Tickets
- `GET /api/tickets` - List tickets with filtering (`status`, `priority`, `category`, `channel`, `assignedToId`, `search`)
- `POST /api/tickets` - Create manual ticket
- `GET /api/tickets/:id` - Complete ticket conversation, notes, and audit trail
- `PATCH /api/tickets/:id/status` - Lifecycle status transition
- `PATCH /api/tickets/:id/assign` - Agent assignment / self-assignment
- `POST /api/tickets/:id/reply` - Send agent reply via WhatsApp or Email
- `POST /api/tickets/:id/note` - Add private internal agent note
- `GET /api/tickets/:id/audit-logs` - Ticket history

### Customers
- `GET /api/customers` - List customers with ticket counts
- `GET /api/customers/:id` - Customer profile, lifetime tickets, and communication history
- `POST /api/customers` - Create customer profile
- `PUT /api/customers/:id` - Update customer details

### Webhooks & Channel Ingestion
- `GET /api/webhooks/whatsapp` - Meta WhatsApp Cloud API challenge verification
- `POST /api/webhooks/whatsapp` - Inbound WhatsApp message receiver
- `POST /api/webhooks/email` - Inbound Email webhook receiver
- `POST /api/webhooks/simulate` - Interactive channel message simulation endpoint
- `GET /api/webhooks/logs` - Recent webhook ingestion audit logs

### Analytics
- `GET /api/analytics/dashboard` - Dashboard KPIs, SLA compliance %, category breakdown, recent activity

---

## ⚙️ Environment Configuration (`.env`)

```ini
PORT=5000
NODE_ENV=development

# PostgreSQL connection string (or file:./dev.db for SQLite)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_db?schema=public"

# JWT Secret Key
JWT_SECRET="crm_jwt_super_secret_production_key_2026"

# Frontend Origin for CORS & WebSockets
FRONTEND_URL="http://localhost:5173"

# WhatsApp Business Cloud API
WHATSAPP_VERIFY_TOKEN="crm_wa_verify_token_secure_xyz"
WHATSAPP_API_TOKEN="your_meta_whatsapp_cloud_api_token"
WHATSAPP_PHONE_NUMBER_ID="your_whatsapp_phone_number_id"

# Email Inbound & Outbound (IMAP & SMTP)
EMAIL_INBOUND_ENABLED=true
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="mailtrap_user"
SMTP_PASS="mailtrap_pass"
SMTP_FROM="IT Support Desk <support@example.com>"

# AI Classification (Optional - falls back to robust internal NLP engine)
GEMINI_API_KEY=""
```

