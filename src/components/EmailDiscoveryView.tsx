import React, { useState } from 'react';
import { 
  Search, 
  Mail, 
  Filter, 
  CheckSquare, 
  Square, 
  Calendar, 
  DollarSign, 
  Tag, 
  FileText, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  PlusCircle,
  Zap,
  Sparkles,
  ExternalLink,
  Tag as TagIcon,
  X as CloseIcon,
  Plus as PlusIcon,
  ShieldAlert,
  FileCheck,
  CheckCircle2,
  Wand2
} from 'lucide-react';
import { EmailMessage, ConnectedAccount, LegalTag } from '../types';
import { searchAcrossAccounts } from '../services/googleWorkspace';
import { cleanEmailBody, estimateTokens, extractEntitiesLocally, generateBatesNumber, classifyEmailContent } from '../utils/creditOptimizer';

interface EmailDiscoveryViewProps {
  emails: EmailMessage[];
  setEmails: React.Dispatch<React.SetStateAction<EmailMessage[]>>;
  accounts: ConnectedAccount[];
  activeAccount: ConnectedAccount | null;
  onOpenAccountManager: () => void;
  onProceedToStrategy: () => void;
  onLoadSampleData: () => void;
}

export const EmailDiscoveryView: React.FC<EmailDiscoveryViewProps> = ({
  emails,
  setEmails,
  accounts,
  activeAccount,
  onOpenAccountManager,
  onProceedToStrategy,
  onLoadSampleData,
}) => {
  const [searchQuery, setSearchQuery] = useState('breach OR contract OR payment OR invoice OR default');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [taggingFeedback, setTaggingFeedback] = useState<string | null>(null);
  const [editingTagEmailId, setEditingTagEmailId] = useState<string | null>(null);
  const [newCustomTag, setNewCustomTag] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [viewModes, setViewModes] = useState<Record<string, 'cleaned' | 'raw'>>({});
  const [copiedBates, setCopiedBates] = useState<string | null>(null);
  const [isManualPasteOpen, setIsManualPasteOpen] = useState(false);
  const [manualSubject, setManualSubject] = useState('');
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualBody, setManualBody] = useState('');

  // Count selected
  const selectedCount = emails.filter(e => e.isSelected).length;

  // Toggle selection
  const toggleSelectEmail = (id: string) => {
    setEmails(prev => prev.map(m => m.id === id ? { ...m, isSelected: !m.isSelected } : m));
  };

  const selectAll = (select: boolean) => {
    setEmails(prev => prev.map(m => ({ ...m, isSelected: select })));
  };

  // Local Zero-Credit Content Auto-Tagging
  const handleLocalAutoTag = () => {
    setIsTagging(true);
    setEmails(prev => prev.map(email => ({
      ...email,
      labels: classifyEmailContent(email.cleanedBody, email.subject, email.from, email.to),
    })));
    setTaggingFeedback(`⚡ Content analysis complete: auto-tagged ${emails.length} emails with legal labels (0 AI credits used).`);
    setTimeout(() => setTaggingFeedback(null), 4000);
    setIsTagging(false);
  };

  // AI Content-Based Deep Tagging
  const handleAiDeepTag = async () => {
    if (emails.length === 0) return;
    setIsTagging(true);
    setTaggingFeedback(null);
    try {
      const payload = {
        emails: emails.map(e => ({
          id: e.id,
          subject: e.subject,
          snippet: e.cleanedBody.slice(0, 180),
        })),
      };

      const res = await fetch('/api/ai/auto-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('AI tagging service unavailable');
      }

      const data = await res.json();
      if (data.tagsById) {
        setEmails(prev => prev.map(e => ({
          ...e,
          labels: data.tagsById[e.id] && data.tagsById[e.id].length > 0
            ? data.tagsById[e.id]
            : e.labels,
        })));
        setTaggingFeedback(`✨ AI Deep Tagging completed across ${emails.length} emails using content analysis.`);
        setTimeout(() => setTaggingFeedback(null), 4000);
      }
    } catch (err: any) {
      console.warn('AI tagging failed, falling back to local auto-tag:', err);
      handleLocalAutoTag();
    } finally {
      setIsTagging(false);
    }
  };

  // Add individual tag
  const handleAddTag = (emailId: string, tag: string) => {
    if (!tag.trim()) return;
    const cleanTag = tag.trim();
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        const existing = e.labels || [];
        if (existing.includes(cleanTag)) return e;
        return { ...e, labels: [...existing, cleanTag] };
      }
      return e;
    }));
    setEditingTagEmailId(null);
    setNewCustomTag('');
  };

  // Remove tag
  const handleRemoveTag = (emailId: string, tagToRemove: string) => {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        return { ...e, labels: (e.labels || []).filter(l => l !== tagToRemove) };
      }
      return e;
    }));
  };

  // Tag styling helper
  const getTagBadgeStyle = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'contractual':
        return {
          bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          icon: '📜',
        };
      case 'payment':
        return {
          bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: '💰',
        };
      case 'liability':
        return {
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: '⚠️',
        };
      case 'notice & demand':
      case 'notice':
        return {
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          icon: '🚨',
        };
      case 'admission & defense':
        return {
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          icon: '⚖️',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: '🏷️',
        };
    }
  };

  // Compute tag counts for filter tabs
  const tagCounts: Record<string, number> = {
    all: emails.length,
    Contractual: 0,
    Payment: 0,
    Liability: 0,
    'Notice & Demand': 0,
  };

  emails.forEach(e => {
    (e.labels || []).forEach(lbl => {
      tagCounts[lbl] = (tagCounts[lbl] || 0) + 1;
    });
  });

  // Switch view mode for an email
  const toggleViewMode = (id: string) => {
    setViewModes(prev => ({
      ...prev,
      [id]: prev[id] === 'raw' ? 'cleaned' : 'raw'
    }));
  };

  // Copy Bates reference
  const handleCopyBates = (bates: string) => {
    navigator.clipboard.writeText(bates);
    setCopiedBates(bates);
    setTimeout(() => setCopiedBates(null), 2000);
  };

  // Perform Gmail Search across accounts
  const handleSearch = async () => {
    if (accounts.length === 0) {
      onOpenAccountManager();
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const targetAccounts = selectedAccountFilter === 'all'
        ? accounts
        : accounts.filter(a => a.email === selectedAccountFilter);

      const results = await searchAcrossAccounts(targetAccounts, searchQuery);

      if (results.length === 0) {
        setSearchError(`No emails found matching query "${searchQuery}" in ${targetAccounts.length} connected account(s).`);
      } else {
        setEmails(results);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError(err.message || 'Error communicating with Gmail API. Verify that permissions are granted.');
    } finally {
      setIsSearching(false);
    }
  };

  // Manual Add Email
  const handleAddManualEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBody.trim()) return;

    const cleanedBody = cleanEmailBody(manualBody);
    const rawTokens = estimateTokens(manualBody);
    const cleanedTokens = estimateTokens(cleanedBody);
    const tokensSaved = Math.max(0, rawTokens - cleanedTokens);
    const entities = extractEntitiesLocally(cleanedBody, manualSubject, manualFrom, manualTo);
    const classifiedTags = classifyEmailContent(cleanedBody, manualSubject, manualFrom, manualTo);
    const newIdx = emails.length;

    const newEmail: EmailMessage = {
      id: `manual-${Date.now()}`,
      threadId: `th-manual-${Date.now()}`,
      accountId: 'manual-import',
      accountEmail: manualFrom.includes('@') ? manualFrom : 'imported@external.com',
      from: manualFrom || 'Opposing Party <counsel@opposing.com>',
      to: manualTo || 'Client <client@domain.com>',
      subject: manualSubject || 'Manual Evidentiary Communication',
      date: manualDate || new Date().toLocaleDateString(),
      timestamp: manualDate ? new Date(manualDate).getTime() : Date.now(),
      rawBody: manualBody,
      cleanedBody,
      rawTokens,
      cleanedTokens,
      tokensSaved,
      batesNumber: generateBatesNumber(newIdx, 'EXHIBIT A'),
      isSelected: true,
      extractedEntities: entities,
      snippet: cleanedBody.slice(0, 160) + '...',
      hasAttachment: false,
      labels: classifiedTags,
    };

    setEmails(prev => [...prev, newEmail]);
    setIsManualPasteOpen(false);
    setManualBody('');
    setManualSubject('');
  };

  // Filtered view by account selector AND tag filter
  const filteredEmails = emails.filter(e => {
    const matchesAccount = selectedAccountFilter === 'all' || e.accountEmail === selectedAccountFilter;
    const matchesTag = selectedTagFilter === 'all' || (e.labels || []).includes(selectedTagFilter);
    return matchesAccount && matchesTag;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls & Search Bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Query Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search terms, senders, or legal tags (e.g. breach OR invoice OR 'cure default')..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans"
            />
          </div>

          {/* Account Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedAccountFilter}
              onChange={e => setSelectedAccountFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="all">
                All Accounts ({accounts.length} connected)
              </option>
              {accounts.map(acc => (
                <option key={acc.email} value={acc.email}>
                  {acc.email}
                </option>
              ))}
            </select>

            {/* Execute Search Button */}
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 shrink-0"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching Inboxes...</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Search Gmail</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggested Legal Query Badges & Helper Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-400">
            <span className="text-2xs uppercase tracking-wider font-semibold text-slate-500 mr-1">
              Suggested:
            </span>
            {[
              'breach OR contract',
              'invoice OR payment overdue',
              'demand OR cure',
              'default OR terminate',
              'agreement OR signed',
            ].map(pill => (
              <button
                key={pill}
                onClick={() => {
                  setSearchQuery(pill);
                }}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-2xs transition-colors"
              >
                {pill}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsManualPasteOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import / Paste Email</span>
            </button>
            <button
              onClick={onLoadSampleData}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-500/30 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Load Sample Dispute Case</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Error Notice */}
      {searchError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Discovery Notice</p>
            <p className="text-amber-300/80">{searchError}</p>
          </div>
        </div>
      )}

      {/* Auto-Tagging & Classification Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
        {/* Filter by Tag Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <TagIcon className="w-3 h-3 text-indigo-400" />
            Filter By Label:
          </span>
          <button
            onClick={() => setSelectedTagFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-2xs font-medium transition-all ${
              selectedTagFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Emails ({emails.length})
          </button>
          {(['Contractual', 'Payment', 'Liability', 'Notice & Demand', 'Admission & Defense'] as LegalTag[]).map(tag => {
            const count = tagCounts[tag] || 0;
            const isSelected = selectedTagFilter === tag;
            const style = getTagBadgeStyle(tag);
            return (
              <button
                key={tag}
                onClick={() => setSelectedTagFilter(isSelected ? 'all' : tag)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-medium border transition-all ${
                  isSelected
                    ? 'ring-1 ring-white/20 bg-indigo-600 text-white border-indigo-400'
                    : `${style.bg} hover:brightness-125`
                }`}
              >
                <span>{style.icon}</span>
                <span>{tag}</span>
                <span className="text-3xs opacity-80 px-1 py-0.2 bg-black/20 rounded-full font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons to Auto-Tag */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button
            onClick={handleLocalAutoTag}
            disabled={isTagging || emails.length === 0}
            title="Automatically classify all emails using content analysis (Zero AI tokens)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ Auto-Tag (Local 0-Credits)</span>
          </button>

          <button
            onClick={handleAiDeepTag}
            disabled={isTagging || emails.length === 0}
            title="Use Gemini to perform nuanced legal classification on all emails"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            {isTagging ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Tagging...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>✨ AI Deep Tagging</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tagging Feedback Banner */}
      {taggingFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{taggingFeedback}</span>
        </div>
      )}

      {/* Evidence Controls & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectAll(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Select All
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => selectAll(false)}
              className="text-xs text-slate-400 hover:text-slate-300 font-medium"
            >
              Deselect All
            </button>
          </div>
          <span className="text-xs text-slate-400">
            • <strong className="text-slate-200">{selectedCount}</strong> of{' '}
            <strong className="text-slate-200">{filteredEmails.length}</strong> exhibits selected for strategy
          </span>
        </div>

        {selectedCount > 0 && (
          <button
            onClick={onProceedToStrategy}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
          >
            <span>Proceed to Legal Strategy ({selectedCount} Exhibits)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Email / Evidence Cards List */}
      {filteredEmails.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">No Emails Loaded in Evidentiary Record</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Search your connected Gmail accounts using the bar above, connect additional Google accounts, or load the realistic sample contract dispute case.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenAccountManager}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Manage Google Inboxes
            </button>
            <button
              onClick={onLoadSampleData}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors"
            >
              Load Sample Dispute (6 Emails)
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmails.map((email, idx) => {
            const isExpanded = expandedEmailId === email.id;
            const currentView = viewModes[email.id] || 'cleaned';
            const displayBody = currentView === 'cleaned' ? email.cleanedBody : email.rawBody;

            return (
              <div
                key={email.id}
                className={`rounded-2xl border transition-all ${
                  email.isSelected
                    ? 'bg-slate-900/90 border-slate-700/80 shadow-md shadow-indigo-950/20'
                    : 'bg-slate-900/40 border-slate-800/80 opacity-60'
                }`}
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelectEmail(email.id)}
                      className="mt-1 text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                    >
                      {email.isSelected ? (
                        <CheckSquare className="w-5 h-5 text-indigo-500" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-600" />
                      )}
                    </button>

                    {/* Email Summary info */}
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Bates Badge */}
                        <div className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono text-2xs font-semibold">
                          <span>{email.batesNumber || `EXHIBIT-${idx+1}`}</span>
                          <button
                            onClick={() => handleCopyBates(email.batesNumber || `EXHIBIT-${idx+1}`)}
                            title="Copy Bates reference"
                            className="hover:text-indigo-200"
                          >
                            {copiedBates === (email.batesNumber || `EXHIBIT-${idx+1}`) ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Account origin badge */}
                        <span className="text-2xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 truncate max-w-[200px]">
                          {email.accountEmail}
                        </span>

                        {/* Date badge */}
                        <span className="text-2xs text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {email.date}
                        </span>

                        {/* Credit savings chip */}
                        <span className="text-2xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          <span>{email.cleanedTokens} tokens</span>
                          <span className="text-emerald-500/80">
                            (-{email.tokensSaved} saved)
                          </span>
                        </span>
                      </div>

                      {/* Subject */}
                      <h4 className="text-sm font-semibold text-slate-100 truncate">
                        {email.subject}
                      </h4>

                      {/* Sender and recipient */}
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="truncate">
                          <strong>From:</strong> {email.from}
                        </span>
                        <span className="truncate">
                          <strong>To:</strong> {email.to}
                        </span>
                      </div>

                      {/* Legal Classification Labels */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-3xs uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1">
                          <TagIcon className="w-2.5 h-2.5 text-indigo-400" />
                          Labels:
                        </span>
                        {(email.labels && email.labels.length > 0) ? (
                          email.labels.map(lbl => {
                            const badge = getTagBadgeStyle(lbl);
                            return (
                              <span
                                key={lbl}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-semibold border ${badge.bg} transition-all`}
                              >
                                <span>{badge.icon}</span>
                                <span>{lbl}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTag(email.id, lbl);
                                  }}
                                  title={`Remove label ${lbl}`}
                                  className="ml-0.5 hover:text-rose-400 p-0.5 rounded transition-colors"
                                >
                                  <CloseIcon className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-3xs text-slate-500 italic">No labels</span>
                        )}

                        {/* Add tag button / dropdown */}
                        <div className="relative inline-block">
                          {editingTagEmailId === email.id ? (
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1 text-2xs">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddTag(email.id, e.target.value);
                                  }
                                }}
                                defaultValue=""
                                className="bg-slate-900 text-slate-200 border border-slate-700 rounded px-1.5 py-0.5 text-2xs focus:outline-hidden"
                              >
                                <option value="" disabled>Add Label...</option>
                                <option value="Contractual">📜 Contractual</option>
                                <option value="Payment">💰 Payment</option>
                                <option value="Liability">⚠️ Liability</option>
                                <option value="Notice & Demand">🚨 Notice & Demand</option>
                                <option value="Admission & Defense">⚖️ Admission & Defense</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setEditingTagEmailId(null)}
                                className="text-slate-400 hover:text-slate-200 p-0.5"
                              >
                                <CloseIcon className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTagEmailId(email.id);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 transition-colors"
                            >
                              <PlusIcon className="w-2.5 h-2.5" />
                              <span>+ Label</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expand / Collapse Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Entity Tags Summary (Always visible) */}
                <div className="px-4 pb-3 sm:px-5 flex flex-wrap items-center gap-1.5 text-2xs border-t border-slate-800/50 pt-2.5">
                  {email.extractedEntities.monetaryAmounts.length > 0 && (
                    <div className="flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                      <DollarSign className="w-3 h-3" />
                      <span>{email.extractedEntities.monetaryAmounts.join(', ')}</span>
                    </div>
                  )}

                  {email.extractedEntities.dates.length > 0 && (
                    <div className="flex items-center gap-1 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      <span>{email.extractedEntities.dates.slice(0, 3).join(', ')}</span>
                    </div>
                  )}

                  {email.extractedEntities.legalKeywords.map(kw => (
                    <span
                      key={kw}
                      className="bg-indigo-950/40 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded capitalize"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                {/* Expanded Body Content */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 rounded-b-2xl space-y-3">
                    {/* View mode toggle: Cleaned vs Raw */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Text Display:</span>
                        <div className="p-0.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center">
                          <button
                            onClick={() => toggleViewMode(email.id)}
                            className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors ${
                              currentView === 'cleaned'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            ⚡ Cleaned ({email.cleanedTokens} tokens)
                          </button>
                          <button
                            onClick={() => toggleViewMode(email.id)}
                            className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors ${
                              currentView === 'raw'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Unfiltered Raw ({email.rawTokens} tokens)
                          </button>
                        </div>
                      </div>

                      <div className="text-2xs text-slate-500">
                        {currentView === 'cleaned' ? (
                          <span className="text-emerald-400">
                            Stripped reply chains, headers &amp; legal disclaimers
                          </span>
                        ) : (
                          <span className="text-amber-400">
                            Contains raw HTML, MIME headers &amp; quote tree
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Email Text */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-sans text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {displayBody}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Email Import Modal */}
      {isManualPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-400" />
                Import / Paste Email Communication
              </h3>
              <button
                onClick={() => setIsManualPasteOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddManualEmail} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={manualSubject}
                    onChange={e => setManualSubject(e.target.value)}
                    placeholder="e.g. Agreement regarding payment schedule"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">From</label>
                  <input
                    type="text"
                    value={manualFrom}
                    onChange={e => setManualFrom(e.target.value)}
                    placeholder="e.g. Marcus Sterling <ceo@company.com>"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">To</label>
                  <input
                    type="text"
                    value={manualTo}
                    onChange={e => setManualTo(e.target.value)}
                    placeholder="e.g. Client <client@domain.com>"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 text-xs">Email Message Content / Thread</label>
                <textarea
                  rows={6}
                  required
                  value={manualBody}
                  onChange={e => setManualBody(e.target.value)}
                  placeholder="Paste email text, headers, or quotes here. The credit optimizer will automatically strip boilerplate and extract key terms."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                />
              </div>

              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-2xs text-indigo-300">
                ⚡ Automatically assigns a Bates stamp (`EXHIBIT A-...`) and runs local credit optimization.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualPasteOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  Add to Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
