"use client";

import React, { ReactNode } from 'react';
import { AuthContext, useAuth, useAuthState } from '../../hooks/useAuth';
import type { AuthState } from '../../hooks/useAuth';

type AuthContextType = AuthState;

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider owns the single auth state (useAuthState) and shares it through
 * context; every component reads it with useAuth()/useAuthContext().
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuthState();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/** Same as useAuth(); throws if used outside AuthProvider. */
export const useAuthContext = useAuth;

export type { AuthContextType };
