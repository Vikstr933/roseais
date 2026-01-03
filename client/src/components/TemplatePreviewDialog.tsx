import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Check, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: 'modern' | 'classic' | 'minimal' | 'professional') => void;
  selectedTemplate: 'modern' | 'classic' | 'minimal' | 'professional';
}

const templates = [
  { value: 'modern', label: 'Modern', description: 'Tvåkolumnslayout med modern design' },
  { value: 'classic', label: 'Klassisk', description: 'Enkelspaltslayout med traditionell stil' },
  { value: 'minimal', label: 'Minimal', description: 'Ren och enkel design med minimal styling' },
  { value: 'professional', label: 'Professionell', description: 'Företagsstil med färgad sidopanel' },
];

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  selectedTemplate,
}: TemplatePreviewDialogProps) {
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      // Generate previews for all templates
      templates.forEach((template) => {
        generatePreview(template.value as 'modern' | 'classic' | 'minimal' | 'professional');
      });
    }
  }, [open]);

  const generatePreview = async (template: 'modern' | 'classic' | 'minimal' | 'professional') => {
    if (previewImages[template]) return; // Already generated
    
    setLoading((prev) => ({ ...prev, [template]: true }));
    try {
      const response = await apiFetch('/api/resumes/preview-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewImages((prev) => ({ ...prev, [template]: url }));
      }
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setLoading((prev) => ({ ...prev, [template]: false }));
    }
  };

  const handleSelect = (template: 'modern' | 'classic' | 'minimal' | 'professional') => {
    onSelectTemplate(template);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Välj CV-mall</DialogTitle>
          <DialogDescription>
            Välj en mall för ditt CV. Du kan se en förhandsvisning av varje mall nedan.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={selectedTemplate} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            {templates.map((template) => (
              <TabsTrigger key={template.value} value={template.value}>
                {template.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {templates.map((template) => (
            <TabsContent key={template.value} value={template.value} className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{template.label}</h3>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </div>
                  <Button
                    onClick={() => handleSelect(template.value as any)}
                    className={selectedTemplate === template.value ? 'bg-primary' : ''}
                  >
                    {selectedTemplate === template.value ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Vald
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Välj denna mall
                      </>
                    )}
                  </Button>
                </div>

                <ScrollArea className="h-[500px] w-full border rounded-lg">
                  <div className="p-4">
                    {loading[template.value] ? (
                      <div className="flex items-center justify-center h-[450px]">
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                          <p className="text-sm text-muted-foreground">Genererar förhandsvisning...</p>
                        </div>
                      </div>
                    ) : previewImages[template.value] ? (
                      <div className="w-full">
                        <object
                          data={previewImages[template.value]}
                          type="application/pdf"
                          className="w-full h-[600px] border-0 rounded-lg shadow-lg"
                          aria-label={`${template.label} template preview`}
                        >
                          <iframe
                            src={previewImages[template.value]}
                            className="w-full h-[600px] border-0 rounded-lg shadow-lg"
                            title={`${template.label} template preview`}
                          />
                        </object>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[450px] border-2 border-dashed rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Genererar förhandsvisning...
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

