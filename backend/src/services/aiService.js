import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * AI-Powered Ticket Detection Service
 * Extracts customer name, email, phone, issue description, category, priority, and sentiment.
 * Works with Google Gemini API when configured, with a smart deterministic NLP engine as reliable fallback.
 */

export async function detectTicketDetails(rawMessage, senderMeta = {}) {
  const text = (typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage)).trim();

  // Try Gemini API if API key is present
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    try {
      const geminiResult = await extractWithGemini(text, senderMeta);
      if (geminiResult) {
        logger.info('[AI Service] Successfully extracted details using Gemini API');
        return geminiResult;
      }
    } catch (err) {
      logger.warn('[AI Service] Gemini API failed, falling back to local NLP engine:', err.message);
    }
  }

  // Fallback to internal rule-based entity & intent extractor
  return extractWithNLP(text, senderMeta);
}

/**
 * Call Gemini API with structured JSON output instructions
 */
async function extractWithGemini(text, senderMeta) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt = `You are an expert IT Support Ticket Classifier.
Analyze the following customer support message and extract ticket details into valid JSON.
Sender metadata: ${JSON.stringify(senderMeta)}

Customer message:
"""
${text}
"""

Return ONLY a JSON object with this exact structure:
{
  "customerName": "extracted or known name",
  "customerEmail": "extracted or known email",
  "customerPhone": "extracted or known phone",
  "title": "Concise issue summary (max 10 words)",
  "description": "Cleaned description of the technical issue",
  "category": "HARDWARE" | "SOFTWARE" | "NETWORK" | "ACCOUNT_ACCESS" | "BILLING" | "GENERAL_INQUIRY",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "sentiment": "CALM" | "FRUSTRATED" | "ANGRY" | "URGENT",
  "aiConfidence": 0.95,
  "summary": "1-2 sentence technical summary of the request"
}`;

  const response = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    },
    { timeout: 8000 }
  );

  const rawJson = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) return null;

  const parsed = JSON.parse(rawJson);
  return normalizeExtractedResult(parsed, text, senderMeta);
}

/**
 * Advanced local NLP Entity and Intent Extractor
 */
