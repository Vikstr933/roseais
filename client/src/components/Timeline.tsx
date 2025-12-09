import { motion } from 'framer-motion';

interface TimelineProps {
  items: any[];
}

export function Timeline({ items }: TimelineProps) {
  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
  );

  return (
    <div className="relative">
      <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-primary/20" />

      {sortedItems.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`relative flex items-center mb-8 ${
            index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
          }`}
        >
          <div className="w-1/2 px-8">
            <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
              <h3 className="font-semibold text-lg">{item.name}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(item.releaseDate).toLocaleDateString()}
              </p>
              <p className="mt-2 text-sm">{item.description}</p>
            </div>
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4">
            <div className="w-full h-full rounded-full bg-primary" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
