/**
 * EmailReplyParserService
 * Intelligently extracts the newly written customer response from incoming email replies,
 * removing quoted history from Gmail, Outlook, Apple Mail, and standard email clients,
 * while preserving legitimate content, paragraphs, line breaks, and unicode characters.
 */

/**
 * Remove HTML quoted reply containers (Gmail, Outlook, Apple Mail, Yahoo)
 */
export function stripHtmlQuotes(html) {
  if (!html || typeof html !== 'string') return '';

  let cleaned = html;

  // 1. Remove Gmail quote blocks
  cleaned = cleaned.replace(/<div\s+class=["']gmail_quote["'][\s\S]*$/i, '');
  cleaned = cleaned.replace(/<blockquote\s+class=["']gmail_quote["'][\s\S]*$/i, '');
  cleaned = cleaned.replace(/<div\s+class=["']gmail_attr["'][\s\S]*$/i, '');

  // 2. Remove Outlook / Office 365 reply headers and dividers
  cleaned = cleaned.replace(/<div\s+id=["']divRplyFwdMsg["'][\s\S]*$/i, '');
  cleaned = cleaned.replace(/<div\s+id=["']appendonsend["'][\s\S]*$/i, '');
  cleaned = cleaned.replace(/<hr\s+[^>]*id=["']stopSpelling["'][\s\S]*$/i, '');
  cleaned = cleaned.replace(/<hr\s+style=["'][^"']*display:\s*inline-block;\s*width:\s*98%[^"']*["'][\s\S]*$/i, '');
  cleaned = cleaned.replace(/<div\s+style=["']border-top:\s*solid\s*#B5C4DF[\s\S]*$/i, '');

  // 3. Remove Apple Mail quote containers
  cleaned = cleaned.replace(/<blockquote\s+type=["']cite["'][\s\S]*$/i, '');

  // 4. Convert HTML line breaks to newlines and strip remaining tags
  cleaned = cleaned
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return cleaned.trim();
}

/**
 * Patterns matching standard email client reply separators in plain text
 */
const REPLY_HEADER_PATTERNS = [
  // 1. Gmail / Apple Mail format: "On Wed, Nov 4, 2026 at 10:01 AM Enterprise CRM Support <chandra2001ks@gmail.com> wrote:"
  /(?:\r?\n|^)\s*On\s+[A-Za-z]{3,9},?\s+[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4},?\s+at\s+[\d:]+\s*(?:AM|PM|am|pm)?.*?wrote:\s*$/im,
  /(?:\r?\n|^)\s*On\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4},?\s+at\s+[\d:]+.*?wrote:\s*$/im,
  /(?:\r?\n|^)\s*On\s+.+?,\s+.+?\s+wrote:\s*$/im,
  /(?:\r?\n|^)\s*On\s+.+?wrote:\s*$/im,

  // 2. Outlook / Thunderbird / Windows Mail format: "-----Original Message-----"
  /(?:\r?\n|^)\s*-{3,}\s*Original Message\s*-{3,}/im,
  /(?:\r?\n|^)\s*_{10,}\s*$/m,
  /(?:\r?\n|^)\s*-{5,}\s*$/m,

  // 3. Outlook header block: "From: ... \nSent: ... \nTo: ... \nSubject: ..."
  /(?:\r?\n|^)\s*From:\s+.*(?:\r?\n)\s*(?:Sent|Date):\s+.*(?:\r?\n)\s*To:\s+.*(?:\r?\n)\s*Subject:\s+.*/im,

  // 4. Apple Mail mobile header
  /(?:\r?\n|^)\s*Begin forwarded message:\s*$/im
];

/**
 * Extract clean customer reply text from incoming email body.
 * Strips quoted history and email headers while preserving the customer's response.
 */
export function extractCleanReply(bodyText, bodyHtml) {
  let candidate = '';

  // Step 1: If HTML exists, try extracting clean text by removing known quote HTML containers
  if (bodyHtml) {
    const strippedHtml = stripHtmlQuotes(bodyHtml);
    if (strippedHtml && strippedHtml.trim().length > 0) {
      candidate = strippedHtml;
    }
  }

  // Step 2: If HTML didn't produce a candidate or text is provided, work on plain text
  if (!candidate && bodyText) {
    candidate = bodyText;
  } else if (!candidate) {
    return '';
  }

  // Step 3: Check for text reply header patterns
  for (const pattern of REPLY_HEADER_PATTERNS) {
    const match = candidate.match(pattern);
    if (match && match.index !== undefined) {
      const precedingText = candidate.substring(0, match.index).trim();
      if (precedingText.length > 0) {
        candidate = precedingText;
        break;
      }
    }
  }

  // Step 4: Remove trailing quoted lines (lines starting with '>')
  const lines = candidate.split(/\r?\n/);
  const cleanLines = [];
  let foundQuotedBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isQuoted = /^\s*>/.test(line);

    if (isQuoted) {
      // If we encounter quoted lines at the bottom of the reply, exclude them
      foundQuotedBlock = true;
      continue;
    }

    if (foundQuotedBlock) {
      // Check if this is just trailing whitespace or another quoted block
      if (line.trim().length === 0) continue;
      // If there is substantial unquoted text after a quoted block, it might be inline replies
      cleanLines.push(line);
      foundQuotedBlock = false;
    } else {
      cleanLines.push(line);
    }
  }

  let finalResult = cleanLines.join('\n').trim();

  // Step 5: Safety fallback: if our stripping accidentally removed everything,
  // return the original text trimmed so no customer message is lost
  if (!finalResult || finalResult.length === 0) {
    finalResult = (bodyText || '').trim();
  }

  return finalResult;
}
