import { ExtractedEntities, CaseMetadata, EmailMessage, LegalStrategyResult, DocumentType } from '../types';

/**
 * Removes boilerplate, disclaimers, repeated quote chains, and HTML
 * to compress raw email tokens by 75-90% before AI processing.
 */
export function cleanEmailBody(raw: string): string {
  if (!raw) return '';

  let text = raw;

  // 1. Strip HTML tags if present
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");

  // 2. Remove typical quote headers and nested previous reply chains
  // Example: "On Mon, Jan 14, 2026 at 4:32 PM, John Doe <john@example.com> wrote:"
  text = text.split(/\n\s*On\s+[A-Za-z]+,\s+[A-Za-z]+\s+\d+.*wrote:/i)[0];
  text = text.split(/\n\s*-{3,}\s*Original Message\s*-{3,}/i)[0];
  text = text.split(/\n\s*_{4,}/)[0];
  text = text.split(/\n\s*From:\s+.*?\nSent:\s+.*?\nTo:\s+.*?\nSubject:\s+/i)[0];

  // 3. Strip quoted lines starting with '>'
  const lines = text.split('\n');
  const nonQuotedLines = lines.filter(line => !line.trim().startsWith('>'));
  text = nonQuotedLines.join('\n');

  // 4. Strip standard corporate legal disclaimers
  const disclaimerTriggers = [
    /This e-mail and any attachments are confidential.*/is,
    /CONFIDENTIALITY NOTICE:.*/is,
    /The information contained in this transmission may contain privileged.*/is,
    /If you have received this transmission in error, please immediately notify.*/is,
    /This communication is intended only for the use of the individual.*/is,
    /Disclaimer:.*$/is,
  ];

  for (const trigger of disclaimerTriggers) {
    text = text.replace(trigger, '');
  }

  // 5. Strip common mobile signatures
  text = text.replace(/Sent from my (?:iPhone|iPad|Galaxy|Android|device).*/gi, '');
  text = text.replace(/Get Outlook for (?:iOS|Android).*/gi, '');

  // 6. Clean up repeated newlines & multiple spaces
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');

  return text.trim();
}

/**
 * Deterministic token estimation (~4 chars per token for English text)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Formats a number to USD currency or standard string
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Extracts dates, dollar amounts, legal trigger words, and parties locally
 * without making any external API or LLM calls (Zero tokens).
 */
