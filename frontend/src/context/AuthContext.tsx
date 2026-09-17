import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "../services/api.ts";

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("nsupure_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("nsupure_token");
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const res = await apiRequest<{ user: User }>("/auth/me");
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem("nsupure_user", JSON.stringify(res.data.user));
          }
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };

    verifyToken();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("nsupure_token", newToken);
    localStorage.setItem("nsupure_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("nsupure_token");
    localStorage.removeItem("nsupure_user");
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    if (user.roles.includes("OWNER")) return true;
    return user.roles.some((r) => roles.includes(r));
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.roles.includes("OWNER")) return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
