import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  auth, 
  db, 
  UserProfileData, 
  UserRole, 
  getRolePermissions, 
  isOwnerEmail,
  buildProfileForUser,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithEmail as fbSignInWithEmail,
  signUpWithEmail as fbSignUpWithEmail,
  signOutUser as fbSignOutUser,
  resetUserPassword,
  resendVerificationEmail,
  getCachedAccessToken,
  requestGoogleTasksToken,
  requestGoogleFormsToken
} from '../firebase';
import { apiService, AccessInfo } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfileData | null;
  role: UserRole;
  isReadOnly: boolean;
  isMasterAdmin: boolean;
  workspaceId: string;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'signin' | 'signup';
  preferredRole: UserRole;
  googleAccessToken: string | null;
  acquireGoogleTasksToken: () => Promise<string>;
  acquireGoogleFormsToken: () => Promise<string>;
  openAuthModal: (tab?: 'signin' | 'signup', targetRole?: UserRole) => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string, remember?: boolean) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  setQuickProfile: (role: UserRole) => void;
  updateUserRole: (newRole: UserRole) => Promise<void>;
  updateWorkspaceNiche: (nicheId: string, nicheName: string) => Promise<void>;
  // Phases 1–3: platform access (plan, features, account status) from the
  // server. Null until loaded — the server remains the enforcement point.
  access: AccessInfo | null;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signin');
  const [preferredRole, setPreferredRole] = useState<UserRole>('admin');
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => getCachedAccessToken());

  // Phases 1–3: load platform access for the signed-in user. The fetch also
  // makes the server ensure a users record exists (self-signups start as
  // pending_approval with no feature access until a master admin approves).
  const refreshAccess = async (): Promise<void> => {
    try {
      const info = await apiService.getMyAccess();
      setAccess(info);
    } catch (e) {
      console.warn('Could not load platform access:', e);
      setAccess(null);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshAccess();
    } else {
      setAccess(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const acquireGoogleTasksToken = async (): Promise<string> => {
    try {
      const token = await requestGoogleTasksToken();
      setGoogleAccessToken(token);
      return token;
    } catch (err) {
      console.error('Failed to acquire Google Tasks token:', err);
      throw err;
    }
  };

  const acquireGoogleFormsToken = async (): Promise<string> => {
    try {
      const token = await requestGoogleFormsToken();
      setGoogleAccessToken(token);
      return token;
    } catch (err) {
      console.error('Failed to acquire Google Forms token:', err);
      throw err;
    }
  };

  // Listen to live Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setCurrentUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfileData;
            // Enforce verified owner security: owner always gets admin, others are customer
            const isOwner = isOwnerEmail(firebaseUser.email);
            if (isOwner && data.role !== 'admin') {
              data.role = 'admin';
              data.isReadOnly = false;
              data.workspaceId = 'ws_pulsar_master';
              data.displayName = data.displayName || 'Master Admin';
              await setDoc(userDocRef, data, { merge: true });
            } else if (!isOwner && data.role !== 'customer') {
              data.role = 'customer';
              data.isReadOnly = true;
              data.workspaceId = `ws_${firebaseUser.uid}`;
              await setDoc(userDocRef, data, { merge: true });
            }
            setProfile(data);
          } else {
            const newProfile = buildProfileForUser(firebaseUser);
            await setDoc(userDocRef, newProfile, { merge: true });
            setProfile(newProfile);
          }
        } catch (e) {
          console.warn('Error reading or writing Firestore profile:', e);
          // Fallback to local profile build from verified Firebase auth token
          setProfile(buildProfileForUser(firebaseUser));
        }
      } else {
        // Signed out: strict zero access, no fake profiles
        setProfile(null);
        setGoogleAccessToken(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = (tab: 'signin' | 'signup' = 'signin', targetRole: UserRole = 'admin') => {
    setAuthModalTab(tab);
    setPreferredRole(targetRole);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const handleSignInWithGoogle = async () => {
    const { profile: userProfile } = await fbSignInWithGoogle();
    setProfile(userProfile);
    setGoogleAccessToken(getCachedAccessToken());
    setIsAuthModalOpen(false);
  };

  const handleSignInWithEmail = async (email: string, pass: string, remember: boolean = true) => {
    const { profile: userProfile } = await fbSignInWithEmail(email, pass, remember);
    setProfile(userProfile);
    setIsAuthModalOpen(false);
  };

  const handleSignUpWithEmail = async (email: string, pass: string, name: string) => {
    const { profile: userProfile } = await fbSignUpWithEmail(email, pass, name);
    setProfile(userProfile);
    setIsAuthModalOpen(false);
  };

  const handleResetPassword = async (email: string) => {
    await resetUserPassword(email);
  };

  const handleResendVerification = async () => {
    if (currentUser) {
      await resendVerificationEmail(currentUser);
    }
  };

  const handleSignOut = async () => {
    try {
      await fbSignOutUser();
    } catch (e) {
      console.warn('Firebase sign-out note:', e);
    }
    setCurrentUser(null);
    setProfile(null);
    setGoogleAccessToken(null);
  };

  // Safe backward compatibility no-op for any legacy button
  const setQuickProfile = (targetRole: UserRole) => {
    console.warn(`Quick profile switching disabled in production. Authentication is strictly enforced by Firebase and Firestore rules. Target was: ${targetRole}`);
  };

  const updateUserRole = async (newRole: UserRole) => {
    if (!profile || !currentUser) return;
    // Only owner may update role
    if (!isOwnerEmail(currentUser.email)) {
      console.warn('Customer users cannot modify their role.');
      return;
    }
    const updated: UserProfileData = {
      ...profile,
      role: newRole,
      isReadOnly: newRole === 'customer',
      permissions: getRolePermissions(newRole),
      lastLoginAt: new Date().toISOString()
    };
    setProfile(updated);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, { role: newRole, isReadOnly: newRole === 'customer' }, { merge: true });
    } catch (e) {
      console.warn('Could not persist updated role:', e);
    }
  };

  const activeRole: UserRole = profile?.role || 'customer';
  const isReadOnly = profile?.isReadOnly ?? true;
  const isMasterAdmin = activeRole === 'admin';
  const activeWorkspaceId = profile?.workspaceId || (currentUser ? `ws_${currentUser.uid}` : 'ws_pulsar_master');

  const updateWorkspaceNiche = async (nicheId: string, nicheName: string) => {
    if (!profile || !currentUser) return;
    const updated: UserProfileData = {
      ...profile,
      niche: nicheName,
      nicheTemplateId: nicheId
    };
    setProfile(updated);
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, { niche: nicheName, nicheTemplateId: nicheId }, { merge: true });
    } catch (e) {
      console.warn('Could not persist updated niche to Firestore:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        role: activeRole,
        isReadOnly,
        isMasterAdmin,
        workspaceId: activeWorkspaceId,
        isLoading,
        isAuthModalOpen,
        authModalTab,
        preferredRole,
        googleAccessToken,
        acquireGoogleTasksToken,
        acquireGoogleFormsToken,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithEmail: handleSignInWithEmail,
        signUpWithEmail: handleSignUpWithEmail,
        resetPassword: handleResetPassword,
        resendVerification: handleResendVerification,
        signOut: handleSignOut,
        setQuickProfile,
        updateUserRole,
        updateWorkspaceNiche,
        access,
        refreshAccess
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
