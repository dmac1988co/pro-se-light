import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!apiKey,
    model: 'gemini-3.8-flash'
  });
});

// Credit estimation & Token Optimizer endpoint
app.post('/api/ai/estimate', (req, res) => {
  const { text, rawText } = req.body;
  const rawTokens = Math.ceil(((rawText || '').length) / 4);
  const cleanTokens = Math.ceil(((text || '').length) / 4);
  const tokensSaved = Math.max(0, rawTokens - cleanTokens);
  const percentSaved = rawTokens > 0 ? Number(((tokensSaved / rawTokens) * 100).toFixed(1)) : 0;

  res.json({
    rawTokens,
    cleanTokens,
    tokensSaved,
    percentSaved,
  });
});

// AI Content-Based Tagging Endpoint (Credit-Conscious Batching)
app.post('/api/ai/auto-tag', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.json({ tagsById: {} });
    }

    const items = emails.slice(0, 30).map((e: any) => 
      `ID: ${e.id} | Subject: ${e.subject} | Snippet: ${(e.snippet || e.cleanedSnippet || '').slice(0, 180)}`
    ).join('\n');

    const prompt = `You are a legal document analyst. Categorize each email with 1 to 3 relevant legal labels from this list:
["Contractual", "Payment", "Liability", "Notice & Demand", "Admission & Defense", "Correspondence"]

CRITERIA:
- "Contractual": agreements, SOWs, deliverables, terms, acceptance, scopes
- "Payment": invoices, wire transfers, balances, pricing, unpaid funds
- "Liability": breaches, defaults, non-performance, damages, disputes
- "Notice & Demand": formal cure demands, pre-litigation notices, deadlines
- "Admission & Defense": concessions (e.g. system works), budget freezes, excuses

Return ONLY a JSON object mapping each ID to an array of string labels.
Example:
{
  "tagsById": {
    "msg-1": ["Contractual", "Payment"],
    "msg-2": ["Liability", "Notice & Demand"]
  }
}

EMAILS:
${items}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 600,
        temperature: 0.1,
      },
    });

    const text = response.text || '{}';
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleanJson);
    }

    res.json({
      success: true,
      tagsById: data.tagsById || {},
      usage: response.usageMetadata || null,
    });
  } catch (err: any) {
    console.warn('AI model error during auto-tag, using rule-based classifier fallback:', err.message);
    const { emails = [] } = req.body;
    const fallbackTagsById: Record<string, string[]> = {};
    for (const e of emails) {
      const combined = `${e.subject || ''} ${e.snippet || ''}`.toLowerCase();
      const tags: string[] = [];
      if (/\b(agreement|contract|statement of work|sow|terms|countersign|signed|signature|scope|deliverable|milestone|clause|binding)\b/i.test(combined)) {
        tags.push('Contractual');
      }
      if (/\b(invoice|wire|payment|installment|unpaid|overdue|due date|billing|remittance|funds|balance|dollars?)\b/i.test(combined) || /\$\s?[0-9]+/i.test(combined)) {
        tags.push('Payment');
      }
      if (/\b(breach|default|damages|liable|liability|loss|fail|failure|defective|dispute|bad faith|rejected|cannot pay)\b/i.test(combined)) {
        tags.push('Liability');
      }
      if (/\b(notice|demand|cure|pre-litigation|litigation hold|intent to sue|10 business days|default notice)\b/i.test(combined)) {
        tags.push('Notice & Demand');
      }
      if (/\b(working smoothly|budget freeze|board of directors|waiver|excuse)\b/i.test(combined)) {
        tags.push('Admission & Defense');
      }
      if (tags.length === 0) tags.push('Correspondence');
      fallbackTagsById[e.id] = tags;
    }

    res.json({
      success: true,
      tagsById: fallbackTagsById,
      fallback: true,
    });
  }
});

// Legal Strategy Generation Endpoint
app.post('/api/ai/strategy', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const { causeOfAction, caseDescription, exhibits, budgetMode, jurisdiction, claimant, opposingParty } = req.body;

    let maxOutputTokens = 1200;
    let modeInstruction = '';

    if (budgetMode === 'eco') {
      maxOutputTokens = 850;
      modeInstruction = `CREDIT-SAVER ECO MODE: Be concise, direct, high-impact, and token-efficient. Use sharp bullet points and explicit Bates/Exhibit citations. Eliminate introductory pleasantries or boilerplate text.`;
    } else if (budgetMode === 'standard') {
      maxOutputTokens = 1800;
      modeInstruction = `STANDARD STRATEGY MODE: Provide balanced legal reasoning, thorough elements analysis, affirmative defenses, and explicit exhibit citations.`;
    } else {
      maxOutputTokens = 3500;
      modeInstruction = `DEEP COUNSEL MODE: Provide exhaustive legal doctrine breakdown, burden of proof analysis, pre-trial leverage assessment, and procedural steps.`;
    }

    const exhibitSummary = (exhibits || []).map((e: any, idx: number) => 
      `[${e.batesNumber || `EXHIBIT-${idx+1}`}] Date: ${e.date || 'Unknown'} | From: ${e.from || 'Unknown'} | To: ${e.to || 'Unknown'} | Subject: ${e.subject || 'N/A'}\nKey Excerpt: ${e.cleanedSnippet || e.body || ''}`
    ).join('\n---\n');

    const prompt = `You are a senior litigation strategist and evidentiary specialist. Formulate a rigorous, credit-conscious legal strategy.

