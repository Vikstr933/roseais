import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Upload, Wand2, ArrowRight } from 'lucide-react';

interface WorkmeLandingProps {
  onUploadCV: () => void;
  onCreateCV: () => void;
}

export function WorkmeLanding({ onUploadCV, onCreateCV }: WorkmeLandingProps) {
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
        <div className="grid md:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}

