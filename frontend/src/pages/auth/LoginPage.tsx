import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Droplets, Lock, User, AlertCircle } from "lucide-react";
import { apiRequest } from "../../services/api.ts";
import { useAuth } from "../../context/AuthContext.tsx";

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanUsername = username.trim().toLowerCase();

    try {
      const res = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      if (res.data?.token && res.data?.user) {
        login(res.data.token, res.data.user);
        navigate("/");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-800 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-sky-600 to-cyan-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-sky-500/30">
            <Droplets className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            NSUPURE MINERAL WATER
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Central Business Management System • Adumasa Factory
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Username or Email</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Enter username or email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="password"
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-sky-600/20 transition disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In to System"}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium">
            Authorized Personnel Only • Adumasa Production Facility
          </p>
        </div>
      </div>
    </div>
  );
};
