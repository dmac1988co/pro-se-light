import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Copy, 
  Check, 
  FolderSync, 
  ExternalLink, 
  Printer, 
  RefreshCw, 
  Sparkles, 
  Zap, 
  AlertCircle,
  FileCheck,
  Edit3,
  Eye,
  Send
} from 'lucide-react';
import { 
  DocumentType, 
  CaseMetadata, 
  EmailMessage, 
  LegalStrategyResult, 
  ConnectedAccount 
} from '../types';
import { generateLocalDocument } from '../utils/creditOptimizer';
import { exportDocumentToDrive } from '../services/googleWorkspace';
import { ConfirmationDialog } from './ConfirmationDialog';

interface DocumentReproductionViewProps {
  caseMeta: CaseMetadata;
  emails: EmailMessage[];
  strategyResult: LegalStrategyResult | null;
  activeAccount: ConnectedAccount | null;
  onOpenAccountManager: () => void;
}

const DOCUMENT_OPTIONS: { type: DocumentType; label: string; desc: string; icon: string }[] = [
  {
    type: 'demand_letter',
    label: 'Formal Demand Letter & Notice of Default',
    desc: 'Pre-litigation letter demanding payment/cure, setting 10-day deadline, and litigation hold notice.',
    icon: '⚖️',
  },
  {
    type: 'sworn_declaration',
    label: 'Sworn Declaration Under Penalty of Perjury',
    desc: 'Formal declaration pursuant to 28 U.S.C. § 1746 authenticating the email exhibits as true business records.',
    icon: '✍️',
  },
  {
    type: 'chronological_facts',
    label: 'Chronological Statement of Undisputed Facts',
    desc: 'Formal court table of undisputed facts with corresponding Bates citations.',
    icon: '📋',
  },
  {
    type: 'exhibit_index',
    label: 'Formal Evidence Exhibit Index & Binder',
    desc: 'Bates-stamped cover index and evidence summary for legal counsel and court filing.',
    icon: '📁',
  },
  {
    type: 'discovery_requests',
    label: 'Interrogatories & Requests for Production',
    desc: 'First set of formal discovery requests targeting opposing party emails and accounting records.',
    icon: '🔍',
  },
];

