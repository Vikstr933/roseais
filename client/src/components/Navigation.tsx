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

  const navLinks = [
    { href: '/workspaces', icon: Laptop, text: 'Workspaces', requireAuth: false },
    { href: '/playground', icon: Terminal, text: 'Playground', requireAuth: false },
    { href: '/agent-manager', icon: Settings, text: 'Agent Manager', requireAuth: false },
    { href: '/sessions', icon: History, text: 'Sessions', requireAuth: false },
    // Superadmin only
    { href: '/', icon: Brain, text: 'Models', requireAuth: true, superadminOnly: true },
    { href: '/companies', icon: Building2, text: 'Companies', requireAuth: true, superadminOnly: true },
    { href: '/frameworks', icon: Code, text: 'Frameworks', requireAuth: true, superadminOnly: true },
    { href: '/system-logs', icon: ScrollText, text: 'System Logs', requireAuth: true, superadminOnly: true },
  ];

  const visibleLinks = navLinks.filter(link => {
    if (link.superadminOnly) return isSuperAdmin;
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
          
          {/* Main Navigation Bar */}
          <div className="relative flex items-center justify-center gap-3 px-6 py-3 bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 rounded-full shadow-2xl">
            {/* Navigation Links */}
            <div className="flex items-center gap-2">
              {visibleLinks.map((link) => {
                const isActive = location === link.href || 
                                (link.href !== '/' && location.startsWith(link.href));
                
                return (
                  <Link key={link.href} href={link.href}>
                    <motion.button
                      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <link.icon className="h-4 w-4" />
                      <span>{link.text}</span>
                      {link.superadminOnly && (
                        <span className="px-1.5 py-0.5 text-xs bg-purple-500/30 text-purple-200 rounded">
                          SA
                        </span>
                      )}
                    </motion.button>
                  </Link>
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-slate-700"></div>

            {/* User Section */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {isSuperAdmin && (
                    <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full whitespace-nowrap">
                      👑 Admin
                    </span>
                  )}
                  <Button
                    onClick={logout}
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-full whitespace-nowrap"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setShowAuthDialog(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full whitespace-nowrap"
                  size="sm"
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign In
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
