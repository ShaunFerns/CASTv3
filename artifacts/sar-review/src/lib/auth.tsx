import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  userId?: string;
  effectivePermissions: string[];
  canBootstrapOverrideDelete: boolean;
  onboarding?: {
    guidedTourCompleted: boolean;
    guidedTourCompletedAt?: string | null;
  };
  refreshContext: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [onboarding, setOnboarding] = useState<AuthContextType["onboarding"]>();

  const refreshContext = async () => {
    await fetch("/api/security/context", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("No CAST v3 context");
        return r.json();
      })
      .then((data: { userId?: string; roleKeys?: string[]; effectivePermissions?: string[]; onboarding?: AuthContextType["onboarding"] }) => {
        setIsAuthenticated(true);
        setIsAdmin(data.roleKeys?.includes("institution_admin") === true || data.roleKeys?.includes("platform_admin") === true);
        setUserId(data.userId);
        setEffectivePermissions(data.effectivePermissions ?? []);
        setOnboarding(data.onboarding);
      })
      .catch(async () => {
        try {
          const r = await fetch("/api/auth/me", { credentials: "include" });
          const data = (await r.json()) as { isAdmin: boolean };
          setIsAuthenticated(false);
          setIsAdmin(data.isAdmin === true);
          setUserId(undefined);
          setEffectivePermissions([]);
          setOnboarding(undefined);
        } catch {
          setIsAuthenticated(false);
          setIsAdmin(false);
          setUserId(undefined);
          setEffectivePermissions([]);
          setOnboarding(undefined);
        }
      });
  };

  useEffect(() => {
    refreshContext()
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await fetch("/api/cast-v3/auth/bootstrap-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const data = (await r.json()) as { error?: string };
      throw new Error(data.error ?? "Login failed");
    }
    await refreshContext();
  };

  const logout = async () => {
    await fetch("/api/cast-v3/auth/logout", { method: "POST", credentials: "include" });
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserId(undefined);
    setEffectivePermissions([]);
    setOnboarding(undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        isAdmin,
        isAuthenticated,
        isLoading,
        userId,
        effectivePermissions,
        canBootstrapOverrideDelete: effectivePermissions.includes("cleanup.bootstrap_override_delete"),
        onboarding,
        refreshContext,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
