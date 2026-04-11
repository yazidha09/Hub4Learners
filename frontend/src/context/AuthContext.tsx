import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { getMe, type UserOut } from "../api/auth";

export type UserRole = 'student' | 'professor' | 'university_admin' | 'regional_admin' | 'super_admin'

export const ROLE_RANK: Record<UserRole, number> = {
  student:          0,
  professor:        1,
  university_admin: 2,
  regional_admin:   3,
  super_admin:      4,
}

/** Returns true if the user's role rank is >= the minimum required role rank. */
export function hasMinRank(userRole: string | undefined, minRole: UserRole): boolean {
  const rank = ROLE_RANK[userRole as UserRole] ?? -1
  return rank >= ROLE_RANK[minRole]
}

interface AuthContextValue {
  token: string | null;
  user: UserOut | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "h4l_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getMe(token)
      .then(setUser)
      .catch(() => {
        // Token expired / invalid — clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = () => {
    if (!token) return;
    getMe(token).then(setUser).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
