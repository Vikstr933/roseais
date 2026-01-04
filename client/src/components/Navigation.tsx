import {
  Brain,
  Laptop,
  Terminal,
  Settings,
  LogOut,
  Plug,
  UserCog,
  Shield,
  Menu,
  X,
  Sparkles,
  Zap,
  FileText,
  Briefcase,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { AuthDialog } from '@/components/AuthDialog';

export function Navigation() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, isSuperAdmin } = useAuth();
  const [location] = useLocation();

  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  // Updated nav links without Frameworks, Companies, and Sessions
  const navLinks = [
    { href: '/workspaces', icon: Laptop, text: 'Workspaces', requireAuth: false },
    { href: '/playground', icon: Terminal, text: 'Playground', requireAuth: false },
    { href: '/public-projects', icon: Sparkles, text: 'Community', requireAuth: false },
    { href: '/community/resume-analysis', icon: FileText, text: 'CV Analys', requireAuth: false },
    { href: '/community/job-applications', icon: Briefcase, text: 'Jobbansökningar', requireAuth: false },
    { href: '/agent-manager', icon: Settings, text: 'Agents', requireAuth: false },
    { href: '/integrations', icon: Plug, text: 'Skills', requireAuth: false },
    { href: '/admin', icon: Shield, text: 'Admin', requireAuth: true, adminOnly: true },
  ];

  const visibleLinks = navLinks.filter(link => {
    if ('superadminOnly' in link && link.superadminOnly) return isSuperAdmin;
    if (link.adminOnly) return isAdmin;
    // For logged out users on home page, hide all nav links
    if (!user && location === '/') {
      return false;
    }
    // For logged out users on other pages, show minimal links
    if (!user) {
      return link.href === '/workspaces' || link.href === '/playground';
    }
    return true;
  });

  const isActiveLink = (href: string) => {
    if (href === '/' && location === '/') return true;
    if (href !== '/' && location.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      {/* Premium Navigation - Bright theme with glassmorphism */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-b border-purple-200/50 shadow-sm">
        <div className="flex h-20 items-center justify-between px-4 lg:px-6 gap-4 max-w-screen-2xl mx-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 text-gray-900 font-semibold tracking-tight flex-shrink-0 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30 group-hover:shadow-xl group-hover:shadow-purple-500/40 transition-all duration-300">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="hidden lg:block">
              <p className="leading-none text-gray-900 text-base font-bold">OmniAssistant</p>
              <p className="text-xs text-gray-600 font-normal">Help, in your own way.</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {visibleLinks.map(link => {
              const active = isActiveLink(link.href);
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`
                    flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-base font-medium transition-all duration-200
                    ${active 
                      ? 'bg-purple-100 text-purple-700 shadow-md shadow-purple-200/50' 
                      : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                    }
                  `}
                >
                  <link.icon className="h-5 w-5" />
                  <span>{link.text}</span>
                  {link.adminOnly && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] text-orange-700 border border-orange-300">
                      ADMIN
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side - User Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <>
                {isSuperAdmin && (
                  <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-purple-100 border border-purple-300 px-3 py-1.5 text-xs font-semibold text-purple-700">
                    <Zap className="h-3 w-3" />
                    Super Admin
                  </span>
                )}
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`hidden sm:flex rounded-lg px-3 ${
                      location === '/settings'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    <UserCog className="mr-2 h-4 w-4" />
                    <span className="hidden md:inline">Settings</span>
                  </Button>
                </Link>
                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex rounded-lg px-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
                {/* Mobile hamburger */}
                <Button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  variant="ghost"
                  size="sm"
                  className="lg:hidden rounded-lg p-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </>
            ) : (
              <>
                {/* Sign In button - Premium styling */}
                <Button
                  onClick={() => setShowAuthDialog(true)}
                  className="px-6 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg shadow-purple-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/40"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Sign In</span>
                </Button>
                {/* Mobile menu for logged out */}
                {visibleLinks.length > 0 && (
                  <Button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    variant="ghost"
                    size="sm"
                    className="lg:hidden rounded-lg p-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50"
                    aria-label="Toggle menu"
                  >
                    {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu - Premium Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[85%] sm:w-[400px] p-0 bg-white/95 backdrop-blur-xl border-purple-200/50 text-gray-900">
          <SheetHeader className="px-4 py-4 border-b border-purple-200/50">
            <SheetTitle className="flex items-center gap-2 text-gray-900">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span>Menu</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-4 space-y-1">
              {visibleLinks.map(link => {
                const active = isActiveLink(link.href);
                return (
                  <Link 
                    key={link.href} 
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold transition-all ${
                      active
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                    }`}
                  >
                    <link.icon className="h-5 w-5" />
                    <span>{link.text}</span>
                    {link.adminOnly && (
                      <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 border border-orange-300">
                        ADMIN
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            
            {user && (
              <>
                <div className="border-t border-purple-200/50 my-2" />
                <div className="px-3 py-2 space-y-1 pb-4">
                  {/* Elon Assistant button */}
                  {!location.startsWith('/playground') && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        window.dispatchEvent(new CustomEvent('openElon'));
                      }}
                      className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-purple-700 hover:bg-purple-50 transition-all border border-purple-200"
                    >
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <span>Elon Assistant</span>
                    </button>
                  )}
                  <Link href="/settings">
                    <a
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-all ${
                        location === '/settings'
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                      }`}
                    >
                      <UserCog className="h-5 w-5" />
                      <span>Settings</span>
                    </a>
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
