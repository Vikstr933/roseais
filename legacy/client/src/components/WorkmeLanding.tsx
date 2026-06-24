import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Upload, Wand2, ArrowRight, ClipboardPaste } from 'lucide-react';

interface WorkmeLandingProps {
  onUploadCV: () => void;
  onCreateCV: () => void;
  onPasteText?: () => void;
}

export function WorkmeLanding({ onUploadCV, onCreateCV, onPasteText }: WorkmeLandingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Workme
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Din AI-drivna karriärcoach. Hitta ditt drömjobb snabbare med automatiserad jobbsökning och skräddarsydda CV:n.
          </p>
        </div>

        {/* Main Choice Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Option 1: Har CV */}
          <Card className="border-2 hover:border-purple-300 transition-all hover:shadow-lg cursor-pointer group" onClick={onUploadCV}>
            <CardHeader className="pb-4">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                <Upload className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl mb-2">Jag har ett CV</CardTitle>
              <CardDescription className="text-base">
                Ladda upp ditt befintliga CV och få omedelbar analys, förbättringsförslag och matchade jobb.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                  AI-analys av ditt CV
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                  Automatisk jobbmatchning
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                  Förbättringsförslag
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                  Auto-ansökningar
                </li>
              </ul>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" size="lg">
                <Upload className="h-5 w-5 mr-2" />
                Ladda upp CV
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: Skapa CV */}
          <Card className="border-2 hover:border-blue-300 transition-all hover:shadow-lg cursor-pointer group" onClick={onCreateCV}>
            <CardHeader className="pb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Wand2 className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl mb-2">Skapa nytt CV</CardTitle>
              <CardDescription className="text-base">
                Bygg ditt CV steg för steg med AI-hjälp. Svara på några enkla frågor och få ett professionellt CV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  Steg-för-steg guide
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  Professionella mallar
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  AI-genererat innehåll
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  Direkt redo för jobbsökning
                </li>
              </ul>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700" size="lg">
                <Wand2 className="h-5 w-5 mr-2" />
                Skapa CV
              </Button>
            </CardContent>
          </Card>

          {/* Option 3: Klistra in text */}
          {onPasteText && (
            <Card className="border-2 hover:border-green-300 transition-all hover:shadow-lg cursor-pointer group" onClick={onPasteText}>
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                  <ClipboardPaste className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl mb-2">Klistra in text</CardTitle>
                <CardDescription className="text-base">
                  Klistra in text från LinkedIn, gammalt CV eller skriv fritt. AI:n skapar ett strukturerat CV-draft åt dig.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    Klistra in ostrukturerad text
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    AI genererar CV-draft automatiskt
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    Redigera och förfina enkelt
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                    Perfekt för LinkedIn-kopiering
                  </li>
                </ul>
                <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" size="lg">
                  <ClipboardPaste className="h-5 w-5 mr-2" />
                  Klistra in text
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mt-12">
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold mb-1">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">Använd AI för att optimera ditt CV och hitta rätt jobb</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-1">Automatisk Matchning</h3>
            <p className="text-sm text-muted-foreground">Hitta jobb som matchar dina färdigheter automatiskt</p>
          </div>
          <div className="text-center p-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <ArrowRight className="h-6 w-6 text-cyan-600" />
            </div>
            <h3 className="font-semibold mb-1">Auto-Ansökningar</h3>
            <p className="text-sm text-muted-foreground">Ansök automatiskt till matchade jobb</p>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mt-16 pt-12 border-t">
          <h2 className="text-3xl font-bold text-center mb-8">Hur det fungerar</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white rounded-lg border-2 border-purple-100">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="font-semibold text-lg mb-2">Ladda upp eller skapa CV</h3>
              <p className="text-sm text-muted-foreground">
                Börja med att ladda upp ditt befintliga CV eller skapa ett nytt med vår AI-guide. Processen tar bara några minuter.
              </p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg border-2 border-blue-100">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="font-semibold text-lg mb-2">Få AI-analys och matchningar</h3>
              <p className="text-sm text-muted-foreground">
                Vår AI analyserar ditt CV och matchar det automatiskt mot hundratals relevanta jobb. Du får detaljerad feedback och förbättringsförslag.
              </p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg border-2 border-cyan-100">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="font-semibold text-lg mb-2">Ansök automatiskt</h3>
              <p className="text-sm text-muted-foreground">
                Välj jobb och låt vår AI anpassa ditt CV och skicka ansökningar automatiskt. Du får full kontroll och kan spåra allt i realtid.
              </p>
            </div>
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="mt-16 pt-12 border-t">
          <h2 className="text-3xl font-bold text-center mb-8">Vad våra användare säger</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4 italic">
                  "Workme hjälpte mig att hitta mitt drömjobb på bara 2 veckor! AI-analysen av mitt CV gav mig insikter jag aldrig tänkt på."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    M
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Maria K.</p>
                    <p className="text-xs text-muted-foreground">Mjukvaruutvecklare</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4 italic">
                  "Auto-ansökningarna sparade mig timmar varje vecka. Jag fick 5 intervjuer på en månad, vilket är rekord för mig!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
                    E
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Erik L.</p>
                    <p className="text-xs text-muted-foreground">Dataanalytiker</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4 italic">
                  "CV-byggaren är fantastisk! Från noll till professionellt CV på 15 minuter. Rekommenderar starkt till alla som byter karriär."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                    S
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Sara A.</p>
                    <p className="text-xs text-muted-foreground">UX Designer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

