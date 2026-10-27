"use client";

import React, { ReactNode } from 'react';
import { AuthContext, useAuthState } from '../../hooks/useAuth';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider owns the single auth state (useAuthState) and shares it through
 * context; every component reads it with useAuth().
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuthState();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}