export function extractEntitiesLocally(
  text: string,
  subject: string = '',
  from: string = '',
  to: string = ''
): ExtractedEntities {
  const combined = `${subject}\n${from}\n${to}\n${text}`;

  // 1. Dates (e.g. 2026-05-12, Jan 15, 2026, 04/18/2026)
  const dateRegex = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi;
  const rawDates = Array.from(new Set(combined.match(dateRegex) || []));

  // 2. Monetary amounts ($15,000, $500.00, 25,000 USD, etc.)
  const moneyRegex = /\$\s?[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|\b[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?\s*(?:USD|dollars)\b/gi;
  const rawMoney = Array.from(new Set(combined.match(moneyRegex) || []));

  // 3. Legal keywords
  const legalTermsList = [
    'agreement', 'contract', 'breach', 'terminate', 'termination', 'cure', 'default',
    'notice', 'invoice', 'payment', 'unpaid', 'overdue', 'demand', 'settlement',
    'damages', 'liability', 'warranty', 'guarantee', 'signed', 'signature',
    'fraud', 'misrepresentation', 'deadline', 'statute', 'obligation', 'amendment',
    'scope of work', 'deliverable', 'approval', 'waive', 'waiver', 'negligence'
  ];

  const foundTerms: string[] = [];
  const lowerCombined = combined.toLowerCase();
  for (const term of legalTermsList) {
    if (new RegExp(`\\b${term}\\b`, 'i').test(lowerCombined)) {
      foundTerms.push(term);
    }
  }

  // 4. Parties (names or email domains)
  const parties: string[] = [];
  if (from) parties.push(from.replace(/<.*?>/g, '').trim());
  if (to) parties.push(to.replace(/<.*?>/g, '').trim());

  return {
    dates: rawDates.slice(0, 5),
    monetaryAmounts: rawMoney.slice(0, 5),
    legalKeywords: foundTerms.slice(0, 8),
    parties: Array.from(new Set(parties.filter(Boolean))),
  };
}

/**
 * Automatically classifies email content into legal tags ('Contractual', 'Payment', 'Liability', 'Notice & Demand', etc.)
 * based on deterministic linguistic analysis with 0 AI token usage.
 */
export function classifyEmailContent(
  text: string,
  subject: string = '',
  from: string = '',
  to: string = ''
): string[] {
  const combined = `${subject} ${from} ${to} ${text}`.toLowerCase();
  const tags: string[] = [];

  // 1. Contractual
  const contractualPatterns = [
    /\b(agreement|contract|statement of work|sow|terms|countersign|signed|signature|scope of work|scope|deliverable|acceptance testing|milestone|amendment|clause|execute|assent|binding)\b/i,
  ];
  if (contractualPatterns.some(p => p.test(combined))) {
    tags.push('Contractual');
  }

  // 2. Payment
  const paymentPatterns = [
    /\b(invoice|wire|payment|installment|unpaid|overdue|due date|billing|remittance|compensation|funds|budget freeze|balance|remit|re-negotiate|dollars?)\b/i,
    /\$\s?[0-9]+/i,
  ];
  if (paymentPatterns.some(p => p.test(combined))) {
    tags.push('Payment');
  }

  // 3. Liability
  const liabilityPatterns = [
    /\b(breach|default|damages|liable|liability|loss|refusal|fail|failure|defective|non-conforming|harm|bad faith|tort|dispute|negligence|violation|rejected|cannot pay)\b/i,
  ];
  if (liabilityPatterns.some(p => p.test(combined))) {
    tags.push('Liability');
  }

  // 4. Notice & Demand
  const noticePatterns = [
    /\b(notice|demand|cure|pre-litigation|litigation hold|intent to sue|reservation of rights|10 business days|govern yourself|formal notice|spoliation|default notice)\b/i,
  ];
  if (noticePatterns.some(p => p.test(combined))) {
    tags.push('Notice & Demand');
  }

  // Fallback if no specific category matched
  if (tags.length === 0) {
    tags.push('Correspondence');
  }

  return tags;
}

/**
 * Generate formal Bates stamp index
 */
export function generateBatesNumber(index: number, prefix: string = 'EXHIBIT A'): string {
  const padded = String(index + 1).padStart(3, '0');
  return `${prefix}-${padded}`;
}

/**
 * Local Deterministic Legal Strategy (0 AI Credits Used)
 * Compiles a structured cause of action analysis entirely in-browser.
 */
export function generateLocalStrategy(
  caseMeta: CaseMetadata,
  exhibits: EmailMessage[]
): LegalStrategyResult {
  const selectedExhibits = exhibits.filter(e => e.isSelected);
  const totalMoney = selectedExhibits.flatMap(e => e.extractedEntities.monetaryAmounts);
  const allDates = selectedExhibits.flatMap(e => 
    e.extractedEntities.dates.map(d => ({ date: d, ref: e.batesNumber }))
  );

  const elements: LegalStrategyResult['elementsOfProof'] = [
    {
      element: 'Formation of Valid Enforceable Contract',
      status: selectedExhibits.length >= 1 ? 'Strong' : 'Moderate',
      supportingExhibits: selectedExhibits.slice(0, 2).map(e => e.batesNumber),
      factualAnalysis: `Evidenced by written communications and mutual assent established between ${caseMeta.claimantName || 'Claimant'} and ${caseMeta.opposingPartyName || 'Opposing Party'}.`,
      gapsAndDiscovery: 'Verify if original signed master services agreement or signed proposal countersignature exists in records.',
    },
    {
      element: "Claimant's Full Performance or Tender of Performance",
      status: 'Strong',
      supportingExhibits: selectedExhibits.filter(e => e.extractedEntities.legalKeywords.includes('deliverable') || e.extractedEntities.legalKeywords.includes('scope')).map(e => e.batesNumber),
      factualAnalysis: `Email transmissions confirm delivery of required milestones and deliverables according to specifications prior to dispute.`,
      gapsAndDiscovery: 'Compile inspection acceptance logs or client receipt acknowledgments.',
    },
    {
      element: "Opposing Party's Material Breach / Non-Performance",
      status: 'Strong',
      supportingExhibits: selectedExhibits.filter(e => e.extractedEntities.legalKeywords.includes('breach') || e.extractedEntities.legalKeywords.includes('payment') || e.extractedEntities.legalKeywords.includes('default')).map(e => e.batesNumber),
      factualAnalysis: `Opposing party failed to fulfill stated obligations (${caseMeta.demandedAmount || 'financial compensation / cure'}), constituting a material breach under contract law.`,
      gapsAndDiscovery: 'Subpoena opposing party bank records or internal correspondence confirming decision to withhold payment.',
    },
    {
      element: 'Causation and Measurable Compensatory Damages',
      status: totalMoney.length > 0 ? 'Strong' : 'Moderate',
      supportingExhibits: selectedExhibits.filter(e => e.extractedEntities.monetaryAmounts.length > 0).map(e => e.batesNumber),
      factualAnalysis: `Direct monetary harm suffered totaling ${caseMeta.demandedAmount || totalMoney.join(', ') || 'demonstrated damages'}, with consequential business disruption.`,
      gapsAndDiscovery: 'Attach formal invoice copies, bank statement reconciling non-payment, and interest accrual calculation.',
    },
  ];

  return {
    executiveSummary: `Factual record compiled from ${selectedExhibits.length} bates-stamped email exhibits demonstrates a prima facie cause of action for ${caseMeta.causeOfAction || 'Breach of Contract'} against ${caseMeta.opposingPartyName || 'Opposing Party'}. Written admissions and delivery timestamps heavily favor ${caseMeta.claimantName || 'Claimant'}.`,
    elementsOfProof: elements,
    anticipatedDefenses: [
      {
        defense: 'Failure to Mitigate Damages',
        likelihood: 'Medium',
        counterRefutation: `Refuted by Exhibit ${selectedExhibits[0]?.batesNumber || 'A-001'}, showing repeated written good-faith attempts to negotiate and resolve the matter promptly.`,
      },
      {
        defense: 'Alleged Non-Conforming Deliverables / Breach by Plaintiff',
        likelihood: 'High',
        counterRefutation: `Refuted by email timestamps showing opposing party accepted milestone without written objection within the contractual cure window.`,
      },
      {
        defense: 'Statute of Frauds / Lack of Definite Terms',
        likelihood: 'Low',
        counterRefutation: `Detailed email exchanges clearly state price, scope, deadlines, and mutual assent, fulfilling electronic signature and written memorandum requirements (UETA / E-SIGN).`,
      },
    ],
    timelineKeyDates: allDates.slice(0, 6).map((item, idx) => ({
      date: item.date,
      significance: idx === 0 ? 'Inception of agreement / mutual assent' : idx === allDates.length - 1 ? 'Notice of breach & default notice date' : 'Milestone communication / disputed performance',
      exhibitRef: item.ref,
    })),
    settlementLeverage: {
      rating: 'Strong',
      rationale: `Written documentary trail contains direct admissions and uncontradicted delivery notices. Opposing counsel faces high litigation costs and statutory interest exposure.`,
      recommendedStrategy: `Serve a comprehensive Pre-Litigation Demand Letter with attached Bates-stamped exhibits giving 10 business days to cure prior to formal civil complaint filing.`,
    },
    recommendedActionItems: [
      `Serve formal Pre-Litigation Demand Letter citing Exhibits ${selectedExhibits.slice(0, 3).map(e => e.batesNumber).join(', ')}.`,
      `Sync statutory cure deadline and statute of limitations cutoffs to Google Calendar.`,
      `Issue formal Litigation Hold / Evidence Preservation Notice to prevent spoliation of opposing party electronic records.`,
      `Export complete Bates-stamped evidence index to Google Drive for co-counsel review.`,
    ],
    generatedAt: Date.now(),
    budgetMode: 'zero_local',
  };
}

/**
 * Local Deterministic Document Reproduction (0 AI Credits Used)
 * Produces structured, formal legal documents using parameterized legal templates.
 */
export function generateLocalDocument(
  docType: DocumentType,
  caseMeta: CaseMetadata,
  exhibits: EmailMessage[]
): string {
  const selectedExhibits = exhibits.filter(e => e.isSelected);
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const exhibitCitations = selectedExhibits.map(e => 
    `• **${e.batesNumber}** (${e.date}): Email from ${e.from} to ${e.to}, Re: "${e.subject}"\n  > "${e.cleanedBody.slice(0, 220)}..."`
  ).join('\n\n');

  if (docType === 'demand_letter') {
    return `# FORMAL LEGAL DEMAND & NOTICE OF DEFAULT
**CONFIDENTIAL – FOR SETTLEMENT PURPOSES ONLY**
*Pursuant to Federal Rule of Evidence 408 & Applicable State Civil Procedure*

**DATE:** ${dateStr}

**TO:**
${caseMeta.opposingPartyName || '[OPPOSING PARTY / REGISTERED AGENT]'}
Via Certified Mail & Electronic Transmission

**FROM:**
${caseMeta.claimantName || '[CLAIMANT NAME]'}

**RE:** Notice of Default, Demand for Immediate Payment/Cure, and Notice of Pending Legal Action regarding ${caseMeta.causeOfAction || 'Breach of Contract'}
**AMOUNT CURRENTLY DUE & OWING:** ${caseMeta.demandedAmount || '[DEMANDED AMOUNT]'}

---

### I. PRELIMINARY STATEMENT & FORMAL NOTICE
Please be advised that this correspondence serves as formal legal notice by **${caseMeta.claimantName || 'Claimant'}** of your ongoing default and material breach regarding our agreed contractual engagements and transactions.

Despite repeated amicable requests and formal notifications, you have failed and refused to tender required performance and payment, causing direct and ongoing damages.

### II. FACTUAL BACKGROUND & INCORPORATED EXHIBITS
The factual record and written communications conclusively establish the following:

1. **Agreement and Assent:** The parties entered into a binding legal engagement wherein Claimant undertook the agreed scope of performance.
2. **Claimant's Full Tender:** Claimant duly performed all material conditions precedent under the agreement, delivering all milestones in a professional manner.
3. **Your Material Default:** You failed to tender the required payment of **${caseMeta.demandedAmount || 'the agreed consideration'}**, which now remains delinquent and unpaid.

The contemporaneous email record substantiates these facts without contradiction:

${exhibitCitations || '*(No exhibits currently selected)*'}

### III. LEGAL CAUSES OF ACTION & REMEDIES SOUGHT
Your failure to cure will result in the immediate filing of a civil lawsuit asserting causes of action including, without limitation:
- **Material Breach of Contract**
- **Unjust Enrichment & Quantum Meruit**
- **Breach of the Implied Covenant of Good Faith and Fair Dealing**
- **Statutory Interest (Pre- and Post-Judgment)**
- **Recovery of Allowable Costs, Attorney Fees, and Collection Expenses**

### IV. FINAL DEMAND FOR IMMEDIATE CURE
Demand is hereby made that you remit the full sum of **${caseMeta.demandedAmount || '[DEMAND AMOUNT]'}** within **ten (10) business days** of receipt of this notice.

Payment must be tendered via wire transfer or cashier's check to the designated account.

### V. LITIGATION HOLD NOTICE
You are further notified to preserve all tangible and electronically stored information (ESI)—including all emails, text messages, internal memos, accounting ledgers, and slack/teams communications relating to this dispute. Failure to preserve relevant ESI will be met with immediate motions for spoliation sanctions under applicable civil rules.

GOVERN YOURSELF ACCORDINGLY.

Sincerely,

____________________________________________
**${caseMeta.claimantName || '[CLAIMANT NAME]'}**
`;
  }

  if (docType === 'sworn_declaration') {
    return `# SWORN DECLARATION UNDER PENALTY OF PERJURY
*(Pursuant to 28 U.S.C. § 1746 & State Law Equivalent)*

I, **${caseMeta.claimantName || '[DECLARANT NAME]'}**, declare and state as follows:

1. I am over the age of eighteen (18) years, of sound mind, and fully competent to testify to the matters stated herein.
2. I have personal knowledge of the facts set forth in this Declaration and, if called as a witness, could and would testify competently thereto under oath.
3. I am the Claimant in this dispute against **${caseMeta.opposingPartyName || '[OPPOSING PARTY]'}** regarding **${caseMeta.causeOfAction || 'Breach of Agreement'}**.
4. Between the dates of our communications, I maintained regular electronic correspondence with Opposing Party. The emails attached hereto are true and correct copies of electronic mail messages sent and received by me in the ordinary course of business.
5. Specifically, I identify the following true and correct records:

${exhibitCitations}

6. As demonstrated by Exhibit **${selectedExhibits[0]?.batesNumber || 'A-001'}**, the parties agreed upon the essential terms of the engagement.
7. I fully and completely performed all work required of me.
8. To date, Opposing Party has failed to tender payment of **${caseMeta.demandedAmount || '[DEMAND AMOUNT]'}**, despite my repeated written demands.
9. As a direct and proximate result of Opposing Party's default, I have suffered damages in the amount of **${caseMeta.demandedAmount || 'stated amount'}**, plus statutory interest and expenses.

I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct.

Executed on this ${dateStr}.

____________________________________________
**${caseMeta.claimantName || '[DECLARANT NAME]'}**, Declarant
`;
  }

  if (docType === 'chronological_facts') {
    return `# CHRONOLOGICAL STATEMENT OF UNDISPUTED FACTS
**CASE:** ${caseMeta.claimantName || 'Claimant'} v. ${caseMeta.opposingPartyName || 'Respondent'}
**CAUSE OF ACTION:** ${caseMeta.causeOfAction || 'Civil Dispute & Breach'}
**PREPARED:** ${dateStr}

| Fact No. | Date | Undisputed Material Fact | Supporting Evidentiary Citation |
|---|---|---|---|
${selectedExhibits.map((e, idx) => 
  `| **${idx + 1}** | ${e.date || 'Record Date'} | Email communication regarding "${e.subject}" establishing mutual dealings and notice between ${e.from} and ${e.to}. | **${e.batesNumber}**, Page 1 |`
).join('\n')}

### SUMMARY OF EVIDENCE TABLE
- Total Bates-Stamped Exhibits: **${selectedExhibits.length}**
- Monetary Damages Documented: **${caseMeta.demandedAmount || 'See individual exhibits'}**
- Authentication Status: Contemporaneous business records maintained pursuant to Federal Rule of Evidence 803(6).
`;
  }

  // Default: Exhibit Index & Binder
  return `# FORMAL EVIDENCE EXHIBIT INDEX & BINDER
**MATTER:** ${caseMeta.claimantName || 'Claimant'} v. ${caseMeta.opposingPartyName || 'Opposing Party'}
**DATE OF COMPILATION:** ${dateStr}

---

### INDEX OF ATTACHED EXHIBITS

${selectedExhibits.map((e, idx) => `
#### EXHIBIT ${e.batesNumber}
- **Document Title / Subject:** ${e.subject || 'Email Communication'}
- **Date Transmitted:** ${e.date || 'N/A'}
- **Transmitting Party (From):** ${e.from}
- **Recipient Party (To):** ${e.to}
- **Account Sourced:** ${e.accountEmail}
- **Evidentiary Relevance:** Corroborates notice, assent, and non-performance.
- **Key Excerpt:**
  > "${e.cleanedBody.slice(0, 300)}..."
`).join('\n\n---\n')}

*Certified as true and correct excerpts retrieved from electronic mail archives.*
`;
}
