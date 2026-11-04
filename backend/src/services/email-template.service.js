/**
 * EmailTemplateService
 * Generates responsive, professional HTML email templates and plain-text alternatives
 * for Outgoing Agent Replies and Automated Acknowledgements.
 */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTextToHtml(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br/>');
}

/**
 * Professional Agent Reply Email Template
 */
export function generateAgentReplyEmail({ ticket, customer, agent, responseText }) {
  const customerName = customer?.name || 'Valued Customer';
  const ticketNumber = ticket?.ticketNumber || 'TIC-XXXX';
  const ticketTitle = ticket?.title || 'Support Request';
  const agentName = agent?.fullName || 'Support Engineer';
  const subject = `Re: [${ticketNumber}] ${ticketTitle}`;

  const formattedResponse = formatTextToHtml(responseText);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 24px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 24px 32px;
      color: #ffffff;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
      color: #ffffff;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
      margin-bottom: 0;
    }
    .ticket-bar {
      background-color: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 32px;
      font-size: 12px;
      color: #475569;
    }
    .ticket-bar strong {
      color: #0f172a;
    }
    .ticket-badge {
      display: inline-block;
      background-color: #e0e7ff;
      color: #3730a3;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-right: 8px;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      font-size: 14px;
      color: #334155;
    }
    .greeting {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #0f172a;
    }
    .message-body {
      background-color: #ffffff;
      margin: 16px 0;
      color: #1e293b;
      font-size: 14px;
      line-height: 1.65;
    }
    .agent-signoff {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
      font-size: 13px;
      color: #64748b;
    }
    .agent-name {
      font-weight: 600;
      color: #0f172a;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .reply-hint {
      background-color: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
      color: #065f46;
      font-size: 12px;
    }
    .reply-hint strong {
      color: #047857;
    }
    .copyright {
      margin-top: 8px;
      font-size: 11px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Enterprise CRM Support</h1>
      <p class="brand-subtitle">Customer Support Team</p>
    </div>
    <div class="ticket-bar">
      <span class="ticket-badge">${escapeHtml(ticketNumber)}</span>
      <strong>Subject:</strong> ${escapeHtml(ticketTitle)}
    </div>
    <div class="content">
      <div class="greeting">Hello ${escapeHtml(customerName)},</div>
      <div class="message-body">
        ${formattedResponse}
      </div>
      <div class="agent-signoff">
        Best regards,<br/>
        <span class="agent-name">${escapeHtml(agentName)}</span><br/>
        Enterprise CRM Support Desk
      </div>
    </div>
    <div class="footer">
      <div class="reply-hint">
        <strong>Direct Reply Enabled:</strong> Please reply directly to this email to continue the conversation. Your reply will be automatically attached to support ticket #${escapeHtml(ticketNumber)}.
      </div>
      <div>Thank you for contacting Enterprise CRM Support.</div>
      <div class="copyright">&copy; ${new Date().getFullYear()} Enterprise CRM Support. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  const text = `Enterprise CRM Support
Customer Support Team
==================================================
Ticket ID: #${ticketNumber}
Subject: ${ticketTitle}
==================================================

Hello ${customerName},

${responseText}

Best regards,
${agentName}
Enterprise CRM Support Desk

--------------------------------------------------
Please reply directly to this email if you need further assistance.
Your reply will be automatically linked to support ticket #${ticketNumber}.
`;

  return { subject, html, text };
}

/**
 * Professional Automated Acknowledgement Email Template
 */
export function generateAcknowledgementEmail({ ticket, customer }) {
  const customerName = customer?.name || 'Valued Customer';
  const ticketNumber = ticket?.ticketNumber || 'TIC-XXXX';
  const ticketTitle = ticket?.title || 'Support Request';
  const subject = `[CRM] Support Request Received — #${ticketNumber}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 24px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 24px 32px;
      color: #ffffff;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
      color: #ffffff;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
      margin-bottom: 0;
    }
    .ticket-bar {
      background-color: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 14px 32px;
      font-size: 13px;
      color: #334155;
    }
    .ticket-badge {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 8px;
    }
    .content {
      padding: 32px;
      line-height: 1.6;
      font-size: 14px;
      color: #334155;
    }
    .greeting {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #0f172a;
    }
    .info-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #3b82f6;
      border-radius: 6px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .info-row {
      margin: 6px 0;
      font-size: 13px;
    }
    .info-label {
      font-weight: 600;
      color: #475569;
      display: inline-block;
      width: 110px;
    }
    .info-value {
      color: #0f172a;
      font-weight: 500;
    }
    .signoff {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
      font-size: 13px;
      color: #64748b;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
    .reply-hint {
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
      color: #1e40af;
      font-size: 12px;
    }
    .reply-hint strong {
      color: #1d4ed8;
    }
    .copyright {
      margin-top: 8px;
      font-size: 11px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Enterprise CRM Support</h1>
      <p class="brand-subtitle">Customer Support Desk</p>
    </div>
    <div class="ticket-bar">
      <span class="ticket-badge">#${escapeHtml(ticketNumber)}</span>
      <strong>Support Request Registered</strong>
    </div>
    <div class="content">
      <div class="greeting">Hello ${escapeHtml(customerName)},</div>
      <p>Thank you for contacting Enterprise CRM Support.</p>
      <p>We have successfully received your support request.</p>
      
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Your Ticket ID:</span>
          <span class="info-value">#${escapeHtml(ticketNumber)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Subject:</span>
          <span class="info-value">${escapeHtml(ticketTitle)}</span>
        </div>
      </div>

      <p>Our support team will review your request and get back to you shortly.</p>

      <div class="signoff">
        Best regards,<br/>
        <strong>Enterprise CRM Support</strong><br/>
        IT Support Team
      </div>
    </div>
    <div class="footer">
      <div class="reply-hint">
        <strong>Direct Reply Enabled:</strong> You can reply directly to this email to continue the conversation. Your reply will automatically be added to the same support ticket.
      </div>
      <div>Enterprise CRM Support Team</div>
      <div class="copyright">&copy; ${new Date().getFullYear()} Enterprise CRM Support. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  const text = `Hello ${customerName},

Thank you for contacting Enterprise CRM Support.

We have successfully received your support request.

Your Ticket ID: #${ticketNumber}
Subject: ${ticketTitle}

Our support team will review your request and get back to you shortly.

You can reply directly to this email to continue the conversation. Your reply will automatically be added to the same support ticket.

Best regards,
Enterprise CRM Support
IT Support Team
`;

  return { subject, html, text };
}
