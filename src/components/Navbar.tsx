import React from 'react';
import { 
  Scale, 
  Mail, 
  FileText, 
  Calendar, 
  Zap, 
  Users, 
  CheckCircle2, 
  FolderSync,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { ConnectedAccount } from '../types';

export type ActiveTab = 'discovery' | 'strategy' | 'documents' | 'sheets' | 'calendar';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  accounts: ConnectedAccount[];
  activeAccount: ConnectedAccount | null;
  onOpenAccountManager: () => void;
  onOpenCreditModal: () => void;
  selectedExhibitsCount: number;
  totalTokensSaved: number;
  percentSaved: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  accounts,
  activeAccount,
  onOpenAccountManager,
  onOpenCreditModal,
  selectedExhibitsCount,
  totalTokensSaved,
  percentSaved,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Case Suite Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-base tracking-tight">
                  Legal Strategy Suite
                </span>
                <span className="text-3xs font-semibold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wider">
                  Multi-Account
                </span>
              </div>
              <p className="text-2xs text-slate-400 flex items-center gap-1.5">
                <span>Google Workspace Evidentiary Discovery</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 flex items-center gap-0.5">
                  Credit-Conscious
                </span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('discovery')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'discovery'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>1. Discovery &amp; Emails</span>
              {selectedExhibitsCount > 0 && (
                <span className="ml-1 text-2xs px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-200 font-mono">
                  {selectedExhibitsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('strategy')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'strategy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>2. Strategy &amp; Elements</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'documents'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>3. Documents</span>
            </button>

            <button
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sheets'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. Sheets &amp; Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>5. Deadlines</span>
            </button>
          </nav>

          {/* Right Controls: Credit Saver & Multi-Account Status */}
          <div className="flex items-center gap-2.5">
            {/* Credit Economy Badge */}
            <button
              onClick={onOpenCreditModal}
              title="Click to view Credit & Token Conservation breakdown"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-medium transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Credits:</span>
              <span className="font-mono text-emerald-400">{percentSaved}% Saved</span>
            </button>

            {/* Google Accounts Manager Button */}
            <button
              onClick={onOpenAccountManager}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                accounts.length > 0
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-100 text-slate-900 border-transparent shadow-sm'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {accounts.length === 0 ? (
                <span>Connect Google Accounts</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate max-w-[110px] sm:max-w-[150px]">
                    {accounts.length} Google {accounts.length === 1 ? 'Inbox' : 'Inboxes'}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1 border-t border-slate-800/60 no-scrollbar">
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'discovery' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            1. Discovery ({selectedExhibitsCount})
          </button>
          <button
            onClick={() => setActiveTab('strategy')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'strategy' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            2. Strategy
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'documents' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            3. Documents
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'sheets' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            4. Sheets &amp; Ledger
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            5. Deadlines
          </button>
        </div>
      </div>
    </header>
  );
};
