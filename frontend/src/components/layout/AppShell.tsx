import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Droplets,
  LayoutDashboard,
  Users,
  ShoppingCart,
  Truck,
  Factory,
  Package,
  Wallet,
  Car,
  UserCheck,
  Building2,
  ShieldCheck,
  FileText,
  BarChart3,
  Settings,
  Search,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useOffline } from "../../context/OfflineContext.tsx";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasRole } = useAuth();
  const { status, pendingCount, triggerSync } = useOffline();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setMobileMenuOpen(false);
    }
  };

  const allNavItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "DRIVER", "PRODUCTION_SUPERVISOR", "FINANCE", "INVENTORY", "VIEWER"],
    },
    {
      name: "Fast Sales (POS)",
      path: "/sales",
      icon: ShoppingCart,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "FINANCE"],
    },
    {
      name: "Customers CRM",
      path: "/customers",
      icon: Users,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "FINANCE"],
    },
    {
      name: "Orders & Recurring",
      path: "/orders",
      icon: Package,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "FINANCE"],
    },
    {
      name: "Deliveries & Routes",
      path: "/deliveries",
      icon: Truck,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "DRIVER", "SALES"],
    },
    {
      name: "Production & Shifts",
      path: "/production",
      icon: Factory,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR", "INVENTORY"],
    },
    {
      name: "Inventory Stock",
      path: "/inventory",
      icon: Package,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR", "INVENTORY", "FINANCE"],
    },
    {
      name: "Finance & Cashbook",
      path: "/finance",
      icon: Wallet,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE"],
    },
    {
      name: "Fleet & Tricycle",
      path: "/fleet",
      icon: Car,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "DRIVER"],
    },
    {
      name: "Staff & Payroll",
      path: "/staff",
      icon: UserCheck,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE"],
    },
    {
      name: "Assets & Debt",
      path: "/assets",
      icon: Building2,
      roles: ["OWNER", "ADMINISTRATOR", "FINANCE"],
    },
    {
      name: "Quality & Hygiene",
      path: "/quality",
      icon: ShieldCheck,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR"],
    },
    {
      name: "Document Vault",
      path: "/documents",
      icon: FileText,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER"],
    },
    {
      name: "Reports & KPIs",
      path: "/reports",
      icon: BarChart3,
      roles: ["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE", "VIEWER"],
    },
    {
      name: "Setup Wizard",
      path: "/wizard",
      icon: Settings,
      roles: ["OWNER", "ADMINISTRATOR"],
    },
  ];

  const navItems = allNavItems.filter((item) => hasRole(...item.roles));

  // Top authorized items for mobile bottom bar
  const mobileBottomItems = [
    { name: "Home", path: "/", icon: LayoutDashboard },
    ...navItems.filter((i) => i.path !== "/").slice(0, 3),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP SIDEBAR                                               */}
      {/* ------------------------------------------------------------- */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shrink-0 sticky top-0 h-screen border-r border-slate-800">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Droplets className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight tracking-wide text-white">
              NSUPURE
            </h1>
            <p className="text-xs text-sky-400 font-medium">Adumasa Factory</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="p-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer, batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 text-xs text-white rounded-lg pl-9 pr-3 py-2 border border-slate-700 focus:outline-none focus:border-sky-400 transition"
            />
          </form>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${
                  isActive
                    ? "bg-sky-600 text-white shadow-sm shadow-sky-500/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Network & Offline Status Banner (Section 64) */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400">Sync Status:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded flex items-center gap-1.5 ${
                status === "ONLINE"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : status === "OFFLINE"
                  ? "bg-amber-500/20 text-amber-400"
                  : status === "SYNCING"
                  ? "bg-sky-500/20 text-sky-400 animate-pulse"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {status === "ONLINE" && <Wifi className="w-3 h-3" />}
              {status === "OFFLINE" && <WifiOff className="w-3 h-3" />}
              {status === "SYNCING" && <RefreshCw className="w-3 h-3 animate-spin" />}
              {status === "SYNC_ERROR" && <AlertCircle className="w-3 h-3" />}
              {status}
            </span>
          </div>

          {pendingCount > 0 && (
            <button
              onClick={triggerSync}
              className="w-full text-xs bg-sky-600 hover:bg-sky-500 text-white py-1 rounded flex items-center justify-center gap-1.5 transition mb-2"
            >
              <RefreshCw className="w-3 h-3" />
              Sync {pendingCount} Pending Queue
            </button>
          )}

          {/* User Profile Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {user?.fullName || user?.username}
              </p>
              <span className="text-[10px] bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded font-mono">
                {user?.roles[0] || "USER"}
              </span>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-400 rounded transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE TOP BAR                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white">NSUPURE</h1>
            <span className="text-[10px] text-sky-400 font-mono">Adumasa</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              status === "ONLINE"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {status}
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-30 bg-slate-950/95 backdrop-blur text-white flex flex-col p-4 overflow-y-auto">
          <form onSubmit={handleSearchSubmit} className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search customers, batches, sales..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 text-sm text-white rounded-xl pl-9 pr-3 py-2.5 border border-slate-700"
            />
          </form>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 p-3 rounded-xl border ${
                    isActive
                      ? "bg-sky-600 border-sky-500 text-white"
                      : "bg-slate-900 border-slate-800 text-slate-300"
                  }`}
                >
                  <Icon className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold">{user?.fullName}</p>
              <p className="text-[10px] text-sky-400 font-mono">{user?.roles[0]}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                             */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE BOTTOM TAB BAR (Touch Friendly >= 48px)                */}
      {/* ------------------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 flex justify-around items-center h-16 z-20 px-1">
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive ? "text-sky-400 font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] truncate max-w-[64px]">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-white"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">More ({navItems.length})</span>
        </button>
      </nav>
    </div>
  );
};
