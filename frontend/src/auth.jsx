import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.get('/auth/status');
        if (!cancelled && status.needsSetup) {
          setNeedsSetup(true);
          setLoading(false);
          return;
        }
        if (getToken()) {
          const me = await api.get('/auth/me'); // 404 if the account was deleted
          if (!cancelled) setUser(me.user);
        }
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((token, u) => {
    setToken(token);
    setUser(u);
    setNeedsSetup(false);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const isAuthor = user && (user.role === 'author' || user.role === 'admin');
  const isAdmin = user && user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, signIn, signOut, isAuthor, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
