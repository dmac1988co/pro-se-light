import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ConnectedAccount } from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Auth Provider with Workspace scopes
export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const createGoogleProvider = (promptSelectAccount: boolean = false) => {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  if (promptSelectAccount) {
    provider.setCustomParameters({
      prompt: 'select_account',
    });
  }
  return provider;
};

// In-memory token storage (never written to localStorage/sessionStorage as required by workspace skill)
let inMemoryAccounts: Map<string, ConnectedAccount> = new Map();
let currentActiveAccountId: string | null = null;
let isSigningIn = false;

type AuthChangeListener = (accounts: ConnectedAccount[], activeAccount: ConnectedAccount | null) => void;
const listeners: Set<AuthChangeListener> = new Set();

const notifyListeners = () => {
  const accountList = Array.from(inMemoryAccounts.values());
  const active = currentActiveAccountId ? inMemoryAccounts.get(currentActiveAccountId) || null : (accountList[0] || null);
  listeners.forEach(fn => fn(accountList, active));
};

export const subscribeToAuthChanges = (listener: AuthChangeListener) => {
  listeners.add(listener);
  const accountList = Array.from(inMemoryAccounts.values());
  const active = currentActiveAccountId ? inMemoryAccounts.get(currentActiveAccountId) || null : (accountList[0] || null);
  listener(accountList, active);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Initialize Firebase Auth listener on app boot
 */
export const initAuth = () => {
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      if (!isSigningIn) {
        // clear memory
        inMemoryAccounts.clear();
        currentActiveAccountId = null;
        notifyListeners();
      }
    }
  });
};

/**
 * Connect a Google Account via popup.
 * promptSelectAccount: if true, forces Google to show the account chooser
 * so the user can select an alternative / second Google account!
 */
export const connectGoogleAccount = async (promptSelectAccount: boolean = false): Promise<ConnectedAccount> => {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(promptSelectAccount);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google OAuth access token from authorization result.');
    }

    const email = result.user.email || 'unknown@google.com';
    const account: ConnectedAccount = {
      id: result.user.uid || email,
      email,
      displayName: result.user.displayName || email.split('@')[0],
      photoURL: result.user.photoURL || '',
      accessToken: credential.accessToken,
      addedAt: Date.now(),
    };

    inMemoryAccounts.set(account.email, account);
    currentActiveAccountId = account.email;
    notifyListeners();

    return account;
  } catch (err: any) {
    console.error('Google sign in error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Switch active account
 */
export const setActiveAccount = (email: string) => {
  if (inMemoryAccounts.has(email)) {
    currentActiveAccountId = email;
    notifyListeners();
  }
};

/**
 * Disconnect a specific account
 */
export const disconnectAccount = async (email: string) => {
  inMemoryAccounts.delete(email);
  if (currentActiveAccountId === email) {
    const remaining = Array.from(inMemoryAccounts.keys());
    currentActiveAccountId = remaining.length > 0 ? remaining[0] : null;
  }
  if (inMemoryAccounts.size === 0) {
    await signOut(auth);
  }
  notifyListeners();
};

/**
 * Disconnect all accounts
 */
export const disconnectAll = async () => {
  inMemoryAccounts.clear();
  currentActiveAccountId = null;
  await signOut(auth);
  notifyListeners();
};

export const getConnectedAccounts = (): ConnectedAccount[] => {
  return Array.from(inMemoryAccounts.values());
};

export const getActiveAccount = (): ConnectedAccount | null => {
  if (!currentActiveAccountId) {
    const all = Array.from(inMemoryAccounts.values());
    return all[0] || null;
  }
  return inMemoryAccounts.get(currentActiveAccountId) || null;
};
