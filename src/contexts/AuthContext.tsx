import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  runTransaction, 
  Timestamp, 
  collection, 
  addDoc 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const APP_NAME = 'CMG-IT-MANAGEMENT';
export type UserRole = 'MasterAdmin' | 'MD' | 'GM' | 'PD' | 'Staff';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  role: UserRole[];
  status: 'pending' | 'approved' | 'rejected';
  assignedProjects: string[];
  createdAt: Timestamp;
  photoURL?: string;
  isFirstUser: boolean;
  department?: string;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  registerWithEmail: (email: string, password: string, firstName: string, lastName: string, position: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const setSessionExpiry = () => {
  localStorage.setItem('sessionExpiry', String(Date.now() + 24 * 60 * 60 * 1000));
};

const logActivity = (action: string, email: string) => {
  addDoc(collection(db, `${APP_NAME}/root/activityLogs`), {
    action,
    email,
    timestamp: Timestamp.now()
  }).catch(() => {});
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const loginInProgressRef = { current: false };

  const fetchProfile = async (email: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, `${APP_NAME}/root/users`, email);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
    } catch (error) {
      console.error("Silent profile fetch failure", error);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (firebaseUser?.email) {
      const profile = await fetchProfile(firebaseUser.email);
      if (profile) setUserProfile(profile);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user?.email) {
        const profile = await fetchProfile(user.email);
        // Only set profile if no login is in progress — prevents overwriting
        if (!loginInProgressRef.current) {
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    loginInProgressRef.current = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSessionExpiry();
      logActivity('LOGIN', email);
      const profile = await fetchProfile(email);
      if (!profile) throw new Error('user-not-found');
      setUserProfile(profile);
      return profile;
    } finally {
      loginInProgressRef.current = false;
    }
  };

  const loginWithGoogle = async () => {
    loginInProgressRef.current = true;
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      setSessionExpiry();

      const email = userCredential.user.email;
      if (!email) throw new Error('No email found in Google profile');

      logActivity('LOGIN', email);

      let profile = await fetchProfile(email);
      if (!profile) {
        profile = {
          uid: userCredential.user.uid,
          email,
          firstName: userCredential.user.displayName?.split(' ')[0] || '',
          lastName: userCredential.user.displayName?.split(' ').slice(1).join(' ') || '',
          position: '',
          role: ['Staff'],
          status: 'pending',
          assignedProjects: [],
          createdAt: Timestamp.now(),
          photoURL: userCredential.user.photoURL || undefined,
          isFirstUser: false
        };
        await setDoc(doc(db, `${APP_NAME}/root/users`, email), profile);
        logActivity('REGISTER', email);
      }
      setUserProfile(profile);
      return profile;
    } finally {
      loginInProgressRef.current = false;
    }
  };


  const registerWithEmail = async (email: string, password: string, firstName: string, lastName: string, position: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    const newProfile = await runTransaction(db, async (transaction) => {
      const configRef = doc(db, `${APP_NAME}/root/appMeta`, 'config');
      const configSnap = await transaction.get(configRef);
      
      let isFirstUser = true;
      if (configSnap.exists() && configSnap.data().firstUserRegistered) {
        isFirstUser = false;
      }

      const profile: UserProfile = {
        uid: userCredential.user.uid,
        email,
        firstName,
        lastName,
        position,
        role: isFirstUser ? ['MasterAdmin'] : ['Staff'],
        status: isFirstUser ? 'approved' : 'pending',
        assignedProjects: [],
        createdAt: Timestamp.now(),
        isFirstUser
      };

      const userRef = doc(db, `${APP_NAME}/root/users`, email);
      transaction.set(userRef, profile);
      
      transaction.set(configRef, {
        firstUserRegistered: true,
        totalUsers: (configSnap.data()?.totalUsers || 0) + 1,
        createdAt: configSnap.exists() ? configSnap.data().createdAt : Timestamp.now()
      }, { merge: true });

      return profile;
    });

    logActivity('REGISTER', email);
    // Don't set state here, let onAuthStateChanged handle it or let user login explicitly
    return newProfile;
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, userProfile, loading, loginWithEmail, loginWithGoogle, registerWithEmail, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
