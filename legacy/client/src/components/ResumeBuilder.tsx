import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Download,
  Wand2,
  Loader2,
  ChevronRight,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Mail,
  Phone,
  MapPin,
  Globe,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '../lib/api';
import { useToast } from '@/hooks/use-toast';

interface ResumeSection {
  id: string;
  type: 'personal' | 'experience' | 'education' | 'skills' | 'languages' | 'certifications' | 'projects';
  title: string;
  content: any;
}

interface ResumeBuilderProps {
  onSave?: (resumeData: any) => void;
  onGenerate?: () => void;
  initialData?: any;
}

export function ResumeBuilder({ onSave, onGenerate, initialData }: ResumeBuilderProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [template, setTemplate] = useState<'modern' | 'classic' | 'minimal' | 'professional'>('modern');
  
  // Personal Information
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
    summary: '',
  });

  // Sections
  const [sections, setSections] = useState<ResumeSection[]>([]);

  const addSection = (type: ResumeSection['type']) => {
    const newSection: ResumeSection = {
      id: Date.now().toString(),
      type,
      title: getSectionTitle(type),
      content: getDefaultContent(type),
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const getSectionTitle = (type: ResumeSection['type']): string => {
    const titles: Record<ResumeSection['type'], string> = {
      personal: 'Personlig Information',
      experience: 'Erfarenhet',
      education: 'Utbildning',
      skills: 'Färdigheter',
      languages: 'Språk',
      certifications: 'Certifieringar',
      projects: 'Projekt',
    };
    return titles[type];
  };

  const getDefaultContent = (type: ResumeSection['type']): any => {
    switch (type) {
      case 'experience':
        return {
          company: '',
          position: '',
          startDate: '',
          endDate: '',
          current: false,
          description: '',
          achievements: [],
        };
      case 'education':
        return {
          institution: '',
          degree: '',
          field: '',
          startDate: '',
          endDate: '',
          gpa: '',
        };
      case 'skills':
        return {
          categories: [
            { name: 'Tekniska Färdigheter', skills: [] },
          ],
        };
      case 'languages':
        return {
          languages: [{ name: '', level: 'Flytande' }],
        };
      case 'certifications':
        return {
          certifications: [{ name: '', issuer: '', date: '' }],
        };
      case 'projects':
        return {
          projects: [{ name: '', description: '', technologies: [], url: '' }],
        };
      default:
        return {};
    }
  };

  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    try {
      // TODO: Implement AI generation
      toast({
        title: 'AI-generering',
        description: 'CV-byggare med AI kommer snart!',
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte generera CV',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const resumeData = {
      template,
      personalInfo,
      sections,
    };
    if (onSave) {
      onSave(resumeData);
    }
    toast({
      title: 'Sparat',
      description: 'CV-data har sparats',
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="template">Välj Mall</Label>
              <Select value={template} onValueChange={(value: any) => setTemplate(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="classic">Klassisk</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="professional">Professionell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => setTemplate('modern')}>
                <FileText className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">Modern</h3>
                <p className="text-sm text-muted-foreground">Modernt och kreativt design</p>
              </Card>
              <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => setTemplate('classic')}>
                <FileText className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">Klassisk</h3>
                <p className="text-sm text-muted-foreground">Traditionell och professionell</p>
              </Card>
              <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => setTemplate('minimal')}>
                <FileText className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">Minimal</h3>
                <p className="text-sm text-muted-foreground">Enkelt och rent</p>
              </Card>
              <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => setTemplate('professional')}>
                <FileText className="h-8 w-8 mb-2" />
                <h3 className="font-semibold">Professionell</h3>
                <p className="text-sm text-muted-foreground">Formell och strukturerad</p>
              </Card>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Fullständigt Namn</Label>
                <Input
                  id="fullName"
                  value={personalInfo.fullName}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                  placeholder="Förnamn Efternamn"
                />
              </div>
              <div>
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                  placeholder="namn@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                  placeholder="+46 70 123 45 67"
                />
              </div>
              <div>
                <Label htmlFor="location">Plats</Label>
                <Input
                  id="location"
                  value={personalInfo.location}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, location: e.target.value })}
                  placeholder="Stockholm, Sverige"
                />
              </div>
              <div>
                <Label htmlFor="website">Webbplats</Label>
                <Input
                  id="website"
                  value={personalInfo.website}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={personalInfo.linkedin}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })}
                  placeholder="linkedin.com/in/namn"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="summary">Professionell Sammanfattning</Label>
              <Textarea
                id="summary"
                value={personalInfo.summary}
                onChange={(e) => setPersonalInfo({ ...personalInfo, summary: e.target.value })}
                placeholder="Kort sammanfattning av din professionella bakgrund..."
                rows={4}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">CV-sektioner</h3>
              <div className="flex gap-2">
                <Select onValueChange={(value: ResumeSection['type']) => addSection(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Lägg till sektion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="experience">Erfarenhet</SelectItem>
                    <SelectItem value="education">Utbildning</SelectItem>
                    <SelectItem value="skills">Färdigheter</SelectItem>
                    <SelectItem value="languages">Språk</SelectItem>
                    <SelectItem value="certifications">Certifieringar</SelectItem>
                    <SelectItem value="projects">Projekt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              {sections.map((section) => (
                <Card key={section.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(section.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Section content editor will be implemented based on type */}
                    <p className="text-sm text-muted-foreground">
                      Redigera {section.title.toLowerCase()} kommer snart...
                    </p>
                  </CardContent>
                </Card>
              ))}
              {sections.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Inga sektioner tillagda ännu</p>
                    <p className="text-sm mt-1">Lägg till sektioner för att bygga ditt CV</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>CV-byggare</CardTitle>
            <CardDescription>
              Bygg ditt CV steg för steg med AI-hjälp
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateWithAI}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Genererar...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI-generera
                </>
              )}
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Spara
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep >= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step}
                </div>
                <span className="ml-2 text-sm">
                  {step === 1 ? 'Mall' : step === 2 ? 'Personlig Info' : 'Sektioner'}
                </span>
              </div>
              {step < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        {renderStep()}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Föregående
          </Button>
          <Button
            onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
            disabled={currentStep === 3}
          >
            Nästa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

