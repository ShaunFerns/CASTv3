import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
  isAdmin: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { isAdmin: boolean }) => {
        setIsAdmin(data.isAdmin === true);
      })
      .catch(() => {
        setIsAdmin(false);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) {
      const data = (await r.json()) as { error?: string };
      throw new Error(data.error ?? "Login failed");
    }
    setIsAdmin(true);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