export const DocumentReproductionView: React.FC<DocumentReproductionViewProps> = ({
  caseMeta,
  emails,
  strategyResult,
  activeAccount,
  onOpenAccountManager,
}) => {
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('demand_letter');
  const [reproductionMode, setReproductionMode] = useState<'template' | 'ai'>('template');
  const [docContent, setDocContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Drive state
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [savedDriveFile, setSavedDriveFile] = useState<{ id: string; url?: string } | null>(null);

  const selectedExhibits = emails.filter(e => e.isSelected);

  // Initialize or re-generate document
  const handleGenerateDocument = async () => {
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      if (reproductionMode === 'template') {
        // Zero AI credits: generate locally
        const localDoc = generateLocalDocument(selectedDocType, caseMeta, emails);
        setDocContent(localDoc);
      } else {
        // AI formulation
        const docOption = DOCUMENT_OPTIONS.find(d => d.type === selectedDocType);
        const payload = {
          docType: docOption?.label || selectedDocType,
          caseInfo: caseMeta,
          exhibits: selectedExhibits.map(e => ({
            batesNumber: e.batesNumber,
            date: e.date,
            from: e.from,
            to: e.to,
            subject: e.subject,
            cleanedSnippet: e.cleanedBody.slice(0, 450),
          })),
          customInstructions,
          budgetMode: 'eco',
        };

        const res = await fetch('/api/ai/reproduce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error (${res.status})`);
        }

        const data = await res.json();
        setDocContent(data.documentText || '');
      }
    } catch (err: any) {
      console.error('Document reproduction error:', err);
      setErrorMsg(err.message || 'Error reproducing document. Try Zero-Credit Template mode.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto generate template on first render if empty
  React.useEffect(() => {
    if (!docContent) {
      const initialDoc = generateLocalDocument(selectedDocType, caseMeta, emails);
      setDocContent(initialDoc);
    }
  }, [selectedDocType]);

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(docContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Download as text/markdown file
  const handleDownload = () => {
    const blob = new Blob([docContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseMeta.claimantName || 'Legal'}_${selectedDocType}_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Confirm Save to Google Drive
  const handleConfirmSaveToDrive = async () => {
    if (!activeAccount) {
      setIsDriveModalOpen(false);
      onOpenAccountManager();
      return;
    }

    setIsSavingToDrive(true);
    try {
      const title = `${caseMeta.claimantName || 'Legal'}_${selectedDocType.toUpperCase()}`;
      const result = await exportDocumentToDrive(activeAccount.accessToken, title, docContent);
      setSavedDriveFile({
        id: result.fileId,
        url: result.webViewLink || `https://drive.google.com/file/d/${result.fileId}/view`,
      });
      setIsDriveModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save to Drive:', err);
      alert(`Error saving to Google Drive: ${err.message}`);
    } finally {
      setIsSavingToDrive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Document Chooser */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Legal Document Reproduction Engine</h2>
              <p className="text-xs text-slate-400">
                Reproduce formal legal documents incorporating your Bates-stamped exhibits and factual record.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setReproductionMode('template')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                reproductionMode === 'template'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ⚡ Instant Template (0 Credits)
            </button>
            <button
              onClick={() => setReproductionMode('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                reproductionMode === 'ai'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              AI-Refined Drafting (~800 tokens)
            </button>
          </div>
        </div>

        {/* Document Type Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DOCUMENT_OPTIONS.map(doc => {
            const isSelected = selectedDocType === doc.type;
            return (
              <button
                key={doc.type}
                type="button"
                onClick={() => setSelectedDocType(doc.type)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{doc.icon}</span>
                  <span className={`text-xs font-bold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {doc.label}
                  </span>
                </div>
                <p className="text-2xs text-slate-400 leading-normal">{doc.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Optional Custom Instructions when in AI mode */}
        {reproductionMode === 'ai' && (
          <div className="space-y-1.5 text-xs">
            <label className="text-slate-400 font-medium">Specific Clauses or Custom Instructions (Optional)</label>
            <input
              type="text"
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder="e.g. Emphasize their admission regarding the ERP go-live and insist on wire payment within 5 business days..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        )}

        {/* Action button */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-2xs text-slate-400">
            Incorporates <strong className="text-indigo-400">{selectedExhibits.length}</strong> selected Bates-stamped exhibits into document.
          </span>

          <button
            onClick={handleGenerateDocument}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reproducing Document...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-3.5 h-3.5" />
                <span>Generate / Refresh Document</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Document Workspace & Preview */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        {/* Document Action Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Document Drafting &amp; Output Workspace
            </span>
            <span className="text-2xs text-slate-500 font-mono">(Editable in-place)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Save to Google Drive Button */}
            <button
              onClick={() => setIsDriveModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-all"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>Save to Google Drive</span>
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>
        </div>

        {/* Saved to Drive success banner */}
        {savedDriveFile && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Document successfully exported and saved to your Google Drive!
            </span>
            {savedDriveFile.url && (
              <a
                href={savedDriveFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors"
              >
                <span>Open in Google Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Text Area Document Editor */}
        <div className="relative">
          <textarea
            rows={22}
            value={docContent}
            onChange={e => setDocContent(e.target.value)}
            className="w-full p-5 bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 rounded-xl leading-relaxed focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
            placeholder="Reproduced legal document will render here..."
          />
        </div>
      </div>

      {/* Confirmation Dialog for Google Drive Export */}
      <ConfirmationDialog
        isOpen={isDriveModalOpen}
        title="Export Legal Document to Google Drive?"
        description="The application will create a new Markdown/Document file in your Google Drive with the reproduced legal document and attached evidence references, with permission from the app's users."
        details={[
          { label: 'Google Account', value: activeAccount?.email || 'Not connected (will prompt login)' },
          { label: 'Document Title', value: `${caseMeta.claimantName || 'Legal'}_${selectedDocType.toUpperCase()}.md` },
          { label: 'Attached Exhibits', value: `${selectedExhibits.length} Bates-stamped records` },
          { label: 'Google API Permission', value: 'drive.file (scoped to files created by this app)' },
        ]}
        confirmText="Save to Google Drive"
        cancelText="Cancel"
        isLoading={isSavingToDrive}
        onConfirm={handleConfirmSaveToDrive}
        onCancel={() => setIsDriveModalOpen(false)}
      />
    </div>
  );
};
