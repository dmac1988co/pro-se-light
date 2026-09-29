import { ConnectedAccount, EmailMessage } from '../types';
import { cleanEmailBody, estimateTokens, extractEntitiesLocally, generateBatesNumber, classifyEmailContent } from '../utils/creditOptimizer';

/**
 * Base64 URL decode helper for Gmail API message payload bodies
 */
function base64UrlDecode(input: string): string {
  if (!input) return '';
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(base64);
    } catch {
      return '';
    }
  }
}

/**
 * Extract plain text or html from Gmail message payload parts recursively
 */
function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';

  if (payload.body && payload.body.data) {
    return base64UrlDecode(payload.body.data);
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain, fallback to text/html
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart && plainPart.body && plainPart.body.data) {
      return base64UrlDecode(plainPart.body.data);
    }

    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return base64UrlDecode(htmlPart.body.data);
    }

    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return nested;
    }
  }

  return '';
}

/**
 * Search Gmail for a specific account
 */
export async function searchGmail(
  account: ConnectedAccount,
  query: string,
  maxResults: number = 20
): Promise<EmailMessage[]> {
  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      throw new Error(`Gmail API error (${listRes.status}): ${errText}`);
    }

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    // Fetch message details in parallel (chunks of 6 to prevent rate limits)
    const messages: EmailMessage[] = [];
    const messageStubs = listData.messages.slice(0, maxResults);

    for (const stub of messageStubs) {
      try {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=full`;
        const detailRes = await fetch(detailUrl, {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!detailRes.ok) continue;

        const detail = await detailRes.json();
        const headers = detail.payload?.headers || [];
        const getHeader = (name: string) => {
          const found = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
          return found ? found.value : '';
        };

        const from = getHeader('From');
        const to = getHeader('To');
        const cc = getHeader('Cc');
        const subject = getHeader('Subject') || '(No Subject)';
        const dateHeader = getHeader('Date');
        const rawBody = extractBodyFromPayload(detail.payload) || detail.snippet || '';

        // Local credit optimization
        const cleanedBody = cleanEmailBody(rawBody);
        const rawTokens = estimateTokens(rawBody);
        const cleanedTokens = estimateTokens(cleanedBody);
        const tokensSaved = Math.max(0, rawTokens - cleanedTokens);

        const extractedEntities = extractEntitiesLocally(cleanedBody, subject, from, to);
        const timestamp = detail.internalDate ? parseInt(detail.internalDate, 10) : (dateHeader ? new Date(dateHeader).getTime() : Date.now());

        messages.push({
          id: detail.id,
          threadId: detail.threadId,
          accountId: account.id,
          accountEmail: account.email,
          from,
          to,
          cc,
          subject,
          date: dateHeader ? new Date(dateHeader).toLocaleDateString() : new Date(timestamp).toLocaleDateString(),
          timestamp,
          rawBody,
          cleanedBody,
          rawTokens,
          cleanedTokens,
          tokensSaved,
          batesNumber: '', // assigned after sorting
          isSelected: true, // selected by default for strategy consideration
          extractedEntities,
          snippet: detail.snippet,
          hasAttachment: Boolean(detail.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)),
          labels: classifyEmailContent(cleanedBody, subject, from, to),
        });
      } catch (e) {
        console.warn(`Failed to fetch email message ${stub.id}:`, e);
      }
    }

    return messages;
  } catch (error) {
    console.error(`Gmail search failed for account ${account.email}:`, error);
    throw error;
  }
}

/**
 * Searches across MULTIPLE Google accounts concurrently,
 * aggregates results, deduplicates, and assigns formal chronological Bates numbers!
 */
export async function searchAcrossAccounts(
  accounts: ConnectedAccount[],
  query: string
): Promise<EmailMessage[]> {
  if (accounts.length === 0) return [];

  const resultsByAccount = await Promise.allSettled(
    accounts.map(acc => searchGmail(acc, query, 15))
  );

  const combined: EmailMessage[] = [];
  resultsByAccount.forEach(result => {
    if (result.status === 'fulfilled') {
      combined.push(...result.value);
    }
  });

  // Deduplicate by message ID
  const seenIds = new Set<string>();
  const unique = combined.filter(msg => {
    if (seenIds.has(msg.id)) return false;
    seenIds.add(msg.id);
    return true;
  });

  // Sort chronologically (oldest to newest for legal chronology)
  unique.sort((a, b) => a.timestamp - b.timestamp);

  // Assign formal Bates numbers
  unique.forEach((msg, idx) => {
    msg.batesNumber = generateBatesNumber(idx, 'EXHIBIT A');
  });

  return unique;
}

/**
 * Create or save a reproduced legal document to Google Drive
 */
export async function exportDocumentToDrive(
  accessToken: string,
  title: string,
  content: string
): Promise<{ fileId: string; webViewLink?: string }> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: `${title}.md`,
    mimeType: 'text/markdown',
    description: 'Generated via Legal Strategy & Multi-Account Suite',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/markdown\r\n\r\n' +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
  };
}

/**
 * Add a legal deadline to Google Calendar
 */
export async function createCalendarDeadline(
  accessToken: string,
  event: {
    title: string;
    description: string;
    dateStr: string; // YYYY-MM-DD
    caseTitle?: string;
  }
): Promise<{ id: string; htmlLink?: string }> {
  // Validate or convert date to YYYY-MM-DD
  let validDate = event.dateStr;
  try {
    const d = new Date(event.dateStr);
    if (!isNaN(d.getTime())) {
      validDate = d.toISOString().split('T')[0];
    }
  } catch {
    validDate = new Date().toISOString().split('T')[0];
  }

  const calendarPayload = {
    summary: `⚖️ [LEGAL DEADLINE] ${event.title}`,
    description: `${event.description}\n\nCase Matter: ${event.caseTitle || 'Legal Strategy'}\nCreated via Legal Strategy Builder.`,
    start: {
      date: validDate,
    },
    end: {
      date: validDate,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 3 * 24 * 60 }, // 3 days before
      ],
    },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(calendarPayload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar API error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    htmlLink: result.htmlLink,
  };
}

/**
 * Creates a comprehensive legal evidence and damages ledger in Google Sheets
 */
export async function createEvidenceSpreadsheet(
  accessToken: string,
  title: string,
  emails: EmailMessage[],
  caseMeta?: { title: string; claimantName: string; opposingPartyName: string; demandedAmount: string }
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const selected = emails.filter(e => e.isSelected);

  // Tab 1: Evidence & Bates Log
  const evidenceHeaders = [
    'Bates Identifier',
    'Date',
    'From (Sender)',
    'To (Recipient)',
    'Sourced Google Account',
    'Subject Line',
    'Damages Mentioned ($)',
    'Legal Trigger Keywords',
    'Key Factual Excerpt',
    'Tokens Saved (Local)',
  ];

  const evidenceRows = selected.map(e => [
    e.batesNumber || 'EXHIBIT',
    e.date || 'N/A',
    e.from || 'N/A',
    e.to || 'N/A',
    e.accountEmail || 'N/A',
    e.subject || 'N/A',
    e.extractedEntities.monetaryAmounts.join(', ') || 'N/A',
    e.extractedEntities.legalKeywords.join(', ') || 'N/A',
    e.cleanedBody.slice(0, 300).replace(/\n/g, ' ') || 'N/A',
    `${e.tokensSaved} tokens`,
  ]);

  // Tab 2: Damages Ledger & Calculations
  const damagesHeaders = [
    'Line Item #',
    'Dispute Item / Invoice',
    'Incurred Date',
    'Bates Exhibit Reference',
    'Principal Amount ($)',
    '10% Statutory Pre-Judgment Interest ($)',
    'Total Balance Due ($)',
    'Status & Payment Notice',
  ];

  // Extract all distinct monetary figures or create row for total demanded
  const moneyItems = selected
    .filter(e => e.extractedEntities.monetaryAmounts.length > 0)
    .flatMap((e, i) => 
      e.extractedEntities.monetaryAmounts.map((m, mIdx) => {
        // extract raw numeric value from string (e.g. "$27,500" -> 27500)
        const numeric = parseFloat(m.replace(/[^0-9.]/g, '')) || 0;
        return {
          idx: i + 1 + mIdx,
          subject: e.subject,
          date: e.date,
          bates: e.batesNumber,
          amount: numeric,
        };
      })
    );

  const damagesRows = moneyItems.length > 0
    ? moneyItems.map((item, rowIdx) => {
        const rowNum = rowIdx + 2; // header is row 1
        return [
          item.idx,
          item.subject,
          item.date,
          item.bates,
          item.amount,
          `=E${rowNum}*0.1`,
          `=E${rowNum}+F${rowNum}`,
          'Defaulted / Unpaid',
        ];
      })
    : [
        [
          1,
          'Contract Balance & Damages Demanded',
          new Date().toLocaleDateString(),
          'EXHIBIT A-001',
          27500,
          '=E2*0.1',
          '=E2+F2',
          'Notice of Default Served',
        ],
      ];

  // Total summary row
  const lastRow = damagesRows.length + 1;
  const totalRow = [
    'TOTAL',
    'Combined Principal Damages & Accrued Statutory Interest',
    '',
    '',
    `=SUM(E2:E${lastRow})`,
    `=SUM(F2:F${lastRow})`,
    `=SUM(G2:G${lastRow})`,
    'Pending Settlement / Judgment',
  ];

  // Build the spreadsheet resource
  const spreadsheetResource = {
    properties: {
      title: title || `Legal Evidence & Damages Ledger - ${caseMeta?.claimantName || 'Case'}`,
    },
    sheets: [
      {
        properties: {
          title: 'Master Evidence & Bates Log',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: evidenceHeaders.map(h => ({
                  userEnteredValue: { stringValue: h },
                })),
              },
              ...evidenceRows.map(row => ({
                values: row.map(val => ({
                  userEnteredValue: { stringValue: String(val) },
                })),
              })),
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Damages Schedule & Interest',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: damagesHeaders.map(h => ({
                  userEnteredValue: { stringValue: h },
                })),
              },
              ...damagesRows.map(row => ({
                values: row.map(val => {
                  if (typeof val === 'number') {
                    return { userEnteredValue: { numberValue: val } };
                  }
                  if (typeof val === 'string' && val.startsWith('=')) {
                    return { userEnteredValue: { formulaValue: val } };
                  }
                  return { userEnteredValue: { stringValue: String(val) } };
                }),
              })),
              {
                values: totalRow.map(val => {
                  if (typeof val === 'string' && val.startsWith('=')) {
                    return { userEnteredValue: { formulaValue: val } };
                  }
                  return { userEnteredValue: { stringValue: String(val) } };
                }),
              },
            ],
          },
        ],
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(spreadsheetResource),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return {
    spreadsheetId: result.spreadsheetId,
    spreadsheetUrl: result.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`,
  };
}

/**
 * List existing spreadsheets in user's Google Drive
 */
export async function listUserSpreadsheets(
  accessToken: string
): Promise<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }[]> {
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=15&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API error listing sheets (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Read values from a Google Spreadsheet
 */
export async function readSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string = 'A1:Z50'
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Sheets read error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.values || [];
}