${modeInstruction}

CASE CONTEXT:
- Primary Cause of Action: ${causeOfAction || 'Breach of Contract'}
- Claimant / Plaintiff: ${claimant || 'Client'}
- Opposing Party / Defendant: ${opposingParty || 'Opposing Party'}
- Jurisdiction: ${jurisdiction || 'US State / Federal Common Law'}
- Case Summary: ${caseDescription || 'Dispute arising from email communications, agreements, and breach of performance.'}

EVIDENTIARY RECORD (${(exhibits || []).length} Selected Exhibits):
${exhibitSummary || 'No exhibits selected yet. Provide general strategic blueprint for this cause of action.'}

Please return your response in structured JSON with this exact schema:
{
  "executiveSummary": "Concise summary of the legal position and case viability",
  "elementsOfProof": [
    {
      "element": "Name of legal element (e.g. Valid Enforceable Agreement, Full Performance, Material Breach, Resulting Damages)",
      "status": "Strong",
      "supportingExhibits": ["EXHIBIT-A-001"],
      "factualAnalysis": "How the email record satisfies this specific legal element",
      "gapsAndDiscovery": "Potential evidentiary vulnerability and what to subpoena or request in discovery"
    }
  ],
  "anticipatedDefenses": [
    {
      "defense": "Name of anticipated defense (e.g. Statute of Frauds, Waiver, Failure to Mitigate, Impossibility)",
      "likelihood": "High",
      "counterRefutation": "How our emails disprove or neutralize this affirmative defense"
    }
  ],
  "timelineKeyDates": [
    {
      "date": "YYYY-MM-DD or relevant date string",
      "significance": "Crucial legal significance (notice sent, breach occurred, payment missed)",
      "exhibitRef": "EXHIBIT-A-001"
    }
  ],
  "settlementLeverage": {
    "rating": "Strong",
    "rationale": "Key leverage points against opposing party (e.g., admissions in writing, bad faith risk)",
    "recommendedStrategy": "Pre-litigation demand letter vs immediate filing vs mediation"
  },
  "recommendedActionItems": [
    "Concrete actionable procedural step"
  ]
}

Ensure "status" in elementsOfProof is one of: "Strong", "Moderate", or "Vulnerable". Ensure "likelihood" in anticipatedDefenses is one of: "High", "Medium", or "Low". Ensure "rating" in settlementLeverage is one of: "Strong", "Moderate", or "Weak".
Output ONLY pure JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens,
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    let parsedData = {};
    try {
      parsedData = JSON.parse(text);
    } catch {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanJson);
    }

    res.json({
      success: true,
      strategy: parsedData,
      usage: response.usageMetadata || null,
    });
  } catch (err: any) {
    console.error('Error formulating strategy:', err);
    res.status(500).json({ error: err.message || 'Failed to formulate legal strategy' });
  }
});

