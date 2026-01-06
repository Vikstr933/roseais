import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Zap,
  Settings,
  Filter,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Building2,
  X,
  Mail,
  ExternalLink,
  Info,
  FileText,
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

interface AutoApplyCriteria {
  minMatchPercentage: number;
  location?: string;
  excludeCompanies?: string[];
  maxApplicationsPerDay?: number;
  maxApplicationsPerWeek?: number;
}

interface AutoApplySettingsProps {
  resumeId?: number;
  onSettingsChange?: (settings: any) => void;
}

export function AutoApplySettings({ resumeId, onSettingsChange }: AutoApplySettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [criteria, setCriteria] = useState<AutoApplyCriteria>({
    minMatchPercentage: 80,
    maxApplicationsPerDay: 10,
    maxApplicationsPerWeek: 50,
  });
  const [requireConfirmation, setRequireConfirmation] = useState(true);
  const [excludeCompanyInput, setExcludeCompanyInput] = useState('');
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetchSettings();
    checkGmailConnection();
  }, []);

  const checkGmailConnection = async () => {
    try {
      const response = await apiFetch('/api/plugins/status');
      if (response.ok) {
        const data = await response.json();
        const gmailPlugin = data.plugins?.find((p: any) => p.pluginId === 'gmail');
        setGmailConnected(gmailPlugin?.status?.authenticated || false);
      } else {
        setGmailConnected(false);
      }
    } catch (error) {
      setGmailConnected(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/auto-apply/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setEnabled(data.settings.enabled || false);
          setCriteria(data.settings.criteria || criteria);
          setRequireConfirmation(data.settings.requireConfirmation !== false);
        }
      }
    } catch (error) {
      console.error('Error fetching auto-apply settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiFetch('/api/auto-apply/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          criteria,
          requireConfirmation,
          resumeId,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Inställningar sparade',
          description: 'Auto-apply inställningar har uppdaterats',
        });
        if (onSettingsChange) {
          onSettingsChange({ enabled, criteria, requireConfirmation });
        }
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara inställningar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addExcludeCompany = () => {
    if (excludeCompanyInput.trim()) {
      setCriteria({
        ...criteria,
        excludeCompanies: [...(criteria.excludeCompanies || []), excludeCompanyInput.trim()],
      });
      setExcludeCompanyInput('');
    }
  };

  const removeExcludeCompany = (company: string) => {
    setCriteria({
      ...criteria,
      excludeCompanies: criteria.excludeCompanies?.filter(c => c !== company) || [],
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Auto-ansökningar
            </CardTitle>
            <CardDescription>
              Konfigurera automatiska ansökningar till matchade jobb
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <span className="text-sm font-medium">
              {enabled ? 'Aktiverad' : 'Inaktiverad'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gmail Connection Warning */}
        {enabled && gmailConnected === false && (
          <Alert variant="destructive" className="border-orange-200 bg-orange-50">
            <Mail className="h-4 w-4" />
            <AlertTitle>Gmail krävs för auto-ansökningar</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-2">
                För att kunna skicka ansökningar automatiskt via e-post måste du koppla ditt Gmail-konto.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Navigate to plugin settings or open Gmail connection
                  window.location.href = '/settings?tab=plugins';
                }}
                className="mt-2"
              >
                <Mail className="h-4 w-4 mr-2" />
                Koppla Gmail
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {enabled && gmailConnected === true && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Gmail är kopplat</AlertTitle>
            <AlertDescription className="text-green-700">
              Ditt Gmail-konto är kopplat. Ansökningar kommer att skickas automatiskt med PDF-bilaga.
            </AlertDescription>
          </Alert>
        )}

        {/* Application Methods Info */}
        {enabled && (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Ansökningsmetoder</AlertTitle>
            <AlertDescription className="text-blue-700 space-y-2 mt-2">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <strong>E-post:</strong> Skickas automatiskt med CV som PDF-bilaga när Gmail är kopplat.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <strong>Formulär/Webbplats:</strong> Ansökningar spåras i systemet. Du behöver ansöka manuellt via jobbannonsens webbplats.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <strong>LinkedIn:</strong> Ansökningar spåras i systemet. Du behöver ansöka manuellt via LinkedIn.
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {enabled && (
          <>
            {/* Match Criteria */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Filter & Kriterier</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minMatch">Minsta Match-procent</Label>
                  <Input
                    id="minMatch"
                    type="number"
                    min="0"
                    max="100"
                    value={criteria.minMatchPercentage}
                    onChange={(e) => setCriteria({
                      ...criteria,
                      minMatchPercentage: parseInt(e.target.value) || 80,
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Endast jobb med {criteria.minMatchPercentage}%+ matchning
                  </p>
                </div>

                <div>
                  <Label htmlFor="location">Plats (valfritt)</Label>
                  <Input
                    id="location"
                    value={criteria.location || ''}
                    onChange={(e) => setCriteria({
                      ...criteria,
                      location: e.target.value || undefined,
                    })}
                    placeholder="Stockholm, Sverige"
                  />
                </div>
              </div>

              {/* Exclude Companies */}
              <div>
                <Label>Exkludera Företag</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={excludeCompanyInput}
                    onChange={(e) => setExcludeCompanyInput(e.target.value)}
                    placeholder="Företagsnamn"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addExcludeCompany();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addExcludeCompany}
                    size="sm"
                  >
                    Lägg till
                  </Button>
                </div>
                {criteria.excludeCompanies && criteria.excludeCompanies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {criteria.excludeCompanies.map((company) => (
                      <Badge key={company} variant="secondary" className="gap-1">
                        {company}
                        <button
                          onClick={() => removeExcludeCompany(company)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Gränser</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxPerDay">Max per Dag</Label>
                  <Input
                    id="maxPerDay"
                    type="number"
                    min="1"
                    value={criteria.maxApplicationsPerDay || 10}
                    onChange={(e) => setCriteria({
                      ...criteria,
                      maxApplicationsPerDay: parseInt(e.target.value) || 10,
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="maxPerWeek">Max per Vecka</Label>
                  <Input
                    id="maxPerWeek"
                    type="number"
                    min="1"
                    value={criteria.maxApplicationsPerWeek || 50}
                    onChange={(e) => setCriteria({
                      ...criteria,
                      maxApplicationsPerWeek: parseInt(e.target.value) || 50,
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Safety Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Säkerhetsinställningar</h3>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="requireConfirmation">Kräv Bekräftelse</Label>
                  <p className="text-xs text-muted-foreground">
                    Visa jobb för review innan ansökan
                  </p>
                </div>
                <Switch
                  id="requireConfirmation"
                  checked={requireConfirmation}
                  onCheckedChange={setRequireConfirmation}
                />
              </div>
            </div>
          </>
        )}

        {!enabled && (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Auto-ansökningar är inaktiverade</p>
            <p className="text-xs mt-1">Aktivera för att börja ansöka automatiskt till matchade jobb</p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving || !resumeId}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Spara Inställningar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

