import {
  Brain,
  Code,
  Building2,
  Laptop,
  Terminal,
  Settings,
  ScrollText,
  History,
  User,
  LogOut,
  Plug,
  UserCog,
  Shield,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';

export function Navigation() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user, logout, isSuperAdmin } = useAuth();
  const [location] = useLocation();

  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  const navLinks = [
    { href: '/workspaces', icon: Laptop, text: 'Workspaces', requireAuth: false },
    { href: '/playground', icon: Terminal, text: 'Playground', requireAuth: false },
    { href: '/agent-manager', icon: Settings, text: 'Agent Manager', requireAuth: false },
    { href: '/integrations', icon: Plug, text: 'Integrations', requireAuth: false },
    { href: '/sessions', icon: History, text: 'Sessions', requireAuth: false },
    { href: '/admin', icon: Shield, text: 'Admin', requireAuth: true, adminOnly: true },
    { href: '/', icon: Brain, text: 'Models', requireAuth: true, superadminOnly: true },
    { href: '/companies', icon: Building2, text: 'Companies', requireAuth: true, superadminOnly: true },
    { href: '/frameworks', icon: Code, text: 'Frameworks', requireAuth: true, superadminOnly: true },
    { href: '/system-logs', icon: ScrollText, text: 'System Logs', requireAuth: true, superadminOnly: true },
  ];

  const visibleLinks = navLinks.filter(link => {
    if (link.superadminOnly) return isSuperAdmin;
    if (link.adminOnly) return isAdmin;
    return true;
  });

  const linkClasses = (active: boolean) =>
    `flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
    }`;

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 border-b border-slate-900 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <a className="flex items-center gap-2 text-white font-semibold tracking-tight">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow">
                  <Brain className="h-5 w-5" />
                </div>
                <div className="hidden sm:block">
                  <p className="leading-none">OmniAssistant</p>
                  <p className="text-xs text-slate-400">AI workspace OS</p>
                </div>
              </a>
            </Link>
            <nav className="hidden xl:flex items-center gap-1">
              {visibleLinks.map(link => {
                const isActive =
                  location === link.href ||
                  (link.href !== '/' && location.startsWith(link.href));
                return (
                  <Link key={link.href} href={link.href}>
                    <a className={linkClasses(isActive)}>
                      <link.icon className="h-4 w-4" />
                      <span>{link.text}</span>
                      {link.superadminOnly && (
                        <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-[10px] text-purple-100">
                          SA
                        </span>
                      )}
                      {link.adminOnly && !link.superadminOnly && (
                        <span className="rounded bg-orange-500/30 px-1.5 py-0.5 text-[10px] text-orange-100">
                          A
                        </span>
                      )}
                    </a>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {isSuperAdmin && (
                  <span className="hidden lg:inline-flex items-center gap-1 rounded-full bg-purple-600/20 px-3 py-1 text-xs font-semibold text-purple-100">
                    👑 Super Admin
                  </span>
                )}
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-full px-3 ${
                      location === '/settings'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-slate-200 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </Link>
                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-3 text-slate-200 hover:text-white hover:bg-slate-800/70"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShowAuthDialog(true)}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-white shadow-lg shadow-blue-500/30 hover:from-blue-500 hover:to-purple-500"
                size="sm"
              >
                <User className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </div>

        {/* Secondary row for smaller screens */}
        <div className="border-t border-slate-200/5 px-4 py-2 xl:hidden bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
            {visibleLinks.map(link => {
              const isActive =
                location === link.href ||
                (link.href !== '/' && location.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href}>
                  <a
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 text-slate-200 hover:text-white'
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    <span>{link.text}</span>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
