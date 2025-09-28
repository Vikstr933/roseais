import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { WorkspaceCard } from "@/components/WorkspaceCard";
import { useState } from "react";

export default function Workspaces() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: workspaces = [] } = useQuery<any[]>({
    queryKey: ["/api/workspaces"],
  });

  const filteredWorkspaces = workspaces.filter(workspace =>
    workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    workspace.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (workspace.use_cases && workspace.use_cases.some((useCase: string) =>
      useCase.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          Agent Development Workspaces
        </h1>
        <p className="text-muted-foreground mt-2">
          Collaborate on building and testing AI agents
        </p>
      </motion.div>

      <SearchBar onSearch={setSearchTerm} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredWorkspaces.map((workspace, index) => (
          <motion.div
            key={workspace.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <WorkspaceCard workspace={workspace} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