function extractWithNLP(text, senderMeta = {}) {
  // 1. Extract Email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i;
  const emailMatch = text.match(emailRegex);
  const detectedEmail = senderMeta.email || (emailMatch ? emailMatch[0] : null);

  // 2. Extract Phone
  const phoneRegex = /(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d]{3}[-.\s]?[\d]{4}/;
  const phoneMatch = text.match(phoneRegex);
  const detectedPhone = senderMeta.phone || (phoneMatch ? phoneMatch[0].trim() : null);

  // 3. Extract Name
  let detectedName = senderMeta.name;
  if (!detectedName) {
    const nameIntroRegex = /(?:my name is|this is|i am|i'm|from:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const signoffRegex = /(?:thanks|regards|sincerely|cheers|best|thank you)[,\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;

    const introMatch = text.match(nameIntroRegex);
    const signoffMatch = text.match(signoffRegex);

    if (introMatch && introMatch[1]) {
      detectedName = introMatch[1].trim();
    } else if (signoffMatch && signoffMatch[1]) {
      detectedName = signoffMatch[1].trim();
    } else if (detectedEmail) {
      // derive from email e.g. john.doe@example.com -> John Doe
      const localPart = detectedEmail.split('@')[0];
      detectedName = localPart
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    } else {
      detectedName = 'Support Customer';
    }
  }

  // 4. Classify Category
  const lowerText = text.toLowerCase();
  let category = 'GENERAL_INQUIRY';

  const categoryScores = {
    HARDWARE: 0,
    SOFTWARE: 0,
    NETWORK: 0,
    ACCOUNT_ACCESS: 0,
    BILLING: 0,
    GENERAL_INQUIRY: 1
  };

  const keywords = {
    ACCOUNT_ACCESS: ['password', 'login', 'lockout', 'locked', '2fa', 'mfa', 'authenticate', 'reset password', 'credentials', 'access denied', 'permission', 'sign in', 'sso'],
    NETWORK: ['vpn', 'wifi', 'wi-fi', 'internet', 'network', 'router', 'dns', 'firewall', 'slow connection', 'latency', 'disconnecting', 'ping', 'ip address'],
    HARDWARE: ['laptop', 'monitor', 'screen', 'keyboard', 'printer', 'mouse', 'docking station', 'dock', 'charger', 'battery', 'overheating', 'broken screen', 'hardware', 'cable', 'macbook', 'headset'],
    SOFTWARE: ['crash', 'bug', 'install', 'update', 'upgrade', 'excel', 'outlook', 'teams', 'license', 'office 365', 'slack', 'zoom', 'adobe', 'blue screen', 'bsod', 'reinstall', 'application', 'driver'],
    BILLING: ['invoice', 'billing', 'charged', 'charge', 'payment', 'subscription', 'renew', 'receipt', 'credit card', 'refund', 'quote']
  };

  for (const [cat, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (lowerText.includes(word)) {
        categoryScores[cat] = (categoryScores[cat] || 0) + 2;
      }
    }
  }

  let topCategory = 'GENERAL_INQUIRY';
  let topScore = 0;
  for (const [cat, score] of Object.entries(categoryScores)) {
    if (score > topScore) {
      topScore = score;
      topCategory = cat;
    }
  }
  category = topCategory;

  // 5. Determine Priority
  let priority = 'MEDIUM';
  const criticalKeywords = ['outage', 'server down', 'system down', 'production down', 'security breach', 'hacked', 'data loss', 'critical', 'emergency', 'everyone affected', 'whole company'];
  const highKeywords = ['cannot work', 'urgent', 'asap', 'broken laptop', 'vpn not working', 'deadline today', 'blocked', 'major error', 'failing for all'];
  const lowKeywords = ['inquiry', 'curious', 'how do i', 'when will', 'question', 'feedback', 'minor'];

  if (criticalKeywords.some(k => lowerText.includes(k))) {
    priority = 'CRITICAL';
  } else if (highKeywords.some(k => lowerText.includes(k))) {
    priority = 'HIGH';
  } else if (lowKeywords.some(k => lowerText.includes(k))) {
    priority = 'LOW';
  }

  // 6. Sentiment Detection
  let sentiment = 'CALM';
  const angryWords = ['unacceptable', 'terrible', 'furious', 'horrible', 'worst', 'angry', 'sue', 'ridiculous', 'tired of this'];
  const frustratedWords = ['frustrated', 'annoyed', 'again', 'still not working', 'third time', 'waiting forever', 'no response'];
  const urgentWords = ['urgent', 'immediately', 'asap', 'hurry', 'emergency', 'right away'];

  if (angryWords.some(w => lowerText.includes(w))) {
    sentiment = 'ANGRY';
  } else if (urgentWords.some(w => lowerText.includes(w))) {
    sentiment = 'URGENT';
  } else if (frustratedWords.some(w => lowerText.includes(w))) {
    sentiment = 'FRUSTRATED';
  }

  // 7. Title Generation
  let title = text.split('\n')[0].trim();
  if (title.length > 80) {
    title = title.substring(0, 77) + '...';
  }
  if (!title || title.length < 5) {
    title = `${category.replace('_', ' ')}: Issue reported by ${detectedName}`;
  }

  return {
    customerName: detectedName,
    customerEmail: detectedEmail,
    customerPhone: detectedPhone,
    title,
    description: text,
    category,
    priority,
    sentiment,
    aiConfidence: topScore > 2 ? 0.92 : 0.78,
    summary: `Customer reports ${category.toLowerCase().replace('_', ' ')} issue with ${priority.toLowerCase()} priority.`
  };
}

function normalizeExtractedResult(parsed, rawText, senderMeta) {
  const allowedCategories = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCOUNT_ACCESS', 'BILLING', 'GENERAL_INQUIRY'];
  const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const allowedSentiments = ['CALM', 'FRUSTRATED', 'ANGRY', 'URGENT'];

  return {
    customerName: parsed.customerName || senderMeta.name || 'Support Customer',
    customerEmail: parsed.customerEmail || senderMeta.email || null,
    customerPhone: parsed.customerPhone || senderMeta.phone || null,
    title: parsed.title || rawText.substring(0, 60),
    description: parsed.description || rawText,
    category: allowedCategories.includes(parsed.category) ? parsed.category : 'GENERAL_INQUIRY',
    priority: allowedPriorities.includes(parsed.priority) ? parsed.priority : 'MEDIUM',
    sentiment: allowedSentiments.includes(parsed.sentiment) ? parsed.sentiment : 'CALM',
    aiConfidence: parsed.aiConfidence || 0.9,
    summary: parsed.summary || parsed.title
  };
}

