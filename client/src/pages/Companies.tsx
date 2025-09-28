import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SearchBar } from "@/components/SearchBar";
import { Building2, Globe, Calendar } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface Company {
  id: number;
  name: string;
  description: string;
  founded: string;
  website: string;
  logoUrl?: string;
  products: string[];
  use_cases?: string[];
}

export default function Companies() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: companies = [], isLoading, error } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.products.some(product => product.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          <h3 className="font-medium mb-2">Error Loading Companies</h3>
          <p>{error.message || 'An error occurred while loading companies'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">
          AI Companies & Organizations
        </h1>
        <p className="text-muted-foreground mt-2">
          Leading companies in artificial intelligence and machine learning
        </p>
      </motion.div>

      <SearchBar onSearch={setSearchTerm} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {filteredCompanies.map((company, index) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full backdrop-blur-sm bg-card/80 border border-primary/20 shadow-lg hover:shadow-primary/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="text-xl font-semibold">{company.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Founded {company.founded}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm">{company.description}</p>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2">Products & Services:</h4>
                  <div className="flex flex-wrap gap-2">
                    {company.products.map((product, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-primary/10 text-primary"
                      >
                        {product}
                      </Badge>
                    ))}
                  </div>
                </div>

                {company.use_cases && company.use_cases.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-2">Use Cases:</h4>
                    <div className="space-y-2">
                      {company.use_cases.map((useCase, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          {useCase.startsWith("Not suitable for:") ? (
                            <span className="text-destructive">❌ {useCase}</span>
                          ) : (
                            <span className="text-green-600">✅ {useCase}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    Visit Website
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredCompanies.length === 0 && companies.length > 0 && (
        <div className="text-center text-muted-foreground mt-8">
          <p>No companies found matching your search.</p>
        </div>
      )}

      {companies.length === 0 && (
        <div className="text-center text-muted-foreground mt-8">
          <p>No companies available.</p>
        </div>
      )}
    </div>
  );
}
