import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

import LeaderboardModal from "@/components/LeaderboardModal";
import { Button } from "@/components/ui/button";
import { APP_BRAND, LEADERBOARD_NAV, STUDENT_NAV } from "@/config/studentNav";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-uk-navy-light text-white"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r bg-uk-red" />
          )}
          <Icon className="h-4 w-4 shrink-0 opacity-90" />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({
  onNavigate,
  onLeaderboard,
  onLogout,
  userName,
}: {
  onNavigate?: () => void;
  onLeaderboard: () => void;
  onLogout: () => void;
  userName?: string;
}) {
  const BrandIcon = APP_BRAND.icon;
  const TrophyIcon = LEADERBOARD_NAV.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-uk-red shadow-md">
            <BrandIcon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">
              {APP_BRAND.title}
            </p>
            <p className="truncate text-xs text-slate-400">{APP_BRAND.subtitle}</p>
          </div>
        </div>
        {userName && (
          <p className="mt-4 truncate rounded-lg bg-uk-navy-light/80 px-3 py-2 text-xs text-slate-300">
            Signed in as <span className="font-semibold text-white">{userName}</span>
          </p>
        )}
      </div>

      <nav className="scrollbar-hide flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {STUDENT_NAV.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Community
          </p>
          <button
            type="button"
            onClick={() => {
              onLeaderboard();
              onNavigate?.();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <TrophyIcon className="h-4 w-4 shrink-0 opacity-90" />
            {LEADERBOARD_NAV.label}
          </button>
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 text-uk-red" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const isChat = location.pathname === "/chat";
  const displayName = user?.full_name || user?.email;

  return (
    <div className="flex min-h-screen bg-[#f4f6f9]">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 bg-uk-navy lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col">
        <SidebarContent
          onLeaderboard={() => setShowLeaderboard(true)}
          onLogout={logout}
          userName={displayName}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-uk-navy/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-uk-navy shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              onNavigate={() => setMobileOpen(false)}
              onLeaderboard={() => setShowLeaderboard(true)}
              onLogout={logout}
              userName={displayName}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-border)] bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="border-uk-navy/20 text-uk-navy"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-uk-navy">
              {APP_BRAND.title}
            </p>
            <p className="truncate text-xs text-[var(--color-muted-foreground)]">
              {displayName}
            </p>
          </div>
        </header>

        <main
          className={cn(
            "flex-1",
            isChat ? "overflow-hidden p-0" : "overflow-auto p-4 sm:p-6 lg:p-8"
          )}
        >
          <Outlet />
        </main>
      </div>

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
