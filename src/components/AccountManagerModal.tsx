import React, { useState } from 'react';
import { ConnectedAccount } from '../types';
import { connectGoogleAccount, disconnectAccount, setActiveAccount } from '../services/firebaseAuth';
import { X, CheckCircle2, UserPlus, LogOut, ShieldCheck, Mail, AlertCircle } from 'lucide-react';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: ConnectedAccount[];
  activeAccount: ConnectedAccount | null;
  onAccountsUpdated: () => void;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen,
  onClose,
  accounts,
  activeAccount,
  onAccountsUpdated,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (promptSelectAccount: boolean = false) => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      await connectGoogleAccount(promptSelectAccount);
      onAccountsUpdated();
    } catch (err: any) {
      console.error('Account connect error:', err);
      setErrorMsg(err.message || 'Failed to authenticate Google account. Please verify popup permissions.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = async (email: string) => {
    try {
      await disconnectAccount(email);
      onAccountsUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect account');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Multi-Account Google Manager</h2>
              <p className="text-xs text-slate-400">Connect and search across multiple personal &amp; business inboxes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Connected Accounts List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Connected Google Inboxes ({accounts.length})
              </h3>
              <span className="text-2xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> In-Memory Session Secure
              </span>
            </div>

            {accounts.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                <Mail className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-medium">No Google Accounts Connected Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Connect your primary Gmail or business Google Workspace accounts to search correspondence across all sources.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {accounts.map(acc => {
                  const isActive = activeAccount?.email === acc.email;
                  return (
                    <div
                      key={acc.email}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-indigo-950/30 border-indigo-500/40 ring-1 ring-indigo-500/20'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {acc.photoURL ? (
                          <img
                            src={acc.photoURL}
                            alt={acc.displayName}
                            className="w-10 h-10 rounded-full border border-slate-700 object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                            {acc.email.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-200 truncate">
                              {acc.displayName || acc.email}
                            </span>
                            {isActive && (
                              <span className="text-2xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                                Active Primary
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono truncate">{acc.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive && (
                          <button
                            onClick={() => setActiveAccount(acc.email)}
                            className="text-xs px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnect(acc.email)}
                          title="Disconnect account"
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action to Connect / Add Another */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => handleConnect(accounts.length > 0)}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-medium text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {isSigningIn ? (
                <span>Authorizing with Google...</span>
              ) : accounts.length === 0 ? (
                <span>Sign in with Google</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-slate-700" />
                  Connect Another Google Account
                </span>
              )}
            </button>
            <p className="text-2xs text-slate-500 text-center mt-2.5">
              Authorizes read-only access to Gmail, personal Drive folder creation, and Calendar event scheduling.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
