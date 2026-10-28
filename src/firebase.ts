import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configured Google Workspace Scopes (Tasks, Drive, Forms)
export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

export const GOOGLE_TASKS_SCOPES = GOOGLE_WORKSPACE_SCOPES;

// Add Google Workspace scopes to Google provider
GOOGLE_WORKSPACE_SCOPES.forEach(scope => {
  googleProvider.addScope(scope);
});

// Prompt for offline/consent if needed
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// In-memory token cache (never stored in localStorage or sessionStorage per security specifications)
let cachedAccessToken: string | null = null;

export const getCachedAccessToken = (): string | null => cachedAccessToken;

export const setCachedAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
};

// Clear cached token when auth state changes to signed out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

// Request or acquire Google OAuth access token with Google Workspace permissions (Tasks, Forms, Drive)
export const requestGoogleWorkspaceToken = async (): Promise<string> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Could not obtain Google OAuth access token. Please ensure third-party popups are enabled.');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
};

export const requestGoogleTasksToken = requestGoogleWorkspaceToken;
export const requestGoogleFormsToken = requestGoogleWorkspaceToken;

// If named database ID is provided in config, use it
const configuredDbId = (firebaseConfig as Record<string, any>).firestoreDatabaseId;
export const db = configuredDbId && configuredDbId !== '(default)'
  ? getFirestore(app, configuredDbId)
  : getFirestore(app);

// Validate Connection to Firestore on boot per skill instructions
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export type UserRole = 'admin' | 'customer';

export interface UserProfileData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isReadOnly: boolean;
  permissions: string[];
  lastLoginAt: string;
  createdAt?: string;
  workspaceId: string;
  organizationName?: string;
  niche?: string;
  nicheTemplateId?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Determines permissions array based on role
export const getRolePermissions = (role: UserRole): string[] => {
  if (role === 'admin') {
    return [
      'telephony:dial',
      'telephony:transfer',
      'leads:create',
      'leads:edit',
      'leads:delete',
      'scraper:execute',
      'settings:update',
      'codebase:master_control',
      'crm:sync_write',
      'briefing:export'
    ];
  }
  // Customer role has strictly read-only access
  return [
    'telephony:listen_only',
    'leads:view_only',
    'analytics:view_only',
    'codebase:view_only',
    'meeting_notes:view_only'
  ];
};

// Phase 0 (C7): NO hardcoded owner identities anywhere. Client-side owner
// recognition comes from the build-time env VITE_OWNER_EMAILS (comma-
// separated), which the founder sets to the same value as the server's
// OWNER_EMAILS at deploy time. Unset = empty = nobody is treated as an
// owner client-side (fail closed). Real enforcement is server-side and in
// firestore.rules (platformConfig/masterAdmins).
export const OWNER_EMAILS: string[] = String((import.meta as any).env?.VITE_OWNER_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export const isOwnerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.trim().toLowerCase());
};

export function buildProfileForUser(user: User, existing?: Partial<UserProfileData>): UserProfileData {
  const isOwner = isOwnerEmail(user.email);
  const role: UserRole = isOwner ? 'admin' : 'customer';
  const isReadOnly = !isOwner;
  const workspaceId = isOwner ? 'ws_pulsar_master' : `ws_${user.uid}`;
  const displayName = isOwner 
    ? (user.displayName || 'Master Admin')
    : (user.displayName || user.email?.split('@')[0] || 'Customer User');

  return {
    uid: user.uid,
    email: user.email || '',
    displayName,
    photoURL: user.photoURL || undefined,
    role,
    isReadOnly,
    permissions: getRolePermissions(role),
    lastLoginAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    workspaceId,
    organizationName: isOwner ? 'Pulsar Global Enterprise' : (existing?.organizationName || 'Client Practice Partners'),
    niche: existing?.niche || 'Healthcare & Medical Billing',
    nicheTemplateId: existing?.nicheTemplateId || 'healthcare-rcm'
  };
}

// Primary sign in with Google
export const signInWithGoogle = async (): Promise<{ user: User; profile: UserProfileData }> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    
    const userRef = doc(db, 'users', user.uid);
    let existingProfile: UserProfileData | null = null;
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        existingProfile = snap.data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Could not fetch existing profile, creating fresh one:', e);
    }

    const profileData = buildProfileForUser(user, existingProfile || undefined);

    try {
      await setDoc(userRef, profileData, { merge: true });
    } catch (e) {
      console.warn('Could not persist profile to Firestore:', e);
    }

    return { user, profile: profileData };
  } catch (error) {
    console.error('Google Sign-in error:', error);
    throw error;
  }
};

// Sign in with Email and Password. `remember` drives the "Remember this
// workstation" choice on the gateway: local persistence keeps the session
// on this machine; session persistence ends it with the browser session.
export const signInWithEmail = async (email: string, pass: string, remember: boolean = true): Promise<{ user: User; profile: UserProfileData }> => {
  try {
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    } catch (e) {
      console.warn('Could not set auth persistence:', e);
    }
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    
    const userRef = doc(db, 'users', user.uid);
    let existingProfile: UserProfileData | null = null;
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        existingProfile = snap.data() as UserProfileData;
      }
    } catch (e) {
      console.warn('Could not fetch profile:', e);
    }

    const profileData = buildProfileForUser(user, existingProfile || undefined);

    try {
      await setDoc(userRef, profileData, { merge: true });
    } catch (e) {
      console.warn('Failed to save user profile:', e);
    }

    return { user, profile: profileData };
  } catch (error) {
    console.error('Email sign-in error:', error);
    throw error;
  }
};

// Sign up with Email and Password
export const signUpWithEmail = async (
  email: string, 
  pass: string, 
  displayName: string
): Promise<{ user: User; profile: UserProfileData }> => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    
    // Update auth profile
    if (displayName) {
      await updateProfile(user, { displayName });
    }

    // Send verification email
    try {
      await sendEmailVerification(user);
    } catch (ve) {
      console.warn('Could not send verification email automatically:', ve);
    }

    const profileData = buildProfileForUser(user);
    if (displayName) {
      profileData.displayName = displayName;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, profileData);
    } catch (e) {
      console.warn('Failed to write profile on sign-up:', e);
    }

    return { user, profile: profileData };
  } catch (error) {
    console.error('Sign-up error:', error);
    throw error;
  }
};

export const resetUserPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
};

export const resendVerificationEmail = async (user: User): Promise<void> => {
  try {
    await sendEmailVerification(user);
  } catch (error) {
    console.error('Resend verification email error:', error);
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
};
