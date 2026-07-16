import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ensureFreshAccessToken,
  getStoredAccessToken,
  onSessionExpired,
} from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from "@/services/auth";
import type { LoginRequest, RegisterRequest, User } from "@/types/auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    getCurrentUser()
      .then(setUser)
      .catch(async () => {
        // Access token may be expired — try refresh once, then give up.
        const refreshed = await ensureFreshAccessToken();
        if (!refreshed) {
          logoutRequest();
          return;
        }
        try {
          setUser(await getCurrentUser());
        } catch {
          logoutRequest();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Keep UI in sync when axios/chat refresh fails mid-session.
  useEffect(() => {
    return onSessionExpired(() => {
      logoutRequest();
      queryClient.clear();
      setUser(null);
    });
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const response = await loginRequest(payload);
    queryClient.clear();
    setUser(response.user);
  }, []);

  const register = useCallback(async (payload: RegisterRequest) => {
    const response = await registerRequest(payload);
    queryClient.clear();
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    queryClient.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
