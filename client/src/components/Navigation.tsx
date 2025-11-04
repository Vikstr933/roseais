import { motion } from 'framer-motion';
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
    // Admin only
    { href: '/admin', icon: Shield, text: 'Admin', requireAuth: true, adminOnly: true },
    // Superadmin only
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

  return (
    <>
      {/* Spacer to prevent content from being covered by fixed nav */}
      <div className="h-24 w-full bg-background"></div>
      
      {/* Floating Horizontal Navigation Bar - Centered Container */}
      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative"
        >
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full blur-xl opacity-30"></div>
          
          {/* Main Navigation Bar - Responsive for 14" screens */}
          <div className="relative flex items-center justify-center gap-2 lg:gap-3 px-3 lg:px-6 py-2 lg:py-3 bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 rounded-full shadow-2xl">
            {/* Navigation Links - Hide text on smaller screens */}
            <div className="flex items-center gap-1 lg:gap-2">
              {visibleLinks.map((link) => {
                const isActive = location === link.href || 
                                (link.href !== '/' && location.startsWith(link.href));
                
                return (
                  <Link key={link.href} href={link.href}>
                    <motion.button
                      className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <link.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                      {/* Show text only on larger screens or active links */}
                      <span className={`${isActive ? '' : 'hidden xl:inline'} whitespace-nowrap`}>
                        {link.text}
                      </span>
                      {link.superadminOnly && (
                        <span className="px-1 py-0.5 text-[10px] lg:text-xs bg-purple-500/30 text-purple-200 rounded hidden lg:inline">
                          SA
                        </span>
                      )}
                      {link.adminOnly && !link.superadminOnly && (
                        <span className="px-1 py-0.5 text-[10px] lg:text-xs bg-orange-500/30 text-orange-200 rounded hidden lg:inline">
                          A
                        </span>
                      )}
                    </motion.button>
                  </Link>
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-6 lg:h-8 w-px bg-slate-700"></div>

            {/* User Section - Compact on small screens */}
            <div className="flex items-center gap-1 lg:gap-2">
              {user ? (
                <>
                  {isSuperAdmin && (
                    <span className="px-1.5 lg:px-2 py-0.5 lg:py-1 text-[10px] lg:text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full whitespace-nowrap">
                      👑 <span className="hidden lg:inline">Admin</span>
                    </span>
                  )}
                  <Link href="/settings">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-full text-xs lg:text-sm px-2 lg:px-3 ${
                        location === '/settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : ''
                      }`}
                    >
                      <UserCog className="h-3.5 w-3.5 lg:h-4 lg:w-4 lg:mr-2" />
                      <span className="hidden lg:inline">Settings</span>
                    </Button>
                  </Link>
                  <Button
                    onClick={logout}
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-full text-xs lg:text-sm px-2 lg:px-3"
                  >
                    <LogOut className="h-3.5 w-3.5 lg:h-4 lg:w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Logout</span>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowAuthDialog(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full text-xs lg:text-sm px-3 lg:px-4"
                  size="sm"
                >
                  <User className="h-3.5 w-3.5 lg:h-4 lg:w-4 lg:mr-2" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              )}
            </div>
          </div>
        </motion.nav>
      </div>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </>
  );
}
