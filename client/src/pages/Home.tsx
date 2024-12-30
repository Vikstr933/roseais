import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { AiCard } from "@/components/AiCard";
import { Timeline } from "@/components/Timeline";
import { useState } from "react";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: models = [] } = useQuery<any[]>({
    queryKey: ["/api/models"],
  });

  const filteredModels = models.filter(model => 
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          AI Models Library
        </h1>
        <p className="text-muted-foreground mt-2">
          Explore the latest in AI technology
        </p>
      </motion.div>

      <SearchBar onSearch={setSearchTerm} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredModels.map((model, index) => (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <AiCard model={model} />
          </motion.div>
        ))}
      </div>

      <div className="mt-16">
        <h2 className="text-2xl font-semibold mb-8">AI Development Timeline</h2>
        <Timeline items={models} />
      </div>
    </div>
  );
}