// Document Reproduction Endpoint
app.post('/api/ai/reproduce', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const { docType, caseInfo, exhibits, customInstructions, budgetMode } = req.body;

    const exhibitList = (exhibits || []).map((e: any, idx: number) => 
      `Exhibit ${e.batesNumber || (idx + 1)} (${e.date}): From ${e.from} to ${e.to}, Subject: "${e.subject}"\nKey excerpt: ${e.cleanedSnippet || e.body}`
    ).join('\n\n');

    const prompt = `You are a master legal drafting attorney. Draft a comprehensive, professional, and ready-to-sign legal document of type: "${docType}".

CASE METADATA:
- Claimant/Plaintiff: ${caseInfo?.claimantName || '[CLAIMANT NAME]'}
- Opposing Party/Defendant: ${caseInfo?.opposingPartyName || '[OPPOSING PARTY NAME]'}
- Dispute Summary: ${caseInfo?.summary || 'Commercial dispute regarding breach of obligations and non-performance.'}
- Relief / Damages Demanded: ${caseInfo?.demandedAmount || 'Full contractual restitution and damages'}
- Additional Instructions: ${customInstructions || 'Follow standard formal legal practice rules.'}

EVIDENTIARY RECORD (CITE THESE EXACT BATES / EXHIBIT NUMBERS THROUGHOUT THE DOCUMENT):
${exhibitList}

DOCUMENT SPECIFICATIONS:
- Type: ${docType} (e.g. "Formal Demand Letter & Notice of Dispute", "Sworn Declaration Under Penalty of Perjury", "Chronological Statement of Facts with Exhibit Citations", "First Set of Interrogatories and Requests for Production")
- Professional legal tone, rigorous citations (e.g., "See Exhibit A-001 at paragraph 2").
- Complete structure with formal heading, formal caption/address block, factual narrative, claims/statutory basis, demand for cure/response with clear deadline (e.g., 10 business days), and formal signature block.

Draft the complete document text in clear Markdown format with headings, bullet points, and formal structure.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.25,
        maxOutputTokens: budgetMode === 'eco' ? 1800 : 3500,
      },
    });

    res.json({
      success: true,
      documentText: response.text || '',
      usage: response.usageMetadata || null,
    });
  } catch (err: any) {
    console.error('Error reproducing document:', err);
    res.status(500).json({ error: err.message || 'Failed to reproduce document' });
  }
});

// Credit-Conscious Legal Q&A Endpoint
app.post('/api/ai/ask', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const { question, selectedExhibits, caseInfo } = req.body;

    const compactEvidence = (selectedExhibits || []).map((e: any) => 
      `[${e.batesNumber || 'EXHIBIT'} - ${e.date}] From ${e.from}: ${e.cleanedSnippet || (e.body || '').slice(0, 300)}`
    ).join('\n');

    const prompt = `You are a concise, credit-conscious legal counsel. Answer the user's question directly and authoritatively, citing the provided exhibits where relevant.
Do not waste tokens on greetings or disclaimers. Give exact legal analysis, evidentiary strengths, and tactical advice.

QUESTION: ${question}

CASE CONTEXT: ${caseInfo?.summary || 'Legal dispute'}
EVIDENCE EXCERPTS:
${compactEvidence || 'No specific exhibits attached.'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    });

    res.json({
      success: true,
      answer: response.text || '',
      usage: response.usageMetadata || null,
    });
  } catch (err: any) {
    console.error('Error in Q&A:', err);
    res.status(500).json({ error: err.message || 'Failed to answer legal question' });
  }
});

// Mount Vite middleware in development
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
});
app.use(vite.middlewares);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});
