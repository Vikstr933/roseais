import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { CVBuilderForm } from './CVBuilderForm';
import { apiFetch } from '@/lib/api';

interface PasteTextCVBuilderProps {
  onComplete: (cvData: any) => void;
  onCancel: () => void;
}

export function PasteTextCVBuilder({ onComplete, onCancel }: PasteTextCVBuilderProps) {
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Vänligen klistra in text');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const response = await apiFetch('/api/resumes/parse-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        // Try to parse error as JSON, but handle HTML responses
        let errorMessage = 'Kunde inte parsa texten';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            // If it's HTML (like a 404 page), get the status text
            const text = await response.text();
            if (response.status === 401) {
              errorMessage = 'Du behöver vara inloggad för att använda denna funktion';
            } else if (response.status === 404) {
              errorMessage = 'API-endpoint hittades inte. Kontrollera att servern är igång.';
            } else {
              errorMessage = `Serverfel (${response.status}): ${response.statusText}`;
            }
          }
        } catch (parseError) {
          // If we can't parse the error, use status
          errorMessage = `Serverfel (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Parse response as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returnerade inte JSON. Kontrollera att servern är igång.');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || data.error || 'Kunde inte parsa texten');
      }
      
      if (!data.cvData) {
        throw new Error('Ingen CV-data returnerades från servern');
      }
      
      setParsedData(data.cvData);
      setShowForm(true);
    } catch (err: any) {
      console.error('Error parsing text:', err);
      const errorMessage = err.message || 'Ett fel uppstod vid parsning av texten';
      setError(errorMessage);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFormComplete = (cvData: any) => {
    onComplete(cvData);
  };

  if (showForm && parsedData) {
    return (
      <CVBuilderForm
        onComplete={handleFormComplete}
        onCancel={() => {
          setShowForm(false);
          setParsedData(null);
        }}
        initialData={parsedData}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6 text-purple-600" />
                Klistra in text
              </CardTitle>
              <CardDescription className="mt-2">
                Klistra in ditt CV, LinkedIn-profil, eller ostrukturerad text om dina erfarenheter. 
                AI:n kommer att skapa ett strukturerat CV-draft som du kan redigera.
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pasted-text">Klistra in din text här</Label>
            <Textarea
              id="pasted-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              placeholder={`Exempel:
Jag heter Erik Andersson och är en erfaren mjukvaruutvecklare med 5 års erfarenhet av React och Node.js.

Arbetserfarenhet:
Frontend Developer på TechCorp (2020-2023)
- Utvecklade React-applikationer
- Arbetade med TypeScript och Redux

Backend Developer på StartupXYZ (2018-2020)
- Byggde REST APIs med Node.js
- Använde PostgreSQL och MongoDB

Utbildning:
Kandidatexamen i Datateknik, KTH (2015-2018)

Färdigheter:
JavaScript, React, Node.js, TypeScript, Python, SQL`}
              rows={15}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Tips: Du kan klistra in text från LinkedIn, ett gammalt CV, eller bara skriva fritt om dina erfarenheter. 
              AI:n kommer att strukturera allt åt dig.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleParse}
              disabled={!text.trim() || isParsing}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 flex-1"
              size="lg"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Parsar text...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generera CV-draft med AI
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onCancel} size="lg">
              Avbryt
            </Button>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Vad händer härnäst?</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>AI:n analyserar din text och extraherar information</li>
                  <li>Ett strukturerat CV-draft skapas automatiskt</li>
                  <li>Du kan redigera och förfina allt i formuläret</li>
                  <li>Spara ditt CV och börja söka jobb direkt</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

