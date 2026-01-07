import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronLeft, Check, Loader2, FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CVBuilderFormProps {
  onComplete: (cvData: any) => void;
  onCancel: () => void;
  initialData?: any; // Pre-filled data from paste/parse
}

const STEPS = [
  { id: 1, title: 'Personlig Information', key: 'personal' },
  { id: 2, title: 'Professionell Sammanfattning', key: 'summary' },
  { id: 3, title: 'Erfarenhet', key: 'experience' },
  { id: 4, title: 'Utbildning', key: 'education' },
  { id: 5, title: 'Färdigheter', key: 'skills' },
  { id: 6, title: 'Välj Mall', key: 'template' },
];

export function CVBuilderForm({ onComplete, onCancel, initialData }: CVBuilderFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [formData, setFormData] = useState({
    personal: {
      fullName: initialData?.personal?.fullName || '',
      email: initialData?.personal?.email || '',
      phone: initialData?.personal?.phone || '',
      location: initialData?.personal?.location || '',
      linkedin: initialData?.personal?.linkedin || '',
      website: initialData?.personal?.website || '',
    },
    summary: {
      professionalSummary: initialData?.summary?.professionalSummary || '',
      yearsOfExperience: initialData?.summary?.yearsOfExperience || '',
      currentRole: initialData?.summary?.currentRole || '',
    },
    experience: initialData?.experience || [] as Array<{
      company: string;
      position: string;
      startDate: string;
      endDate: string;
      current: boolean;
      description: string;
    }>,
    education: initialData?.education || [] as Array<{
      institution: string;
      degree: string;
      field: string;
      startDate: string;
      endDate: string;
    }>,
    skills: initialData?.skills || [] as string[],
    template: initialData?.template || 'modern' as 'modern' | 'classic' | 'minimal' | 'professional',
  });

  // Update formData when initialData changes (for paste/parse functionality)
  useEffect(() => {
    if (initialData) {
      console.log('[CVBuilderForm] Updating formData from initialData:', initialData);
      setFormData({
        personal: {
          fullName: initialData.personal?.fullName || '',
          email: initialData.personal?.email || '',
          phone: initialData.personal?.phone || '',
          location: initialData.personal?.location || '',
          linkedin: initialData.personal?.linkedin || '',
          website: initialData.personal?.website || '',
        },
        summary: {
          professionalSummary: initialData.summary?.professionalSummary || '',
          yearsOfExperience: initialData.summary?.yearsOfExperience || '',
          currentRole: initialData.summary?.currentRole || '',
        },
        experience: initialData.experience || [],
        education: initialData.education || [],
        skills: initialData.skills || [],
        template: initialData.template || 'modern',
      });
    }
  }, [initialData]);

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    // TODO: Implement AI generation
    setTimeout(() => {
      setIsGenerating(false);
      onComplete(formData);
    }, 2000);
  };

  const addExperience = () => {
    setFormData({
      ...formData,
      experience: [
        ...formData.experience,
        {
          company: '',
          position: '',
          startDate: '',
          endDate: '',
          current: false,
          description: '',
        },
      ],
    });
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      education: [
        ...formData.education,
        {
          institution: '',
          degree: '',
          field: '',
          startDate: '',
          endDate: '',
        },
      ],
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: // Personal Info
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Fullständigt Namn *</Label>
                <Input
                  id="fullName"
                  value={formData.personal.fullName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal: { ...formData.personal, fullName: e.target.value },
                    })
                  }
                  placeholder="Förnamn Efternamn"
                />
              </div>
              <div>
                <Label htmlFor="email">E-post *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.personal.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal: { ...formData.personal, email: e.target.value },
                    })
                  }
                  placeholder="namn@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={formData.personal.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal: { ...formData.personal, phone: e.target.value },
                    })
                  }
                  placeholder="+46 70 123 45 67"
                />
              </div>
              <div>
                <Label htmlFor="location">Plats</Label>
                <Input
                  id="location"
                  value={formData.personal.location}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal: { ...formData.personal, location: e.target.value },
                    })
                  }
                  placeholder="Stockholm, Sverige"
                />
              </div>
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={formData.personal.linkedin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal: { ...formData.personal, linkedin: e.target.value },
                    })
                  }
                  placeholder="linkedin.com/in/namn"
                />
              </div>
              <div>
                <Label htmlFor="website">Webbplats</Label>
                <Input
                  id="website"
                  value={formData.personal.website}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      personal: { ...formData.personal, website: e.target.value },
                    })
                  }
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>
        );

      case 2: // Summary
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentRole">Nuvarande Roll / Titel</Label>
              <Input
                id="currentRole"
                value={formData.summary.currentRole}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    summary: { ...formData.summary, currentRole: e.target.value },
                  })
                }
                placeholder="t.ex. Frontend Developer"
              />
            </div>
            <div>
              <Label htmlFor="yearsOfExperience">År av Erfarenhet</Label>
              <Select
                value={formData.summary.yearsOfExperience}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    summary: { ...formData.summary, yearsOfExperience: value },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj år" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-1">0-1 år</SelectItem>
                  <SelectItem value="2-3">2-3 år</SelectItem>
                  <SelectItem value="4-5">4-5 år</SelectItem>
                  <SelectItem value="6-10">6-10 år</SelectItem>
                  <SelectItem value="10+">10+ år</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="professionalSummary">Professionell Sammanfattning *</Label>
              <Textarea
                id="professionalSummary"
                value={formData.summary.professionalSummary}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    summary: { ...formData.summary, professionalSummary: e.target.value },
                  })
                }
                placeholder="Beskriv kortfattat din professionella bakgrund, dina styrkor och vad du söker..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tips: Beskriv dina viktigaste färdigheter, erfarenhet och karriärmål
              </p>
            </div>
          </div>
        );

      case 3: // Experience
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Arbetserfarenhet</h3>
              <Button type="button" variant="outline" size="sm" onClick={addExperience}>
                + Lägg till Erfarenhet
              </Button>
            </div>
            {formData.experience.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>Ingen erfarenhet tillagd ännu</p>
                <p className="text-sm mt-1">Klicka på "Lägg till Erfarenhet" för att börja</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.experience.map((exp, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Företag *</Label>
                          <Input
                            value={exp.company}
                            onChange={(e) => {
                              const newExp = [...formData.experience];
                              newExp[index].company = e.target.value;
                              setFormData({ ...formData, experience: newExp });
                            }}
                            placeholder="Företagsnamn"
                          />
                        </div>
                        <div>
                          <Label>Position / Titel *</Label>
                          <Input
                            value={exp.position}
                            onChange={(e) => {
                              const newExp = [...formData.experience];
                              newExp[index].position = e.target.value;
                              setFormData({ ...formData, experience: newExp });
                            }}
                            placeholder="t.ex. Frontend Developer"
                          />
                        </div>
                        <div>
                          <Label>Startdatum</Label>
                          <Input
                            type="month"
                            value={exp.startDate}
                            onChange={(e) => {
                              const newExp = [...formData.experience];
                              newExp[index].startDate = e.target.value;
                              setFormData({ ...formData, experience: newExp });
                            }}
                          />
                        </div>
                        <div>
                          <Label>Slutdatum</Label>
                          <Input
                            type="month"
                            value={exp.endDate}
                            onChange={(e) => {
                              const newExp = [...formData.experience];
                              newExp[index].endDate = e.target.value;
                              setFormData({ ...formData, experience: newExp });
                            }}
                            disabled={exp.current}
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              id={`current-${index}`}
                              checked={exp.current}
                              onChange={(e) => {
                                const newExp = [...formData.experience];
                                newExp[index].current = e.target.checked;
                                setFormData({ ...formData, experience: newExp });
                              }}
                            />
                            <Label htmlFor={`current-${index}`} className="text-sm font-normal">
                              Nuvarande jobb
                            </Label>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>Beskrivning</Label>
                        <Textarea
                          value={exp.description}
                          onChange={(e) => {
                            const newExp = [...formData.experience];
                            newExp[index].description = e.target.value;
                            setFormData({ ...formData, experience: newExp });
                          }}
                          placeholder="Beskriv dina ansvar och prestationer..."
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 4: // Education
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Utbildning</h3>
              <Button type="button" variant="outline" size="sm" onClick={addEducation}>
                + Lägg till Utbildning
              </Button>
            </div>
            {formData.education.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>Ingen utbildning tillagd ännu</p>
                <p className="text-sm mt-1">Klicka på "Lägg till Utbildning" för att börja</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.education.map((edu, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Institution *</Label>
                          <Input
                            value={edu.institution}
                            onChange={(e) => {
                              const newEdu = [...formData.education];
                              newEdu[index].institution = e.target.value;
                              setFormData({ ...formData, education: newEdu });
                            }}
                            placeholder="t.ex. KTH, Stockholms Universitet"
                          />
                        </div>
                        <div>
                          <Label>Examen / Grad</Label>
                          <Input
                            value={edu.degree}
                            onChange={(e) => {
                              const newEdu = [...formData.education];
                              newEdu[index].degree = e.target.value;
                              setFormData({ ...formData, education: newEdu });
                            }}
                            placeholder="t.ex. Kandidatexamen, Master"
                          />
                        </div>
                        <div>
                          <Label>Ämne / Fält</Label>
                          <Input
                            value={edu.field}
                            onChange={(e) => {
                              const newEdu = [...formData.education];
                              newEdu[index].field = e.target.value;
                              setFormData({ ...formData, education: newEdu });
                            }}
                            placeholder="t.ex. Datateknik, Ekonomi"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Startdatum</Label>
                            <Input
                              type="month"
                              value={edu.startDate}
                              onChange={(e) => {
                                const newEdu = [...formData.education];
                                newEdu[index].startDate = e.target.value;
                                setFormData({ ...formData, education: newEdu });
                              }}
                            />
                          </div>
                          <div>
                            <Label>Slutdatum</Label>
                            <Input
                              type="month"
                              value={edu.endDate}
                              onChange={(e) => {
                                const newEdu = [...formData.education];
                                newEdu[index].endDate = e.target.value;
                                setFormData({ ...formData, education: newEdu });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );

      case 5: // Skills
        return (
          <div className="space-y-4">
            <div>
              <Label>Färdigheter</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Lägg till dina färdigheter, separera med kommatecken
              </p>
              <Input
                value={formData.skills.join(', ')}
                onChange={(e) => {
                  const skills = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
                  setFormData({ ...formData, skills });
                }}
                onKeyDown={(e) => {
                  // Allow all keys including comma
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                placeholder="t.ex. JavaScript, React, TypeScript, Node.js, Python..."
              />
            </div>
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 6: // Template
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Välj en mall för ditt CV. Du kan alltid ändra senare.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {(['modern', 'classic', 'minimal', 'professional'] as const).map((template) => (
                <Card
                  key={template}
                  className={`cursor-pointer transition-all ${
                    formData.template === template
                      ? 'border-2 border-purple-600 bg-purple-50'
                      : 'hover:border-purple-300'
                  }`}
                  onClick={() => setFormData({ ...formData, template })}
                >
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="w-16 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded mx-auto mb-3 flex items-center justify-center">
                        <FileText className="h-8 w-8 text-purple-600" />
                      </div>
                      <h3 className="font-semibold capitalize">{template}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template === 'modern' && 'Modernt och kreativt'}
                        {template === 'classic' && 'Klassisk och professionell'}
                        {template === 'minimal' && 'Enkelt och rent'}
                        {template === 'professional' && 'Formell och strukturerad'}
                      </p>
                      {formData.template === template && (
                        <Check className="h-5 w-5 text-purple-600 mx-auto mt-2" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-2xl">Skapa ditt CV</CardTitle>
              <CardDescription>
                Steg {currentStep} av {STEPS.length}: {STEPS[currentStep - 1].title}
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={onCancel}>
              Avbryt
            </Button>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="pt-6">
          {renderStep()}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Föregående
            </Button>
            <Button
              onClick={handleNext}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Genererar...
                </>
              ) : currentStep === STEPS.length ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Skapa CV
                </>
              ) : (
                <>
                  Nästa
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

