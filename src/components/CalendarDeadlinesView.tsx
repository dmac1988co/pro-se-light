import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Check, 
  ExternalLink, 
  Clock, 
  AlertCircle, 
  CalendarCheck, 
  RefreshCw,
  Zap,
  Tag,
  Download
} from 'lucide-react';
import { TimelineKeyDate, CaseMetadata, ConnectedAccount, EmailMessage, LegalStrategyResult } from '../types';
import { createCalendarDeadline } from '../services/googleWorkspace';
import { ConfirmationDialog } from './ConfirmationDialog';
import { exportStrategyAndTimelinePdf } from '../utils/pdfExport';
import { generateLocalStrategy } from '../utils/creditOptimizer';

interface CalendarDeadlinesViewProps {
  deadlines: TimelineKeyDate[];
  setDeadlines: React.Dispatch<React.SetStateAction<TimelineKeyDate[]>>;
  caseMeta: CaseMetadata;
  activeAccount: ConnectedAccount | null;
  onOpenAccountManager: () => void;
  emails: EmailMessage[];
  strategyResult?: LegalStrategyResult | null;
}

export const CalendarDeadlinesView: React.FC<CalendarDeadlinesViewProps> = ({
  deadlines,
  setDeadlines,
  caseMeta,
  activeAccount,
  onOpenAccountManager,
  emails,
  strategyResult,
}) => {
  const [selectedForSync, setSelectedForSync] = useState<TimelineKeyDate | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedEvents, setSyncedEvents] = useState<Record<string, string>>({}); // date -> calendar link
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  // Export PDF function
  const handleExportPdf = () => {
    const strat = strategyResult || generateLocalStrategy(caseMeta, emails);
    exportStrategyAndTimelinePdf({
      caseMeta,
      strategyResult: strat,
      deadlines: deadlines.length > 0 ? deadlines : strat.timelineKeyDates,
      emails,
    });
  };
  const [newSignificance, setNewSignificance] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Open modal to confirm single sync
  const handleOpenSyncModal = (item: TimelineKeyDate) => {
    if (!activeAccount) {
      onOpenAccountManager();
      return;
    }
    setSelectedForSync(item);
    setIsSyncModalOpen(true);
  };

  // Perform Google Calendar event creation
  const handleConfirmCalendarSync = async () => {
    if (!selectedForSync || !activeAccount) return;

    setIsSyncing(true);
    try {
      const result = await createCalendarDeadline(activeAccount.accessToken, {
        title: selectedForSync.significance,
        description: `Legal deadline associated with ${selectedForSync.exhibitRef || 'Exhibit record'}.\n\nSignificance: ${selectedForSync.significance}\nClaimant: ${caseMeta.claimantName}\nOpposing: ${caseMeta.opposingPartyName}`,
        dateStr: selectedForSync.date,
        caseTitle: caseMeta.title,
      });

      setSyncedEvents(prev => ({
        ...prev,
        [selectedForSync.date]: result.htmlLink || 'https://calendar.google.com',
      }));

      // Update deadlines state
      setDeadlines(prev => prev.map(d => d.date === selectedForSync.date ? { ...d, syncedToCalendar: true } : d));
      setIsSyncModalOpen(false);
    } catch (err: any) {
      console.error('Calendar sync failed:', err);
      alert(`Failed to sync to Google Calendar: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add custom deadline
  const handleAddCustomDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newSignificance) return;

    const newItem: TimelineKeyDate = {
      date: newDate,
      significance: newSignificance,
      exhibitRef: 'MANUAL ENTRY',
      syncedToCalendar: false,
    };

    setDeadlines(prev => [...prev, newItem].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    setIsAddingCustom(false);
    setNewDate('');
    setNewSignificance('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Statutory &amp; Evidentiary Deadlines</h2>
              <p className="text-xs text-slate-400">
                Track critical notice expirations, cure periods, and statute of limitations with Google Calendar sync.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all"
              title="Export complete legal strategy and timeline brief as a publication-ready PDF"
            >
              <Download className="w-4 h-4" />
              <span>Export Timeline &amp; Strategy PDF</span>
            </button>

            <button
              onClick={() => setIsAddingCustom(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Add Critical Date</span>
            </button>
          </div>
        </div>

        {/* Custom Deadline Form */}
        {isAddingCustom && (
          <form onSubmit={handleAddCustomDeadline} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Add New Case Deadline or Hearing
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Significance / Deadline Description</label>
                <input
                  type="text"
                  required
                  value={newSignificance}
                  onChange={e => setNewSignificance(e.target.value)}
                  placeholder="e.g. 10-Day Pre-Litigation Demand Cure Expiration"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingCustom(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                Save Date
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Deadlines Timeline List */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Case Chronology &amp; Deadlines Timeline ({deadlines.length})
          </h3>
          <span className="text-2xs text-slate-400">
            Click &quot;Sync to Google Calendar&quot; to push notifications to your primary calendar.
          </span>
        </div>

        {deadlines.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No deadlines detected yet. Run &quot;Formulate Legal Strategy&quot; in Step 2 or add custom dates above.
          </div>
        ) : (
          <div className="space-y-3">
            {deadlines.map((item, idx) => {
              const isSynced = item.syncedToCalendar || Boolean(syncedEvents[item.date]);
              const calendarLink = syncedEvents[item.date];

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-slate-700"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-500/20 shrink-0 font-mono text-xs font-bold text-center min-w-[70px]">
                      {item.date}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100">
                          {item.significance}
                        </h4>
                        {item.exhibitRef && (
                          <span className="text-3xs font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                            {item.exhibitRef}
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-slate-400">
                        Matter: <strong className="text-slate-300">{caseMeta.claimantName}</strong> v.{' '}
                        <strong className="text-slate-300">{caseMeta.opposingPartyName}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {isSynced ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-2xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          <Check className="w-3.5 h-3.5" />
                          <span>Synced to Calendar</span>
                        </span>
                        {calendarLink && (
                          <a
                            href={calendarLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenSyncModal(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Sync to Google Calendar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Calendar Event Sync */}
      <ConfirmationDialog
        isOpen={isSyncModalOpen}
        title="Schedule Event in Google Calendar?"
        description="The application will create a new calendar entry in your Google Calendar with reminders scheduled 1 day and 3 days before the deadline, with permission from the app's users."
        details={[
          { label: 'Google Account', value: activeAccount?.email || 'Not connected' },
          { label: 'Event Summary', value: selectedForSync ? `⚖️ [LEGAL DEADLINE] ${selectedForSync.significance}` : '' },
          { label: 'Scheduled Date', value: selectedForSync?.date || '' },
          { label: 'Case Reference', value: `${caseMeta.title} (${selectedForSync?.exhibitRef || 'Record'})` },
          { label: 'Reminders', value: '1 day and 3 days prior via popup notifications' },
        ]}
        confirmText="Add to Calendar"
        cancelText="Cancel"
        isLoading={isSyncing}
        onConfirm={handleConfirmCalendarSync}
        onCancel={() => setIsSyncModalOpen(false)}
      />
    </div>
  );
};
