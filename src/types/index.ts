export interface ConnectedAccount {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  accessToken: string;
  addedAt: number;
}

export interface ExtractedEntities {
  dates: string[];
  monetaryAmounts: string[];
  legalKeywords: string[];
  parties: string[];
}

export interface EmailMessage {
  id: string;
  threadId: string;
  accountId: string;
  accountEmail: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  timestamp: number;
  rawBody: string;
  cleanedBody: string;
  rawTokens: number;
  cleanedTokens: number;
  tokensSaved: number;
  batesNumber: string;
  isSelected: boolean;
  extractedEntities: ExtractedEntities;
  snippet?: string;
  hasAttachment?: boolean;
  labels: string[];
}

export type LegalTag = 
  | 'Contractual'
  | 'Payment'
  | 'Liability'
  | 'Notice & Demand'
  | 'Admission & Defense'
  | 'Correspondence';

export type BudgetMode = 'zero_local' | 'eco' | 'standard' | 'deep';

export interface CaseMetadata {
  title: string;
  claimantName: string;
  opposingPartyName: string;
  jurisdiction: string;
  summary: string;
  demandedAmount: string;
  causeOfAction: string;
}

export interface LegalElement {
  element: string;
  status: 'Strong' | 'Moderate' | 'Vulnerable';
  supportingExhibits: string[];
  factualAnalysis: string;
  gapsAndDiscovery: string;
}

export interface AnticipatedDefense {
  defense: string;
  likelihood: 'High' | 'Medium' | 'Low';
  counterRefutation: string;
}

export interface TimelineKeyDate {
  date: string;
  significance: string;
  exhibitRef: string;
  syncedToCalendar?: boolean;
  calendarEventId?: string;
}

export interface SettlementLeverage {
  rating: 'Strong' | 'Moderate' | 'Weak';
  rationale: string;
  recommendedStrategy: string;
}

export interface LegalStrategyResult {
  executiveSummary: string;
  elementsOfProof: LegalElement[];
  anticipatedDefenses: AnticipatedDefense[];
  timelineKeyDates: TimelineKeyDate[];
  settlementLeverage: SettlementLeverage;
  recommendedActionItems: string[];
  generatedAt: number;
  budgetMode: BudgetMode;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type DocumentType = 
  | 'demand_letter'
  | 'sworn_declaration'
  | 'chronological_facts'
  | 'exhibit_index'
  | 'discovery_requests'
  | 'strategy_memo';

export interface ReproducedDocument {
  id: string;
  type: DocumentType;
  title: string;
  content: string;
  createdAt: number;
  driveFileId?: string;
  driveFileUrl?: string;
  mode: 'template' | 'ai';
}
