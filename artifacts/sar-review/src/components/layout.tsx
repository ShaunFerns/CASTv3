import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileClock,
  Gauge,
  Home,
  Info,
  Layers3,
  Library,
  ListChecks,
  Lock,
  LogOut,
  Map,
  Menu,
  ShieldCheck,
  Upload,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { GuidedOnboardingTour } from "@/components/guided-onboarding-tour";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  tourId?: string;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const publicNavItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/about", label: "About", icon: Info, exact: true },
  { href: "/frameworks", label: "Frameworks", icon: Layers3, exact: false },
];

const dashboardItem: NavItem = { href: "/dashboard", label: "Dashboard", icon: Home, exact: true, tourId: "nav-dashboard" };

const authenticatedNavGroups: NavGroup[] = [
  {
    id: "modules",
    label: "Modules",
    items: [
      { href: "/module-library", label: "Module Library", icon: BookOpen, exact: false, tourId: "nav-module-library" },
      { href: "/module-builder", label: "Module Builder", icon: Wrench, exact: false, tourId: "nav-module-builder" },
    ],
  },
  {
    id: "programmes",
    label: "Programmes",
    items: [
      { href: "/programme/workspace", label: "Programme Workspace", icon: Library, exact: false, tourId: "nav-programme-workspace" },
      { href: "/programme/map", label: "Programme Maps", icon: Map, exact: false, tourId: "nav-programme-map" },
    ],
  },
  {
    id: "review",
    label: "Review & Enhancement",
    items: [
      { href: "/programme/workspace#review-cycles", label: "Review Cycles", icon: ClipboardCheck, exact: true, tourId: "nav-review-enhancement" },
      { href: "/programme/workspace#readiness", label: "Readiness", icon: Gauge, exact: true },
      { href: "/programme/workspace#swot", label: "SWOT", icon: ListChecks, exact: true },
      { href: "/programme/workspace#actions", label: "Actions", icon: ShieldCheck, exact: true },
    ],
  },
  {
    id: "frameworks",
    label: "Frameworks",
    items: [
      { href: "/frameworks", label: "Framework Library", icon: Layers3, exact: false, tourId: "nav-framework-hub" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { href: "/ingestion", label: "Upload Curriculum", icon: Upload, exact: false, tourId: "nav-upload-curriculum" },
      { href: "/data-quality", label: "Data Quality", icon: Database, exact: false, tourId: "nav-data-quality" },
      { href: "/programme/import", label: "Imports", icon: FileClock, exact: false },
    ],
  },
];

const allAuthenticatedItems = [dashboardItem, ...authenticatedNavGroups.flatMap((group) => group.items)];

function getNavItems(isAuthenticated: boolean): NavItem[] {
  return isAuthenticated ? allAuthenticatedItems : publicNavItems;
}

function normaliseHref(href: string) {
  return href.split("#")[0];
}

function Logo({ isAuthenticated, compact = false }: { isAuthenticated: boolean; compact?: boolean }) {
  return (
    <Link href={isAuthenticated ? "/dashboard" : "/"} className={`flex items-center gap-3 shrink-0 ${compact ? "" : "mr-4"}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded" style={{ backgroundColor: "#F5A800" }}>
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3L2 8l10 5 10-5-10-5z" fill="#003865" />
          <path d="M2 13l10 5 10-5" stroke="#003865" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 18l10 5 10-5" stroke="#003865" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight text-white">CAST</span>
        <span className="text-[10px] font-medium tracking-wide" style={{ color: "#F5A800" }}>
          {isAuthenticated ? "Platform" : "Curriculum Intelligence"}
        </span>
      </div>
    </Link>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      data-tour={item.tourId}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-all ${
        active
          ? "bg-[#F5A800] font-semibold text-[#003865]"
          : "text-white/78 hover:bg-white/10 hover:text-white"
      }`}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarNavigation({
  location,
  openGroups,
  toggleGroup,
  onNavigate,
}: {
  location: string;
  openGroups: Record<string, boolean>;
  toggleGroup: (groupId: string) => void;
  onNavigate?: () => void;
}) {
  const isActive = (href: string, exact: boolean) => {
    const path = normaliseHref(href);
    return exact ? location === path : location.startsWith(path);
  };

  return (
    <div className="flex h-full flex-col bg-[#003865] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <Logo isAuthenticated compact />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Application navigation">
        <div className="mb-4">
          <NavLink item={dashboardItem} active={isActive(dashboardItem.href, dashboardItem.exact)} onNavigate={onNavigate} />
        </div>

        <div className="space-y-3">
          {authenticatedNavGroups.map((group) => {
            const open = openGroups[group.id] ?? true;
            return (
              <section key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-white/55 hover:bg-white/5 hover:text-white/75"
                  aria-expanded={open}
                >
                  <span>{group.label}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
                </button>
                {open && (
                  <div className="mt-1 space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={`${group.id}-${item.href}-${item.label}`}
                        item={item}
                        active={isActive(item.href, item.exact)}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function PublicHeader({
  location,
  isAuthenticated,
  mobileOpen,
  setMobileOpen,
  menuButtonRef,
}: {
  location: string;
  isAuthenticated: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const isAbout = location === "/about";
  const isActive = (href: string, exact: boolean) => exact ? location === href : location.startsWith(href);

  return (
    <header className="sticky top-0 z-30 w-full no-print" style={{ backgroundColor: "#003865" }}>
      <div className="container mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-8">
        <Logo isAuthenticated={isAuthenticated} />

        {isAbout && isAuthenticated ? (
          <nav className="hidden items-center gap-1 text-xs font-medium md:flex" aria-label="Main navigation">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 rounded px-3 py-2 text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded px-4 py-2 text-white/80 transition-all hover:bg-white/10 hover:text-white"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
          </nav>
        ) : (
          <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="Main navigation">
            {publicNavItems.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded px-2.5 py-2 transition-all ${
                    active
                      ? "bg-[#F5A800] font-semibold text-[#003865]"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-3 border-l border-white/20 pl-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/login"
                    className="flex items-center gap-1.5 rounded bg-white px-3 py-2 text-xs font-semibold text-[#003865] transition-all hover:bg-blue-50"
                  >
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Log in
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Sign in to CAST v3
                </TooltipContent>
              </Tooltip>
            </div>
          </nav>
        )}

        <button
          ref={menuButtonRef}
          className="flex h-10 w-10 items-center justify-center rounded text-white/80 transition-all hover:bg-white/10 hover:text-white md:hidden"
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

      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="border-t border-white/10 md:hidden"
          style={{ backgroundColor: "#003865" }}
        >
          <ul className="container mx-auto flex max-w-screen-2xl flex-col gap-1 px-4 py-3" role="list">
            {isAbout && isAuthenticated ? (
              <>
                <li>
                  <button
                    onClick={() => { window.history.back(); setMobileOpen(false); }}
                    className="flex w-full items-center gap-3 rounded px-4 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Back
                  </button>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 rounded px-4 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Dashboard
                  </Link>
                </li>
              </>
            ) : (
              publicNavItems.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded px-4 py-3 text-sm font-medium transition-all ${
                        active
                          ? "bg-[#F5A800] font-semibold text-[#003865]"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })
            )}
            <li aria-hidden="true" className="my-1 border-t border-white/10" />
            <li>
              <Link
                href="/admin/login"
                className="flex items-center gap-3 rounded px-4 py-3 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
              >
                <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(authenticatedNavGroups.map((group) => [group.id, true])),
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

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

  const restartTour = () => window.dispatchEvent(new Event("cast:start-onboarding-tour"));
  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({ ...current, [groupId]: !(current[groupId] ?? true) }));
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f4f6f9] font-sans text-[#003865]">
        <PublicHeader
          location={location}
          isAuthenticated={isAuthenticated}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          menuButtonRef={menuButtonRef}
        />
        <main className="container mx-auto max-w-screen-2xl flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
        <GuidedOnboardingTour />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] font-sans text-[#003865]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 no-print md:block">
        <SidebarNavigation
          location={location}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
        />
      </aside>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur no-print md:ml-72">
        <div className="flex h-16 items-center justify-between px-4 sm:px-8">
          <button
            ref={menuButtonRef}
            className="flex h-10 w-10 items-center justify-center rounded text-[#003865] transition-all hover:bg-slate-100 md:hidden"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen
              ? <X className="h-5 w-5" aria-hidden="true" />
              : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <span className="rounded bg-[#F5A800] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#003865]">
              CAST V3
            </span>
            <span className="text-sm font-semibold text-slate-700">Curriculum Analysis and Strategy Tool</span>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={restartTour}
                  className="flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Restart guided tour"
                >
                  <CircleHelp className="h-4 w-4" aria-hidden="true" />
                  Help
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Restart guided tour
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => void logout()}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-950"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Log out
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close navigation drawer"
            onClick={() => setMobileOpen(false)}
          />
          <div id="mobile-nav" className="absolute inset-y-0 left-0 w-80 max-w-[86vw] shadow-xl">
            <SidebarNavigation
              location={location}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-8 md:ml-72">
        {children}
      </main>
      <GuidedOnboardingTour />
    </div>
  );
}
