import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Brain, Users, Clock, Lightbulb, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AgentPerformance {
  agentId: string | null;
  agentName: string | null;
  totalSessions: number;
  successRate: number;
  avgCodeLength: number;
}

interface CodePattern {
  hour: number;
  count: number;
  avgLength: number;
}

interface ProjectActivity {
  date: string;
  activeProjects: number;
  newProjects: number;
}

interface Insight {
  type: string;
  title: string;
  description: string;
  data: any;
}

interface StatisticalResult {
  correlation: number;
  pValue: number;
  confidence: number;
  sampleSize: number;
}

interface Hypothesis {
  id: string;
  title: string;
  description: string;
  hypothesis: string;
  confidence: 'low' | 'medium' | 'high';
  statisticalSignificance: StatisticalResult;
  actionableInsights: string[];
  validationMethod: string;
  data: Record<string, any>;
}

interface DataInsights {
  agentPerformance: AgentPerformance[];
  codePatterns: CodePattern[];
  projectActivity: ProjectActivity[];
  collaborationStats: {
    totalCollaborators?: number;
    mostCollaborativeProject?: string;
    avgCollaboratorsPerProject?: number;
  };
  chainAnalysis: any[];
  correlations: {
    agentSuccessVsCodeLength: Array<{ agent: string; successRate: number; avgCodeLength: number }>;
    timeOfDayVsProductivity: Array<{ hour: number; sessions: number; avgCodeLength: number }>;
  };
  insights: Insight[];
  summary: {
    totalSessions: number;
    uniqueAgents: number;
    activeProjects: number;
  };
}

