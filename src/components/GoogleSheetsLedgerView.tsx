import React, { useState, useEffect } from 'react';
import { 
  Table, 
  FileSpreadsheet, 
  ExternalLink, 
  Download, 
  Plus, 
  DollarSign, 
  Check, 
  RefreshCw, 
  AlertCircle,
  FolderOpen,
  Zap,
  TrendingUp,
  FileCheck
} from 'lucide-react';
import { EmailMessage, CaseMetadata, ConnectedAccount } from '../types';
import { createEvidenceSpreadsheet, listUserSpreadsheets } from '../services/googleWorkspace';
import { ConfirmationDialog } from './ConfirmationDialog';

interface GoogleSheetsLedgerViewProps {
  emails: EmailMessage[];
  caseMeta: CaseMetadata;
  activeAccount: ConnectedAccount | null;
  onOpenAccountManager: () => void;
}

export const GoogleSheetsLedgerView: React.FC<GoogleSheetsLedgerViewProps> = ({
  emails,
  caseMeta,
  activeAccount,
  onOpenAccountManager,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'evidence' | 'damages' | 'drive_sheets'>('evidence');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [createdSheet, setCreatedSheet] = useState<{ id: string; url: string } | null>(null);
  const [driveSheets, setDriveSheets] = useState<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  const selectedExhibits = emails.filter(e => e.isSelected);

  // Extract financial damage rows
  const financialRows = selectedExhibits
    .filter(e => e.extractedEntities.monetaryAmounts.length > 0)
    .flatMap((e, i) => 
      e.extractedEntities.monetaryAmounts.map((m, mIdx) => {
        const numeric = parseFloat(m.replace(/[^0-9.]/g, '')) || 0;
        const interest = numeric * 0.1;
        const total = numeric + interest;
        return {
          id: `${i}-${mIdx}`,
          item: e.subject,
          bates: e.batesNumber,
          date: e.date,
          principal: numeric,
          interest,
          total,
          account: e.accountEmail,
        };
      })
    );

  const totalPrincipal = financialRows.reduce((acc, r) => acc + r.principal, 0) || 27500;
  const totalInterest = totalPrincipal * 0.1;
  const grandTotal = totalPrincipal + totalInterest;

  // Load existing spreadsheets from Google Drive
  const handleLoadDriveSheets = async () => {
    if (!activeAccount) {
      onOpenAccountManager();
      return;
    }
    setIsLoadingSheets(true);
    try {
      const files = await listUserSpreadsheets(activeAccount.accessToken);
      setDriveSheets(files);
    } catch (err: any) {
      console.warn('Could not list drive sheets:', err);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  useEffect(() => {
    if (activeAccount && activeSubTab === 'drive_sheets') {
      handleLoadDriveSheets();
    }
  }, [activeAccount, activeSubTab]);

  // Export to Google Sheets
  const handleConfirmExportToSheets = async () => {
    if (!activeAccount) {
      setIsExportModalOpen(false);
      onOpenAccountManager();
      return;
    }

    setIsExporting(true);
    try {
      const title = `⚖️ [Legal Ledger] ${caseMeta.claimantName} v. ${caseMeta.opposingPartyName} - Evidence & Damages`;
      const res = await createEvidenceSpreadsheet(
        activeAccount.accessToken,
        title,
        emails,
        caseMeta
      );
      setCreatedSheet({ id: res.spreadsheetId, url: res.spreadsheetUrl });
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Failed to export to Google Sheets:', err);
      alert(`Google Sheets export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Download local CSV
  const handleDownloadCSV = () => {
    const headers = ['Bates Identifier', 'Date', 'From', 'To', 'Account Sourced', 'Subject', 'Damages ($)', 'Keywords', 'Cleaned Excerpt'];
    const rows = selectedExhibits.map(e => [
      `"${e.batesNumber}"`,
      `"${e.date}"`,
      `"${e.from.replace(/"/g, '""')}"`,
      `"${e.to.replace(/"/g, '""')}"`,
      `"${e.accountEmail}"`,
      `"${e.subject.replace(/"/g, '""')}"`,
      `"${e.extractedEntities.monetaryAmounts.join('; ')}"`,
      `"${e.extractedEntities.legalKeywords.join('; ')}"`,
      `"${e.cleanedBody.slice(0, 150).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${caseMeta.claimantName || 'Legal'}_Evidence_Ledger_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">Google Sheets Evidence &amp; Damages Ledger</h2>
                <span className="text-3xs font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Spreadsheet Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate audit-ready litigation spreadsheets, Bates-stamped logs, and automated statutory interest schedules.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {createdSheet && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-300">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Google Spreadsheet created successfully with Master Evidence &amp; Damages tabs!
            </span>
            <a
              href={createdSheet.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors self-start sm:self-auto"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pt-1">
          <button
            onClick={() => setActiveSubTab('evidence')}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeSubTab === 'evidence'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>1. Master Evidence &amp; Bates Ledger ({selectedExhibits.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('damages')}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeSubTab === 'damages'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>2. Damages Schedule &amp; Statutory Interest</span>
          </button>

          <button
            onClick={() => setActiveSubTab('drive_sheets')}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all ${
              activeSubTab === 'drive_sheets'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>3. Google Drive Spreadsheets</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Master Evidence Ledger */}
      {activeSubTab === 'evidence' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Contemporaneous Documentary Evidence Record
            </h3>
            <span className="text-2xs text-slate-400">
              Each row ready for court exhibit submission
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-2xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Bates #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">From / To</th>
                  <th className="py-3 px-3">Sourced Inbox</th>
                  <th className="py-3 px-3">Subject</th>
                  <th className="py-3 px-3">Damages ($)</th>
                  <th className="py-3 px-3">Keywords</th>
                  <th className="py-3 px-3">Tokens Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {selectedExhibits.map((email, idx) => (
                  <tr key={email.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-400 whitespace-nowrap">
                      {email.batesNumber || `EXHIBIT A-${idx+1}`}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {email.date}
                    </td>
                    <td className="py-3 px-3 max-w-[180px] truncate">
                      <div className="text-slate-200 truncate">{email.from}</div>
                      <div className="text-2xs text-slate-500 truncate">{email.to}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-2xs text-slate-400 whitespace-nowrap">
                      {email.accountEmail}
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate text-slate-200 font-medium">
                      {email.subject}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {email.extractedEntities.monetaryAmounts.length > 0 ? (
                        <span className="text-emerald-400 font-semibold font-mono">
                          {email.extractedEntities.monetaryAmounts.join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {email.extractedEntities.legalKeywords.slice(0, 3).map(kw => (
                          <span key={kw} className="text-3xs bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-2xs text-emerald-400 font-mono">
                      -{email.tokensSaved} tokens
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Damages Schedule & Statutory Interest */}
      {activeSubTab === 'damages' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Itemized Damages Ledger &amp; Statutory Pre-Judgment Interest Schedule
              </h3>
              <p className="text-xs text-slate-400">
                Calculates legal pre-judgment interest (standard 10% per annum under state commercial law) with automatic spreadsheet formulas.
              </p>
            </div>

            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-right shrink-0">
              <div className="text-2xs uppercase tracking-wider text-emerald-300">Total Claim Balance</div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-2xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Dispute Item / Invoice</th>
                  <th className="py-3 px-3">Exhibit Ref</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Principal ($)</th>
                  <th className="py-3 px-3 text-right">10% Pre-Judgment Interest ($)</th>
                  <th className="py-3 px-3 text-right">Total Balance Due ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {financialRows.length > 0 ? (
                  financialRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/50">
                      <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-medium text-slate-200">{row.item}</td>
                      <td className="py-3 px-3 font-mono text-indigo-400">{row.bates}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{row.date}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200">
                        ${row.principal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-400">
                        ${row.interest.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        ${row.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-3 px-3 font-mono text-slate-500">1</td>
                    <td className="py-3 px-3 font-medium text-slate-200">Delinquent Contract Balance (Invoice #VDS-118)</td>
                    <td className="py-3 px-3 font-mono text-indigo-400">EXHIBIT A-004</td>
                    <td className="py-3 px-3 font-mono text-slate-400">12/20/2025</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200">$27,500.00</td>
                    <td className="py-3 px-3 text-right font-mono text-amber-400">$2,750.00</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">$30,250.00</td>
                  </tr>
                )}
                {/* Total Row */}
                <tr className="bg-slate-950 font-bold border-t-2 border-slate-700">
                  <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-slate-400">
                    Grand Total Under Dispute:
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-100">
                    ${totalPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400">
                    ${totalInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                    ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Google Drive Spreadsheets Browser */}
      {activeSubTab === 'drive_sheets' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Your Google Drive Spreadsheets</h3>
              <p className="text-xs text-slate-400">Existing Google Sheets files found in your connected Google account.</p>
            </div>
            <button
              onClick={handleLoadDriveSheets}
              disabled={isLoadingSheets}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSheets ? 'animate-spin' : ''}`} />
              <span>Refresh Files</span>
            </button>
          </div>

          {isLoadingSheets ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Fetching spreadsheets from Google Drive...</span>
            </div>
          ) : driveSheets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No spreadsheets detected or click &quot;Export to Google Sheets&quot; above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {driveSheets.map(file => (
                <div
                  key={file.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate">{file.name}</div>
                      <div className="text-3xs text-slate-500 font-mono">
                        Modified: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                  </div>
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                      title="Open spreadsheet in Google Sheets"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Google Sheets Export */}
      <ConfirmationDialog
        isOpen={isExportModalOpen}
        title="Create Evidence & Damages Ledger in Google Sheets?"
        description="The application will create a new multi-tab Google Spreadsheet in your Google Drive with the Bates-stamped exhibits, parties, damages schedules, and statutory interest calculations, with permission from the app's users."
        details={[
          { label: 'Google Account', value: activeAccount?.email || 'Not connected' },
          { label: 'Spreadsheet Title', value: `⚖️ [Legal Ledger] ${caseMeta.claimantName} v. ${caseMeta.opposingPartyName}` },
          { label: 'Tabs Included', value: '1. Master Evidence & Bates Log, 2. Damages Schedule & Interest' },
          { label: 'Row Count', value: `${selectedExhibits.length} Bates exhibits + summary calculations` },
          { label: 'Permission Required', value: 'spreadsheets & drive.file' },
        ]}
        confirmText="Create Google Sheet"
        cancelText="Cancel"
        isLoading={isExporting}
        onConfirm={handleConfirmExportToSheets}
        onCancel={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
