import { motion } from "framer-motion";
import { Brain, Code, Building2, Laptop } from "lucide-react";
import { Link } from "wouter";

export function Navigation() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-primary/20"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center text-primary"
            >
              <Brain className="w-6 h-6 mr-2" />
              <span className="font-bold">AI Library</span>
            </motion.div>

            <div className="hidden md:flex space-x-6">
              <NavLink href="/" icon={Brain} text="Models" />
              <NavLink href="/workspaces" icon={Laptop} text="Workspaces" />
              <NavLink href="/companies" icon={Building2} text="Companies" />
              <NavLink href="/frameworks" icon={Code} text="Frameworks" />
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

function NavLink({ href, icon: Icon, text }: { href: string; icon: any; text: string }) {
  return (
    <Link href={href}>
      <motion.a
        whileHover={{ scale: 1.05 }}
        className="flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
      >
        <Icon className="w-4 h-4" />
        <span>{text}</span>
      </motion.a>
    </Link>
  );
}