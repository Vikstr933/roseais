import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchBarProps {
  onSearch: (term: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative max-w-2xl mx-auto"
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          type="text"
          placeholder="Search AI models, companies, or frameworks..."
          className="pl-10 bg-card/80 backdrop-blur-sm border-primary/20"
          onChange={e => onSearch(e.target.value)}
        />
      </div>
    </motion.div>
  );
}
