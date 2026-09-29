import { EmailMessage, CaseMetadata } from '../types';
import { cleanEmailBody, estimateTokens, extractEntitiesLocally, generateBatesNumber, classifyEmailContent } from '../utils/creditOptimizer';

export const SAMPLE_CASE_METADATA: CaseMetadata = {
  title: 'Vanguard Digital Systems LLC v. Apex Commerce Corp.',
  claimantName: 'Vanguard Digital Systems LLC',
  opposingPartyName: 'Apex Commerce Corp. (Attn: Marcus Sterling, CEO)',
  jurisdiction: 'State & Federal Civil Courts (Commercial Division)',
  summary: 'Dispute concerning breach of written Software Development Agreement, failure to pay final milestone invoice of $27,500, and bad-faith refusal to cure.',
  demandedAmount: '$27,500.00 (plus 10% statutory interest & attorney fees)',
  causeOfAction: 'Breach of Written Contract & Account Stated',
};

const rawEmails = [
  {
    id: 'msg-sample-001',
    threadId: 'th-001',
    accountId: 'acc-1',
    accountEmail: 'dustinmcelroy1988@gmail.com',
    from: 'Marcus Sterling <msterling@apexcommerce.com>',
    to: 'Dustin McElroy <dustinmcelroy1988@gmail.com>',
    subject: 'RE: Executed Software Development Agreement & SOW - $45,000',
    date: '10/12/2025',
    timestamp: new Date('2025-10-12T14:30:00Z').getTime(),
    rawBody: `Hi Dustin,

Attached is our countersigned Statement of Work for the cloud ERP integration. We have agreed upon the total fixed contract price of $45,000, payable in two installments: $17,500 upon initial architecture signoff, and the remaining $27,500 within 15 days of final deployment and acceptance testing.

We look forward to kicking this off next Monday, October 20, 2025. Please confirm receipt.

Best regards,
Marcus Sterling
Chief Executive Officer | Apex Commerce Corp.
Phone: (555) 019-2834
www.apexcommerce.com

CONFIDENTIALITY NOTICE: This transmission is intended solely for the designated recipient. Any unauthorized disclosure, copying, distribution or taking of any action in reliance upon the contents of this information is strictly prohibited. If you have received this transmission in error, please immediately notify the sender and delete this message.`,
  },
  {
    id: 'msg-sample-002',
    threadId: 'th-001',
    accountId: 'acc-1',
    accountEmail: 'dustinmcelroy1988@gmail.com',
    from: 'Dustin McElroy <dustinmcelroy1988@gmail.com>',
    to: 'Marcus Sterling <msterling@apexcommerce.com>',
    subject: 'Architecture Milestone 1 Complete & Invoice #VDS-104 ($17,500)',
    date: '11/15/2025',
    timestamp: new Date('2025-11-15T18:00:00Z').getTime(),
    rawBody: `Marcus,

We have completed Milestone 1 (System Architecture & Database Schema). The staging test pass rate is 100%. Attached is Invoice #VDS-104 for the initial $17,500 installment per Section 3 of our agreement.

Looking forward to your review and wire confirmation.

Regards,
Dustin McElroy
Vanguard Digital Systems

> On Mon, Oct 12, 2025 at 2:30 PM, Marcus Sterling <msterling@apexcommerce.com> wrote:
> Attached is our countersigned Statement of Work for the cloud ERP integration. We have agreed upon the total fixed contract price of $45,000...
> CONFIDENTIALITY NOTICE: This transmission is intended solely for the designated recipient...`,
  },
  {
    id: 'msg-sample-003',
    threadId: 'th-002',
    accountId: 'acc-2',
    accountEmail: 'dustin.work.archive@gmail.com',
    from: 'Marcus Sterling <msterling@apexcommerce.com>',
    to: 'Dustin McElroy <dustin.work.archive@gmail.com>',
    subject: 'Wire Sent & Milestone 1 Approved',
    date: '11/19/2025',
    timestamp: new Date('2025-11-19T09:45:00Z').getTime(),
    rawBody: `Dustin,

The initial wire of $17,500 has been released by our treasury team. The architecture review was approved with zero objections. Please proceed immediately to Final Deployment and Integration (Milestone 2).

Thanks,
Marcus Sterling | CEO
Apex Commerce Corp.

CONFIDENTIALITY NOTICE: This email and any files transmitted with it are confidential...`,
  },
  {
    id: 'msg-sample-004',
    threadId: 'th-002',
    accountId: 'acc-2',
    accountEmail: 'dustin.work.archive@gmail.com',
    from: 'Dustin McElroy <dustin.work.archive@gmail.com>',
    to: 'Marcus Sterling <msterling@apexcommerce.com>',
    subject: 'FINAL DEPLOYMENT COMPLETE - Acceptance Testing & Invoice #VDS-118 ($27,500)',
    date: '12/20/2025',
    timestamp: new Date('2025-12-20T16:15:00Z').getTime(),
    rawBody: `Marcus,

Final deployment has been successfully completed in your production environment as of December 20, 2025. All acceptance tests have cleared, and your team has taken administrative control of the system.

Attached is final Invoice #VDS-118 in the amount of $27,500.00, due within 15 calendar days (January 4, 2026).

Thank you for your partnership.

Best,
Dustin McElroy

Sent from my iPhone`,
  },
  {
    id: 'msg-sample-005',
    threadId: 'th-001',
    accountId: 'acc-1',
    accountEmail: 'dustinmcelroy1988@gmail.com',
    from: 'Marcus Sterling <msterling@apexcommerce.com>',
    to: 'Dustin McElroy <dustinmcelroy1988@gmail.com>',
    subject: 'Re: Final Invoice #VDS-118 ($27,500) - Budget freeze',
    date: '01/08/2026',
    timestamp: new Date('2026-01-08T11:20:00Z').getTime(),
    rawBody: `Dustin,

I know the software is live and working smoothly, but our board of directors instituted an emergency Q1 budget freeze across all vendor payments. We cannot release the remaining $27,500 at this time. 

Perhaps we can offer you equity in our subsidiary or re-negotiate this invoice down to $10,000 paid over the next 12 months. Let me know your thoughts.

Regards,
Marcus Sterling
CEO, Apex Commerce Corp.

> On Sat, Dec 20, 2025 at 4:15 PM, Dustin McElroy <dustin.work.archive@gmail.com> wrote:
> Attached is final Invoice #VDS-118 in the amount of $27,500.00, due within 15 calendar days (January 4, 2026)...`,
  },
  {
    id: 'msg-sample-006',
    threadId: 'th-001',
    accountId: 'acc-1',
    accountEmail: 'dustinmcelroy1988@gmail.com',
    from: 'Dustin McElroy <dustinmcelroy1988@gmail.com>',
    to: 'Marcus Sterling <msterling@apexcommerce.com>',
    subject: 'FORMAL NOTICE OF DEFAULT & DEMAND FOR IMMEDIATE CURE',
    date: '01/14/2026',
    timestamp: new Date('2026-01-14T10:00:00Z').getTime(),
    rawBody: `Marcus,

Your proposal to compromise an undisputed $27,500 invoice is rejected. You explicitly conceded that the software is "live and working smoothly."

Under Section 8.2 of our agreement, you have ten (10) business days from this notice to cure this default. If payment of $27,500 is not received in full by January 28, 2026, we will immediately commence formal litigation for breach of contract, statutory interest, and collection expenses.

Please treat this email as formal pre-litigation notice and a preservation demand for all related communications.

Sincerely,
Dustin McElroy
Vanguard Digital Systems LLC`,
  },
];

export const SAMPLE_EMAILS: EmailMessage[] = rawEmails.map((item, idx) => {
  const cleanedBody = cleanEmailBody(item.rawBody);
  const rawTokens = estimateTokens(item.rawBody);
  const cleanedTokens = estimateTokens(cleanedBody);
  const tokensSaved = Math.max(0, rawTokens - cleanedTokens);
  const extractedEntities = extractEntitiesLocally(cleanedBody, item.subject, item.from, item.to);

  return {
    ...item,
    cleanedBody,
    rawTokens,
    cleanedTokens,
    tokensSaved,
    batesNumber: generateBatesNumber(idx, 'EXHIBIT A'),
    isSelected: true,
    extractedEntities,
    snippet: cleanedBody.slice(0, 160) + '...',
    hasAttachment: item.rawBody.toLowerCase().includes('attached'),
    labels: classifyEmailContent(cleanedBody, item.subject, item.from, item.to),
  };
});
