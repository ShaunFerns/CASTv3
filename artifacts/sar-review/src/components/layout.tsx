import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Info, LayoutDashboard, Upload, PieChart, Sparkles, BarChart2,
  Library, ArrowLeft, ClipboardCheck, Leaf, Monitor, Lock, LogOut, Menu, X, TrendingUp,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";

const allNavItems = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/upload", label: "Upload Modules", icon: Upload, exact: false },
  { href: "/dashboard", label: "SAR Dashboard", icon: LayoutDashboard, exact: false },
  { href: "/free-electives", label: "Free Electives", icon: Sparkles, exact: false },
  { href: "/sar-analytics", label: "Analytics Summary", icon: PieChart, exact: false },
];

const homeNavItems = [
  { href: "/upload", label: "Upload Modules", icon: Upload, exact: false },
  { href: "/summary", label: "Analytics", icon: PieChart, exact: false },
];

const summaryNavItems = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/summary", label: "Analytics", icon: PieChart, exact: false },
];

const structureNavItems = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/upload", label: "Upload Modules", icon: Upload, exact: false },
];

const programmeNavItems = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/programme", label: "Programmes", icon: ClipboardCheck, exact: true },
  { href: "/programme/ga", label: "Graduate Attributes", icon: BarChart2, exact: false },
  { href: "/programme/greencomp", label: "GreenComp", icon: Leaf, exact: false },
  { href: "/programme/digcomp", label: "DigComp 3.0", icon: Monitor, exact: false },
  { href: "/programme/entrecomp", label: "EntreComp", icon: TrendingUp, exact: false },
  { href: "/programme/catalogue", label: "Module Catalogue", icon: Library, exact: false },
];

function getNavItems(location: string) {
  if (location === "/") return homeNavItems;
  if (location.startsWith("/summary")) return summaryNavItems;
  if (location.startsWith("/structure")) return structureNavItems;
  if (location.startsWith("/programme")) return programmeNavItems;
  return allNavItems;
}

const Logo = () => (
  <Link href="/" className="flex items-center gap-3 mr-8 shrink-0">
    <div className="flex items-center justify-center w-9 h-9 rounded" style={{ backgroundColor: "#F5A800" }}>
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L2 8l10 5 10-5-10-5z" fill="#003865" />
        <path d="M2 13l10 5 10-5" stroke="#003865" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 18l10 5 10-5" stroke="#003865" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div className="flex flex-col leading-none">
      <span className="font-bold text-base tracking-tight text-white">CAST</span>
      <span className="text-[10px] font-medium tracking-wide" style={{ color: "#F5A800" }}>TU Dublin</span>
    </div>
  </Link>
);

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const isAbout = location === "/about";
  const { isAdmin, logout } = useAuth();

  const navItems = getNavItems(location);

  const isActive = (href: string, exact: boolean) =>
    exact ? location === href : location.startsWith(href);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Close on Escape; return focus to trigger
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  const activeItemStyle = { backgroundColor: "#F5A800" };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-[#003865] font-sans">
      <header className="sticky top-0 z-30 w-full no-print" style={{ backgroundColor: "#003865" }}>
        <div className="container flex h-16 max-w-screen-2xl mx-auto px-4 sm:px-8 items-center justify-between">
          <Logo />

          {/* ── Desktop nav ── */}
          {isAbout ? (
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium" aria-label="Main navigation">
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 px-3 py-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-all"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Home
              </Link>
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium" aria-label="Main navigation">
              {navItems.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                      active
                        ? "text-[#003865] font-semibold"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`}
                    style={active ? activeItemStyle : {}}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/about"
                    className="ml-2 flex items-center justify-center w-8 h-8 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                    aria-label="About this tool"
                  >
                    <Info className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  About this tool
                </TooltipContent>
              </Tooltip>

              <div className="ml-3 pl-3 border-l border-white/20 flex items-center gap-1">
                {isAdmin ? (
                  <>
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded tracking-wider"
                      style={{ backgroundColor: "#F5A800", color: "#003865" }}
                    >
                      ADMIN
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => void logout()}
                          className="flex items-center justify-center w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                          aria-label="Log out (admin)"
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Log out (admin)
                      </TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href="/admin/login"
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-all text-xs"
                      >
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        Admin
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Sign in for admin access
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </nav>
          )}

          {/* ── Mobile hamburger ── */}
          <button
            ref={menuButtonRef}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded text-white/80 hover:text-white hover:bg-white/10 transition-all"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen
              ? <X className="h-5 w-5" aria-hidden="true" />
              : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {/* ── Mobile menu panel ── */}
        {mobileOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            className="md:hidden border-t border-white/10"
            style={{ backgroundColor: "#003865" }}
          >
            <ul className="container max-w-screen-2xl mx-auto px-4 py-3 flex flex-col gap-1" role="list">
              {isAbout ? (
                <>
                  <li>
                    <button
                      onClick={() => { window.history.back(); setMobileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                    >
                      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Back
                    </button>
                  </li>
                  <li>
                    <Link
                      href="/"
                      className="flex items-center gap-3 px-4 py-3 rounded text-white/80 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                    >
                      <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Home
                    </Link>
                  </li>
                </>
              ) : (
                navItems.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 px-4 py-3 rounded transition-all text-sm font-medium ${
                          active
                            ? "text-[#003865] font-semibold"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                        }`}
                        style={active ? activeItemStyle : {}}
                      >
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })
              )}

              {/* Divider */}
              <li aria-hidden="true" className="my-1 border-t border-white/10" />

              {/* About */}
              <li>
                <Link
                  href="/about"
                  className="flex items-center gap-3 px-4 py-3 rounded text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                >
                  <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                  About this tool
                </Link>
              </li>

              {/* Admin */}
              {isAdmin ? (
                <li>
                  <button
                    onClick={() => { void logout(); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Log out
                    <span
                      className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded tracking-wider"
                      style={{ backgroundColor: "#F5A800", color: "#003865" }}
                    >
                      ADMIN
                    </span>
                  </button>
                </li>
              ) : (
                <li>
                  <Link
                    href="/admin/login"
                    className="flex items-center gap-3 px-4 py-3 rounded text-white/40 hover:text-white/70 hover:bg-white/10 transition-all text-sm font-medium"
                  >
                    <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Admin login
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1 container max-w-screen-2xl mx-auto py-8 px-4 sm:px-8">
        {children}
      </main>
    </div>
  );
}
