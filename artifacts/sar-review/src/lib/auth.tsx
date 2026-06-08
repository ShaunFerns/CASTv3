import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/security/context", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("No CAST v3 context");
        return r.json();
      })
      .then((data: { roleKeys?: string[] }) => {
        setIsAdmin(data.roleKeys?.includes("institution_admin") === true || data.roleKeys?.includes("platform_admin") === true);
      })
      .catch(async () => {
        try {
          const r = await fetch("/api/auth/me", { credentials: "include" });
          const data = (await r.json()) as { isAdmin: boolean };
          setIsAdmin(data.isAdmin === true);
        } catch {
          setIsAdmin(false);
        }
      })
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
    setIsAdmin(true);
  };

  const logout = async () => {
    await fetch("/api/cast-v3/auth/logout", { method: "POST", credentials: "include" });
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
