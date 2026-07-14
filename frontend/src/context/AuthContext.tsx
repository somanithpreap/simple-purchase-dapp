import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "dapp-auth";

interface StoredAuth {
  user: User;
  token: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredAuth | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  });

  useEffect(() => {
    if (state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  const value: AuthState = {
    user: state?.user ?? null,
    token: state?.token ?? null,
    login: (user, token) => setState({ user, token }),
    logout: () => setState(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