const COLORS = ['#9333ea', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DataInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<DataInsights | null>(null);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
    fetchHypotheses();
  }, []);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/data-insights/overview');
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      if (data.success) {
        setInsights(data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data insights');
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHypotheses = async () => {
    try {
      const response = await apiFetch('/api/data-insights/hypotheses');
      if (!response.ok) throw new Error('Failed to fetch hypotheses');
      const data = await response.json();
      if (data.success) {
        setHypotheses(data.hypotheses || []);
      }
    } catch (err: any) {
      console.error('Error fetching hypotheses:', err);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyserar din data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8">
        <Alert>
          <AlertDescription>Ingen data hittades. Generera lite kod för att se intressanta insikter!</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-20 sm:pt-24 pb-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dataanalys & Insikter</h1>
          <p className="text-muted-foreground">
            Utforska intressanta mönster och kopplingar i din kodgenereringsdata
          </p>
          <p className="text-sm text-muted-foreground mt-2 italic">
            📊 All data kommer från verkliga kodgenereringssessioner, agentprestanda, och projektaktivitet i din databas
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala sessioner</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.summary.totalSessions}</div>
            <p className="text-xs text-muted-foreground">Kodgenereringssessioner</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva agenter</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.summary.uniqueAgents}</div>
            <p className="text-xs text-muted-foreground">Unika AI-agenter använda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva projekt</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.summary.activeProjects}</div>
            <p className="text-xs text-muted-foreground">Projekt med aktivitet</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Insights */}
      {insights.insights && insights.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Viktiga insikter
            </CardTitle>
            <CardDescription>Intressanta mönster i din data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.insights.map((insight, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-1">{insight.title}</h3>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agentprestanda</TabsTrigger>
          <TabsTrigger value="patterns">Tidsmönster</TabsTrigger>
          <TabsTrigger value="activity">Projektaktivitet</TabsTrigger>
          <TabsTrigger value="hypotheses">Hypoteser</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agentprestanda</CardTitle>
              <CardDescription>Framgångsfrekvens och kodlängd per agent</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.agentPerformance && insights.agentPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={insights.agentPerformance.map(a => ({
                    ...a,
                    agentName: a.agentName || (a.agentId ? `Agent ${a.agentId}` : 'Okänd agent'),
                    successRate: Number(a.successRate) || 0,
                    avgCodeLength: Number(a.avgCodeLength) || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="agentName" angle={-45} textAnchor="end" height={100} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="successRate" fill="#9333ea" name="Framgångsfrekvens (%)" />
                    <Bar yAxisId="right" dataKey="avgCodeLength" fill="#3b82f6" name="Genomsnittlig kodlängd" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Ingen agentdata tillgänglig ännu
                </p>
              )}
            </CardContent>
          </Card>

          {/* Correlation: Success Rate vs Code Length */}
          {insights.correlations?.agentSuccessVsCodeLength && insights.correlations.agentSuccessVsCodeLength.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Samband: Framgång vs Kodlängd</CardTitle>
                <CardDescription>Hur framgångsfrekvens korrelerar med kodlängd</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={insights.correlations.agentSuccessVsCodeLength}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="agent" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="successRate" stroke="#9333ea" name="Framgångsfrekvens (%)" />
                    <Line yAxisId="right" type="monotone" dataKey="avgCodeLength" stroke="#3b82f6" name="Kodlängd" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tidsmönster
              </CardTitle>
              <CardDescription>När genererar du mest kod?</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.codePatterns && insights.codePatterns.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={insights.codePatterns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" label={{ value: 'Timme', position: 'insideBottom', offset: -5 }} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#9333ea" name="Antal sessioner" />
                    <Bar yAxisId="right" dataKey="avgLength" fill="#10b981" name="Genomsnittlig kodlängd" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Ingen tidsdata tillgänglig ännu
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Projektaktivitet (30 dagar)
              </CardTitle>
              <CardDescription>Aktivitet över tid</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.projectActivity && insights.projectActivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={insights.projectActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="activeProjects" stroke="#9333ea" name="Aktiva projekt" />
                    <Line type="monotone" dataKey="newProjects" stroke="#10b981" name="Nya projekt" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Ingen projektaktivitet de senaste 30 dagarna
                </p>
              )}
            </CardContent>
          </Card>

          {insights.collaborationStats && insights.collaborationStats.totalCollaborators !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>Samarbetsstatistik</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Totala medarbetare:</span>
                    <span className="font-semibold">{insights.collaborationStats.totalCollaborators}</span>
                  </div>
                  {insights.collaborationStats.avgCollaboratorsPerProject !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Genomsnitt per projekt:</span>
                      <span className="font-semibold">
                        {(Number(insights.collaborationStats.avgCollaboratorsPerProject) || 0).toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hypotheses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Statistiskt Signifikanta Hypoteser
              </CardTitle>
              <CardDescription>
                Vetenskapligt baserade hypoteser med korrelationsanalys, p-värden och valideringsmetoder
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hypotheses.length > 0 ? (
                <div className="space-y-6">
                  {hypotheses.map((hypothesis) => (
                    <div key={hypothesis.id} className="p-5 border rounded-lg bg-gradient-to-br from-white to-purple-50/30">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{hypothesis.title}</h3>
                          <p className="text-sm text-muted-foreground">{hypothesis.description}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            hypothesis.confidence === 'high'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : hypothesis.confidence === 'medium'
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {hypothesis.confidence === 'high'
                            ? 'Hög'
                            : hypothesis.confidence === 'medium'
                            ? 'Medel'
                            : 'Låg'}{' '}
                          konfidens
                        </span>
                      </div>

                      {/* Hypothesis Statement */}
                      <div className="mb-4 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                        <p className="text-sm font-medium italic text-purple-900">
                          "{hypothesis.hypothesis}"
                        </p>
                      </div>

                      {/* Statistical Significance */}
                      {hypothesis.statisticalSignificance && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <h4 className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                            Statistisk Signifikans
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Korrelation:</span>
                              <span className="ml-1 font-semibold text-blue-900">
                                {hypothesis.statisticalSignificance.correlation.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">P-värde:</span>
                              <span className="ml-1 font-semibold text-blue-900">
                                {hypothesis.statisticalSignificance.pValue.toFixed(4)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Konfidens:</span>
                              <span className="ml-1 font-semibold text-blue-900">
                                {Math.round(hypothesis.statisticalSignificance.confidence)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Sample:</span>
                              <span className="ml-1 font-semibold text-blue-900">
                                {hypothesis.statisticalSignificance.sampleSize}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actionable Insights */}
                      {hypothesis.actionableInsights && hypothesis.actionableInsights.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">
                            Handlingsbara Insikter
                          </h4>
                          <ul className="space-y-2">
                            {hypothesis.actionableInsights.map((insight: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <span className="text-green-600 mt-0.5">✓</span>
                                <span className="text-muted-foreground">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Validation Method */}
                      {hypothesis.validationMethod && (
                        <div className="mb-4 p-3 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                          <h4 className="text-xs font-semibold text-amber-900 mb-1 uppercase tracking-wide">
                            Valideringsmetod
                          </h4>
                          <p className="text-sm text-amber-800">{hypothesis.validationMethod}</p>
                        </div>
                      )}

                      {/* Data Details */}
                      {hypothesis.data && Object.keys(hypothesis.data).length > 0 && (
                        <details className="mt-4">
                          <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground">
                            Visa detaljerad data
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-muted-foreground overflow-x-auto">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(hypothesis.data, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-2">
                    Genererar statistiskt signifikanta hypoteser baserat på din data...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Behöver minst 10 kodgenereringssessioner för att generera hypoteser
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

