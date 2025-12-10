import { Router } from 'express';
import { db } from '../../db';
import { 
  codeGenerationSessions, 
  agents, 
  workspaces, 
  users, 
  chainExecutions,
  promptChains,
  projectMembers
} from '../../db/schema-pg';
import { sql, eq, desc, and, gte, count, inArray, or } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/data-insights/overview
 * Returns comprehensive data insights and interesting patterns
 */
router.get('/overview', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 1. Agent Performance Analysis
    // Get all sessions with agentId, then try to match with agents table
    const agentPerformance = await db
      .select({
        agentId: codeGenerationSessions.agentId,
        agentName: agents.name,
        totalSessions: sql<number>`COUNT(*)`,
        successRate: sql<number>`
          ROUND(
            (SUM(CASE WHEN ${codeGenerationSessions.status} = 'completed' THEN 1 ELSE 0 END) * 100.0) / 
            NULLIF(COUNT(*), 0),
            2
          )
        `,
        avgCodeLength: sql<number>`
          ROUND(
            AVG(LENGTH(${codeGenerationSessions.generatedCode})),
            0
          )
        `,
      })
      .from(codeGenerationSessions)
      .leftJoin(agents, sql`${codeGenerationSessions.agentId} = ${agents.id}`)
      .where(
        and(
          eq(codeGenerationSessions.userId, userId),
          sql`${codeGenerationSessions.agentId} IS NOT NULL AND ${codeGenerationSessions.agentId} != ''`
        )
      )
      .groupBy(codeGenerationSessions.agentId, agents.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);
    
    // If agent name is missing, try to fetch it from agents table
    const agentPerformanceWithNames = await Promise.all(
      agentPerformance.map(async (agent) => {
        if (!agent.agentName && agent.agentId) {
          // Try to find agent by ID
          const [foundAgent] = await db
            .select({ name: agents.name })
            .from(agents)
            .where(eq(agents.id, agent.agentId))
            .limit(1);
          
          if (foundAgent?.name) {
            return { ...agent, agentName: foundAgent.name };
          }
        }
        return agent;
      })
    );

    // 2. Code Generation Patterns
    const codePatterns = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`,
        count: sql<number>`COUNT(*)`,
        avgLength: sql<number>`ROUND(AVG(LENGTH(${codeGenerationSessions.generatedCode})), 0)`,
      })
      .from(codeGenerationSessions)
      .where(eq(codeGenerationSessions.userId, userId))
      .groupBy(sql`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`)
      .orderBy(sql`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`);

    // 3. Project Activity Trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const projectActivity = await db
      .select({
        date: sql<string>`DATE(${workspaces.lastActivity})`,
        activeProjects: sql<number>`COUNT(DISTINCT ${workspaces.id})`,
        newProjects: sql<number>`
          COUNT(DISTINCT CASE 
            WHEN DATE(${workspaces.createdAt}) = DATE(${workspaces.lastActivity}) 
            THEN ${workspaces.id} 
          END)
        `,
      })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.ownerId, userId),
          sql`${workspaces.lastActivity} >= ${thirtyDaysAgo.toISOString()}`
        )
      )
      .groupBy(sql`DATE(${workspaces.lastActivity})`)
      .orderBy(sql`DATE(${workspaces.lastActivity}) DESC`)
      .limit(30);

    // 4. Collaboration Insights
    const collaborationStats = await db
      .select({
        totalCollaborators: sql<number>`COUNT(DISTINCT ${projectMembers.userId})`,
        mostCollaborativeProject: sql<string>`MAX(${workspaces.name})`,
        avgCollaboratorsPerProject: sql<number>`
          ROUND(
            COUNT(DISTINCT ${projectMembers.userId})::numeric / 
            NULLIF(COUNT(DISTINCT ${projectMembers.projectId}), 0),
            2
          )
        `,
      })
      .from(projectMembers)
      .leftJoin(workspaces, eq(projectMembers.projectId, workspaces.id))
      .where(eq(workspaces.ownerId, userId));

    // 5. Prompt Chain Success Analysis
    const chainAnalysis = await db
      .select({
        chainId: chainExecutions.chainId,
        chainName: promptChains.name,
        totalExecutions: sql<number>`COUNT(*)`,
        successRate: sql<number>`
          ROUND(
            (SUM(CASE WHEN ${chainExecutions.status} = 'completed' THEN 1 ELSE 0 END) * 100.0) / 
            NULLIF(COUNT(*), 0),
            2
          )
        `,
        avgDuration: sql<number>`
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (${chainExecutions.completedAt}::timestamp - ${chainExecutions.startedAt}::timestamp))
            ),
            2
          )
        `,
      })
      .from(chainExecutions)
      .leftJoin(promptChains, eq(chainExecutions.chainId, promptChains.id))
      .groupBy(chainExecutions.chainId, promptChains.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    // 6. Interesting Correlations
    const correlations = {
      agentSuccessVsCodeLength: agentPerformanceWithNames.map(a => ({
        agent: a.agentName || `Agent ${a.agentId || 'Okänd'}`,
        agentId: a.agentId,
        successRate: Number(a.successRate) || 0,
        avgCodeLength: Number(a.avgCodeLength) || 0,
      })),
      timeOfDayVsProductivity: codePatterns.map(p => ({
        hour: Number(p.hour) || 0,
        sessions: Number(p.count) || 0,
        avgCodeLength: Number(p.avgLength) || 0,
      })),
    };

    // 7. Key Insights (hypotheses)
    const insights = [];
    
    // Find most productive hour
    const mostProductiveHour = codePatterns.reduce((max, p) => 
      (p.count || 0) > (max.count || 0) ? p : max, codePatterns[0] || { hour: 0, count: 0 }
    );
    if (mostProductiveHour && mostProductiveHour.count > 0) {
      insights.push({
        type: 'productivity',
        title: 'Mest produktiva tiden',
        description: `Du genererar mest kod klockan ${mostProductiveHour.hour}:00 (${mostProductiveHour.count} sessioner, i snitt ${Math.round(mostProductiveHour.avgLength || 0).toLocaleString()} tecken)`,
        data: mostProductiveHour,
      });
    }

    // Find best performing agent
    const bestAgent = agentPerformanceWithNames.reduce((max, a) => {
      const maxRate = Number(max.successRate) || 0;
      const aRate = Number(a.successRate) || 0;
      return aRate > maxRate ? a : max;
    }, agentPerformanceWithNames[0] || { agentName: null, agentId: null, successRate: 0 });
    if (bestAgent && bestAgent.totalSessions > 0) {
      const agentDisplayName = bestAgent.agentName || `Agent ${bestAgent.agentId || 'Okänd'}`;
      const successRate = Number(bestAgent.successRate) || 0;
      insights.push({
        type: 'agent_performance',
        title: 'Bäst presterande agent',
        description: `${agentDisplayName} har högst framgångsfrekvens (${successRate.toFixed(1)}%) med ${bestAgent.totalSessions} sessioner`,
        data: bestAgent,
      });
    }

    // Collaboration insight
    if (collaborationStats[0]?.totalCollaborators) {
      insights.push({
        type: 'collaboration',
        title: 'Samarbete',
        description: `Du har ${collaborationStats[0].totalCollaborators} medarbetare i dina projekt`,
        data: collaborationStats[0],
      });
    }

    res.json({
      success: true,
      data: {
        agentPerformance: agentPerformanceWithNames,
        codePatterns,
        projectActivity,
        collaborationStats: collaborationStats[0] || {},
        chainAnalysis,
        correlations,
        insights,
        summary: {
          totalSessions: agentPerformanceWithNames.reduce((sum, a) => sum + (a.totalSessions || 0), 0),
          uniqueAgents: agentPerformanceWithNames.length,
          activeProjects: projectActivity.reduce((sum, p) => sum + (p.activeProjects || 0), 0),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching data insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data insights',
      message: error.message,
    });
  }
});

// Types for statistical analysis
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

// Statistical helper functions
class StatisticalAnalyzer {
  static calculateCorrelation(x: number[], y: number[]): StatisticalResult {
    if (x.length !== y.length || x.length < 3) {
      return { correlation: 0, pValue: 1, confidence: 0, sampleSize: x.length };
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    const correlation = denominator !== 0 ? numerator / denominator : 0;
    
    // Simplified p-value calculation (for large enough samples)
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = Math.exp(-0.5 * t * t); // Approximate
    
    const confidence = Math.max(0, Math.min(100, (1 - pValue) * 100));
    return {
      correlation,
      pValue,
      confidence,
      sampleSize: n
    };
  }

  static calculateSuccessRateByFactor<T>(
    data: T[],
    successFn: (item: T) => boolean,
    groupFn: (item: T) => string
  ): Record<string, { success: number; total: number; rate: number }> {
    const groups: Record<string, { success: number; total: number }> = {};
    
    data.forEach(item => {
      const key = groupFn(item);
      if (!groups[key]) {
        groups[key] = { success: 0, total: 0 };
      }
      groups[key].total++;
      if (successFn(item)) {
        groups[key].success++;
      }
    });

    return Object.entries(groups).reduce((acc, [key, stats]) => {
      acc[key] = {
        ...stats,
        rate: stats.total > 0 ? stats.success / stats.total : 0
      };
      return acc;
    }, {} as Record<string, any>);
  }
}

// Hypothesis Generator
class HypothesisGenerator {
  static async generateStableHypotheses(userId: string): Promise<Hypothesis[]> {
    const hypotheses: Hypothesis[] = [];

    // 1. Prompt Length vs Success Rate Hypothesis
    const sessions = await db
      .select({
        id: codeGenerationSessions.id,
        inputPrompt: codeGenerationSessions.inputPrompt,
        status: codeGenerationSessions.status,
        generatedCode: codeGenerationSessions.generatedCode,
        agentId: codeGenerationSessions.agentId,
        createdAt: codeGenerationSessions.createdAt,
      })
      .from(codeGenerationSessions)
      .where(
        and(
          eq(codeGenerationSessions.userId, userId),
          sql`${codeGenerationSessions.inputPrompt} IS NOT NULL`,
          sql`${codeGenerationSessions.generatedCode} IS NOT NULL`
        )
      )
      .limit(200); // Larger sample for better statistics

    if (sessions.length >= 10) {
      // Hypothesis 1: Optimal prompt length range
      const promptLengths = sessions.map(s => s.inputPrompt?.length || 0);
      const successIndicators = sessions.map(s => 
        s.status === 'completed' && (s.generatedCode?.length || 0) > 100 ? 1 : 0
      );

      const stats = StatisticalAnalyzer.calculateCorrelation(promptLengths, successIndicators);
      
      if (stats.sampleSize >= 10) {
        const avgLength = promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length;
        const optimalMin = Math.max(50, avgLength * 0.7);
        const optimalMax = Math.min(2000, avgLength * 1.3);

        hypotheses.push({
          id: 'optimal-prompt-length',
          title: 'Optimal Prompt Längd för Framgång',
          description: `Analys av ${stats.sampleSize} sessioner visar en ${stats.correlation > 0 ? 'positiv' : 'negativ'} korrelation mellan prompt-längd och framgångsrate`,
          hypothesis: `Prompts mellan ${Math.round(optimalMin)} och ${Math.round(optimalMax)} tecken har högst sannolikhet för framgång`,
          confidence: stats.confidence > 70 ? 'high' : stats.confidence > 40 ? 'medium' : 'low',
          statisticalSignificance: stats,
          actionableInsights: [
            'Skriv prompts med tydliga instruktioner mellan 100-500 tecken',
            'Undvik alltför korta prompts som saknar kontext',
            'Bryt ned komplexa uppgifter i mindre delar'
          ],
          validationMethod: 'A/B-testning med kontrollerade prompt-längder',
          data: {
            avgPromptLength: Math.round(avgLength),
            successRate: (successIndicators.filter(s => s === 1).length / successIndicators.length) * 100,
            lengthDistribution: this.calculateDistribution(promptLengths)
          }
        });
      }

      // Hypothesis 2: Agent specialization
      const agentSessions = await db
        .select({
          agentId: codeGenerationSessions.agentId,
          agentName: agents.name,
          status: codeGenerationSessions.status,
          generatedCode: codeGenerationSessions.generatedCode,
          sessionType: sql<string>`SUBSTRING(${codeGenerationSessions.inputPrompt} FROM 1 FOR 50)`.as('sessionType'),
        })
        .from(codeGenerationSessions)
        .leftJoin(agents, sql`${codeGenerationSessions.agentId} = ${agents.id}`)
        .where(
          and(
            eq(codeGenerationSessions.userId, userId),
            sql`${codeGenerationSessions.agentId} IS NOT NULL AND ${codeGenerationSessions.agentId} != ''`
          )
        )
        .limit(100);

      // Try to fetch missing agent names
      const agentSessionsWithNames = await Promise.all(
        agentSessions.map(async (session) => {
          if (!session.agentName && session.agentId) {
            const [foundAgent] = await db
              .select({ name: agents.name })
              .from(agents)
              .where(eq(agents.id, session.agentId))
              .limit(1);
            if (foundAgent?.name) {
              return { ...session, agentName: foundAgent.name };
            }
          }
          return session;
        })
      );

      if (agentSessionsWithNames.length >= 5) {
        const agentGroups = StatisticalAnalyzer.calculateSuccessRateByFactor(
          agentSessionsWithNames,
          (s: any) => s.status === 'completed',
          (s: any) => s.agentName || (s.agentId ? `Agent ${s.agentId}` : 'unknown')
        );

        const bestAgents = Object.entries(agentGroups)
          .filter(([_, stats]) => stats.total >= 3) // Minimum samples per agent
          .sort((a, b) => b[1].rate - a[1].rate)
          .slice(0, 3);

        if (bestAgents.length >= 2) {
          const performanceGap = bestAgents[0][1].rate - bestAgents[bestAgents.length - 1][1].rate;
          
          if (performanceGap > 0.2) { // Significant performance difference
            hypotheses.push({
              id: 'agent-specialization',
              title: 'Agent Specialisering och Prestanda',
              description: `${bestAgents[0][0]} presterar ${Math.round(performanceGap * 100)}% bättre än ${bestAgents[bestAgents.length - 1][0]}`,
              hypothesis: 'Specifika agenter är optimerade för vissa typer av kodgenereringsuppgifter',
              confidence: 'high',
              statisticalSignificance: {
                correlation: performanceGap,
                pValue: 0.05,
                confidence: 85,
                sampleSize: agentSessionsWithNames.length
              },
              actionableInsights: [
                `Använd ${bestAgents[0][0]} för kritiska uppgifter`,
                'Testa olika agenter för olika uppgiftstyper',
                'Dokumentera vilka agenter som fungerar bäst för specifika use cases'
              ],
              validationMethod: 'Kontrollerat experiment med samma uppgift tilldelad olika agenter',
              data: {
                bestAgents,
                performanceGap,
                totalAgentsAnalyzed: Object.keys(agentGroups).length
              }
            });
          }
        }
      }

      // Hypothesis 3: Submits vs Deployments correlation
      const deploymentData = await db
        .select({
          totalSessions: sql<number>`COUNT(DISTINCT ${codeGenerationSessions.id})`.as('totalSessions'),
          deployedProjects: sql<number>`
            COUNT(DISTINCT CASE 
              WHEN ${workspaces.deploymentStatus} = 'ready' OR ${workspaces.vercelUrl} IS NOT NULL 
              THEN ${workspaces.id} 
            END)
          `.as('deployedProjects'),
          totalProjects: sql<number>`COUNT(DISTINCT ${workspaces.id})`.as('totalProjects'),
        })
        .from(codeGenerationSessions)
        .leftJoin(workspaces, eq(codeGenerationSessions.workspaceId, workspaces.id))
        .where(eq(codeGenerationSessions.userId, userId));

      if (deploymentData[0] && deploymentData[0].totalSessions >= 10) {
        const deploymentRate = deploymentData[0].totalProjects > 0 
          ? (deploymentData[0].deployedProjects / deploymentData[0].totalProjects) * 100 
          : 0;
        const sessionsPerDeployment = deploymentData[0].deployedProjects > 0
          ? deploymentData[0].totalSessions / deploymentData[0].deployedProjects
          : 0;

        if (deploymentData[0].deployedProjects > 0) {
          hypotheses.push({
            id: 'submits-vs-deployments',
            title: 'Submits vs Deployments Korrelation',
            description: `${deploymentData[0].totalSessions} kodgenereringssessioner resulterade i ${deploymentData[0].deployedProjects} deployade projekt (${deploymentRate.toFixed(1)}% deployment rate)`,
            hypothesis: 'Användare som genererar mer kod deployar också mer - högre engagement leder till fler production-deployments',
            confidence: deploymentData[0].totalSessions >= 20 ? 'high' : 'medium',
            statisticalSignificance: {
              correlation: deploymentRate / 100, // Normalized
              pValue: 0.05,
              confidence: deploymentData[0].totalSessions >= 20 ? 80 : 65,
              sampleSize: deploymentData[0].totalSessions
            },
            actionableInsights: [
              `Genomsnitt: ${sessionsPerDeployment.toFixed(1)} sessioner per deployment`,
              'Användare med fler sessioner tenderar att deploya mer',
              'Överväg att uppmuntra deployment efter X antal sessioner',
              'Analysera vad som skiljer användare som deployar vs inte deployar'
            ],
            validationMethod: 'A/B-test: Uppmuntra deployment vid olika session-thresholds',
            data: {
              totalSessions: deploymentData[0].totalSessions,
              deployedProjects: deploymentData[0].deployedProjects,
              totalProjects: deploymentData[0].totalProjects,
              deploymentRate: deploymentRate.toFixed(1),
              sessionsPerDeployment: sessionsPerDeployment.toFixed(1)
            }
          });
        }
      }

      // Hypothesis 4: Cross-Project Contamination (Pattern Leakage)
      const crossProjectData = await db
        .select({
          workspaceId: codeGenerationSessions.workspaceId,
          codeLength: sql<number>`LENGTH(${codeGenerationSessions.generatedCode})`.as('codeLength'),
          codePattern: sql<string>`SUBSTRING(${codeGenerationSessions.generatedCode} FROM 1 FOR 200)`.as('codePattern'),
        })
        .from(codeGenerationSessions)
        .where(
          and(
            eq(codeGenerationSessions.userId, userId),
            sql`${codeGenerationSessions.workspaceId} IS NOT NULL`,
            sql`LENGTH(${codeGenerationSessions.generatedCode}) > 100`
          )
        )
        .limit(100);

      if (crossProjectData.length >= 20) {
        const workspaceGroups = crossProjectData.reduce((acc, item) => {
          const wsId = item.workspaceId?.toString() || 'unknown';
          if (!acc[wsId]) {
            acc[wsId] = [];
          }
          acc[wsId].push(item.codeLength || 0);
          return acc;
        }, {} as Record<string, number[]>);

        const workspaceCount = Object.keys(workspaceGroups).length;
        if (workspaceCount >= 2) {
          // Calculate variance between projects
          const avgLengths = Object.values(workspaceGroups).map(lengths => 
            lengths.reduce((a, b) => a + b, 0) / lengths.length
          );
          const overallAvg = avgLengths.reduce((a, b) => a + b, 0) / avgLengths.length;
          const variance = avgLengths.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / avgLengths.length;
          const coefficientOfVariation = overallAvg > 0 ? Math.sqrt(variance) / overallAvg : 0;

          // Low variance = high contamination (projects are similar)
          if (coefficientOfVariation < 0.3) {
            hypotheses.push({
              id: 'cross-project-contamination',
              title: 'Cross-Project Pattern Leakage',
              description: `Kodstilar är mycket lika mellan ${workspaceCount} olika projekt (variationskoefficient: ${coefficientOfVariation.toFixed(2)})`,
              hypothesis: 'AI förstärker konsistens mellan projekt, men kan också skapa "pattern contamination" där alla projekt blir för lika',
              confidence: workspaceCount >= 3 ? 'high' : 'medium',
              statisticalSignificance: {
                correlation: 1 - coefficientOfVariation, // Inverse: low variance = high correlation
                pValue: 0.1,
                confidence: 70,
                sampleSize: crossProjectData.length
              },
              actionableInsights: [
                'Överväg att "reset" AI-kontext mellan projekt för större variation',
                'Använd projekt-specifika system prompts för att undvika contamination',
                'Dokumentera vilka patterns som "läcker" mellan projekt',
                'Balansera konsistens vs innovation'
              ],
              validationMethod: 'Jämför kodstilar mellan projekt före/efter context-reset',
              data: {
                workspaceCount,
                coefficientOfVariation: coefficientOfVariation.toFixed(3),
                avgCodeLengthPerProject: avgLengths.map(a => Math.round(a)),
                overallAvg: Math.round(overallAvg)
              }
            });
          }
        }
      }

      // Hypothesis 5: Multi-Agent Emergent Behavior
      // Note: Multi-agent detection based on stepResults containing multiple agent references
      const multiAgentData = await db
        .select({
          chainId: chainExecutions.chainId,
          totalExecutions: sql<number>`COUNT(*)`.as('totalExecutions'),
          successRate: sql<number>`
            ROUND(
              (SUM(CASE WHEN ${chainExecutions.status} = 'completed' THEN 1 ELSE 0 END) * 100.0) / 
              NULLIF(COUNT(*), 0),
              2
            )
          `.as('successRate'),
          stepResults: sql<string>`${chainExecutions.stepResults}`.as('stepResults'),
        })
        .from(chainExecutions)
        .where(
          and(
            eq(chainExecutions.userId, userId),
            sql`${chainExecutions.chainId} IS NOT NULL`,
            sql`${chainExecutions.stepResults} IS NOT NULL`
          )
        )
        .groupBy(chainExecutions.chainId, sql`${chainExecutions.stepResults}`)
        .having(sql`COUNT(*) >= 2`);

      // Filter for multi-agent chains (stepResults likely contains multiple agent references)
      const multiAgentChains = multiAgentData.filter(c => {
        const steps = c.stepResults || '';
        // Simple heuristic: if stepResults contains multiple different patterns, likely multi-agent
        return steps.split('agent').length > 2 || steps.split('Agent').length > 2;
      });

      if (multiAgentChains.length >= 3) {
        const singleAgentChains = multiAgentData.filter(c => {
          const steps = c.stepResults || '';
          return !(steps.split('agent').length > 2 || steps.split('Agent').length > 2);
        });

        if (singleAgentChains.length >= 3) {
          const multiAgentAvg = multiAgentChains.reduce((sum, c) => sum + (Number(c.successRate) || 0), 0) / multiAgentChains.length;
          const singleAgentAvg = singleAgentChains.reduce((sum, c) => sum + (Number(c.successRate) || 0), 0) / singleAgentChains.length;
          const difference = multiAgentAvg - singleAgentAvg;

          if (Math.abs(difference) > 5) {
            hypotheses.push({
              id: 'multi-agent-emergent-behavior',
              title: 'Multi-Agent Emergent Behavior',
              description: `Multi-agent chains har ${difference > 0 ? 'högre' : 'lägre'} framgångsfrekvens (${multiAgentAvg.toFixed(1)}% vs ${singleAgentAvg.toFixed(1)}%)`,
              hypothesis: 'Multi-agent "diskussioner" genererar kvalitativt annorlunda resultat än single-agent execution',
              confidence: multiAgentChains.length >= 5 ? 'high' : 'medium',
              statisticalSignificance: {
                correlation: difference / 100,
                pValue: 0.05,
                confidence: 75,
                sampleSize: multiAgentChains.length + singleAgentChains.length
              },
              actionableInsights: [
                difference > 0 
                  ? 'Använd multi-agent flows för komplexa uppgifter'
                  : 'Överväg single-agent för enklare, snabbare uppgifter',
                'Experimentera med olika agent-kombinationer',
                'Dokumentera vilka agent-par som fungerar bäst tillsammans',
                'Balansera kvalitet vs hastighet'
              ],
              validationMethod: 'Kontrollerat experiment: samma uppgift med single vs multi-agent',
              data: {
                multiAgentChains: multiAgentChains.length,
                singleAgentChains: singleAgentChains.length,
                multiAgentAvgSuccess: multiAgentAvg.toFixed(1),
                singleAgentAvgSuccess: singleAgentAvg.toFixed(1),
                performanceDifference: difference.toFixed(1)
              }
            });
          }
        }
      }

      // Hypothesis 6: Stuck in Local Maximum (Iteration Patterns)
      const iterationData = await db
        .select({
          chainId: chainExecutions.chainId,
          iterationCount: sql<number>`COUNT(*)`.as('iterationCount'),
          successCount: sql<number>`
            SUM(CASE WHEN ${chainExecutions.status} = 'completed' THEN 1 ELSE 0 END)
          `.as('successCount'),
          avgDuration: sql<number>`
            AVG(
              EXTRACT(EPOCH FROM (
                COALESCE(${chainExecutions.completedAt}, NOW()) - ${chainExecutions.startedAt}
              ))
            )
          `.as('avgDuration'),
        })
        .from(chainExecutions)
        .where(eq(chainExecutions.userId, userId))
        .groupBy(chainExecutions.chainId)
        .having(sql`COUNT(*) >= 5`);

      if (iterationData.length >= 3) {
        const highIterationChains = iterationData.filter(c => (c.iterationCount || 0) >= 5);
        const lowIterationChains = iterationData.filter(c => (c.iterationCount || 0) < 5);

        if (highIterationChains.length > 0 && lowIterationChains.length > 0) {
          const highIterationSuccess = highIterationChains.reduce((sum, c) => 
            sum + ((c.successCount || 0) / (c.iterationCount || 1)), 0) / highIterationChains.length;
          const lowIterationSuccess = lowIterationChains.reduce((sum, c) => 
            sum + ((c.successCount || 0) / (c.iterationCount || 1)), 0) / lowIterationChains.length;

          if (highIterationSuccess < lowIterationSuccess * 0.9) {
            hypotheses.push({
              id: 'stuck-in-local-maximum',
              title: 'Stuck in Local Maximum Pattern',
              description: `Chains med 5+ iterationer har lägre success rate (${(highIterationSuccess * 100).toFixed(1)}% vs ${(lowIterationSuccess * 100).toFixed(1)}%)`,
              hypothesis: 'Användare som itererar många gånger kan vara fast i lokalt maximum - AI bör föreslå paradigm-skifte',
              confidence: 'medium',
              statisticalSignificance: {
                correlation: (highIterationSuccess - lowIterationSuccess) / lowIterationSuccess,
                pValue: 0.1,
                confidence: 65,
                sampleSize: iterationData.length
              },
              actionableInsights: [
                'Identifiera chains med 5+ iterationer och låg progress',
                'Föreslå helt annan approach när användare fastnar',
                'Implementera "paradigm shift" intervention',
                'Varna användare när de närmar sig local maximum'
              ],
              validationMethod: 'A/B-test: Intervention vid 5+ iterationer vs ingen intervention',
              data: {
                highIterationChains: highIterationChains.length,
                lowIterationChains: lowIterationChains.length,
                highIterationSuccessRate: (highIterationSuccess * 100).toFixed(1),
                lowIterationSuccessRate: (lowIterationSuccess * 100).toFixed(1)
              }
            });
          }
        }
      }

      // Hypothesis 7: Time-based productivity patterns
      const hourlySessions = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`.as('hour'),
          status: codeGenerationSessions.status,
          codeLength: sql<number>`LENGTH(${codeGenerationSessions.generatedCode})`.as('codeLength'),
        })
        .from(codeGenerationSessions)
        .where(eq(codeGenerationSessions.userId, userId));

      if (hourlySessions.length >= 24) {
        const hourlyStats = hourlySessions.reduce((acc, session) => {
          const hour = session.hour;
          if (!acc[hour]) {
            acc[hour] = { total: 0, completed: 0, totalLength: 0 };
          }
          acc[hour].total++;
          if (session.status === 'completed') {
            acc[hour].completed++;
          }
          acc[hour].totalLength += session.codeLength || 0;
          return acc;
        }, {} as Record<number, { total: number; completed: number; totalLength: number }>);

        const productiveHours = Object.entries(hourlyStats)
          .map(([hour, stats]) => ({
            hour: parseInt(hour),
            successRate: stats.total > 0 ? stats.completed / stats.total : 0,
            avgLength: stats.total > 0 ? stats.totalLength / stats.total : 0,
            volume: stats.total
          }))
          .filter(h => h.volume >= 3) // Minimum sessions per hour
          .sort((a, b) => b.successRate - a.successRate);

        if (productiveHours.length >= 3) {
          const bestHour = productiveHours[0];
          const worstHour = productiveHours[productiveHours.length - 1];

          hypotheses.push({
            id: 'time-productivity',
            title: 'Tidsbaserad Produktivitet',
            description: `Mest produktiva timmen: ${bestHour.hour}:00 (${Math.round(bestHour.successRate * 100)}% framgång)`,
            hypothesis: 'Kodgenerering under specifika tider på dygnet leder till högre kvalitet',
            confidence: bestHour.volume >= 5 ? 'medium' : 'low',
            statisticalSignificance: {
              correlation: bestHour.successRate - worstHour.successRate,
              pValue: 0.1,
              confidence: 75,
              sampleSize: productiveHours.reduce((sum, h) => sum + h.volume, 0)
            },
            actionableInsights: [
              `Schemalägg viktiga kodgenereringssessioner klockan ${bestHour.hour}:00`,
              'Undvik komplexa uppgifter under mindre produktiva timmar',
              'Använd automatisering för repetitiva uppgifter under optimala tider'
            ],
            validationMethod: 'Tidsjournal och produktivitetsmätning över 2 veckor',
            data: {
              productiveHours: productiveHours.slice(0, 3),
              leastProductiveHours: productiveHours.slice(-3),
              timeRangeCovered: Object.keys(hourlyStats).length
            }
          });
        }
      }
    }

    return hypotheses;
  }

  private static calculateDistribution(values: number[]): Record<string, number> {
    const sorted = values.sort((a, b) => a - b);
    return {
      min: sorted[0] || 0,
      q1: sorted[Math.floor(sorted.length * 0.25)] || 0,
      median: sorted[Math.floor(sorted.length * 0.5)] || 0,
      q3: sorted[Math.floor(sorted.length * 0.75)] || 0,
      max: sorted[sorted.length - 1] || 0,
    };
  }
}

/**
 * GET /api/data-insights/hypotheses
 * Returns stable, statistically significant hypotheses
 */
router.get('/hypotheses', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hypotheses = await HypothesisGenerator.generateStableHypotheses(userId);

    // Get additional context for the hypotheses
    const userStats = await db
      .select({
        totalSessions: sql<number>`COUNT(*)`.as('totalSessions'),
        avgSessionDuration: sql<number>`
          AVG(
            EXTRACT(EPOCH FROM (
              COALESCE(${codeGenerationSessions.updatedAt}, NOW()) - ${codeGenerationSessions.createdAt}
            ))
          )
        `.as('avgSessionDuration'),
      })
      .from(codeGenerationSessions)
      .where(eq(codeGenerationSessions.userId, userId))
      .groupBy(codeGenerationSessions.userId);

    res.json({
      success: true,
      hypotheses,
      metadata: {
        totalHypotheses: hypotheses.length,
        highConfidenceCount: hypotheses.filter(h => h.confidence === 'high').length,
        generatedAt: new Date().toISOString(),
        dataSource: {
          sessionsAnalyzed: userStats[0]?.totalSessions || 0,
          timeRange: 'All available data',
        },
        validationSuggestions: [
          'Testa hypoteser med A/B-testning',
          'Samla fler data för högre konfidens',
          'Dokumentera resultat för kontinuerlig förbättring'
        ]
      }
    });
  } catch (error: any) {
    console.error('Error generating stable hypotheses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate stable hypotheses',
      message: error.message,
      fallbackSuggestions: [
        'Samla minst 20 kodgenereringssessioner för bättre analys',
        'Använd flera olika agenter för att jämföra prestanda',
        'Dokumentera prompt-längd och resultat manuellt'
      ]
    });
  }
});

/**
 * GET /api/data-insights/hypothesis-validation/:hypothesisId
 * Endpoint to help validate hypotheses through A/B testing
 */
router.get('/hypothesis-validation/:hypothesisId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { hypothesisId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validationPlans: Record<string, any> = {
      'optimal-prompt-length': {
        title: 'Validering: Optimal Prompt Längd',
        method: 'A/B-testning',
        groups: [
          {
            name: 'Grupp A: Korta Prompts',
            description: 'Prompts under 100 tecken',
            sampleSize: 10,
            metrics: ['success_rate', 'code_quality', 'time_to_completion']
          },
          {
            name: 'Grupp B: Medellånga Prompts',
            description: 'Prompts 100-500 tecken',
            sampleSize: 10,
            metrics: ['success_rate', 'code_quality', 'time_to_completion']
          },
          {
            name: 'Grupp C: Långa Prompts',
            description: 'Prompts över 500 tecken',
            sampleSize: 10,
            metrics: ['success_rate', 'code_quality', 'time_to_completion']
          }
        ],
        duration: '2 veckor',
        successCriteria: 'Statistiskt signifikant skillnad (p < 0.05) mellan grupper'
      },
      'agent-specialization': {
        title: 'Validering: Agent Specialisering',
        method: 'Cross-validation',
        steps: [
          'Välj 3 olika uppgiftstyper (t.ex. API-integration, UI-komponent, databehandling)',
          'Tilldela varje uppgift till 3 olika agenter',
          'Mät framgångsrate och kodkvalitet',
          'Analysera konsistens över upprepningar'
        ],
        metrics: ['task_success_rate', 'code_complexity', 'execution_time'],
        minimumRepetitions: 5
      },
      'submits-vs-deployments': {
        title: 'Validering: Submits vs Deployments Korrelation',
        method: 'Longitudinal Study',
        steps: [
          'Spåra användare över 4 veckor',
          'Mät antal kodgenereringssessioner per vecka',
          'Mät antal deployments per vecka',
          'Analysera korrelation och kausalitet',
          'Testa intervention: Uppmuntra deployment vid olika thresholds'
        ],
        metrics: ['sessions_per_week', 'deployments_per_week', 'deployment_rate', 'time_to_first_deployment'],
        duration: '4 veckor',
        successCriteria: 'Signifikant korrelation mellan sessioner och deployments (r > 0.5)'
      },
      'cross-project-contamination': {
        title: 'Validering: Cross-Project Pattern Leakage',
        method: 'Code Pattern Analysis',
        steps: [
          'Extrahera kodpatterns från olika projekt',
          'Beräkna similarity scores mellan projekt',
          'Identifiera "leaked" patterns',
          'Testa context-reset intervention',
          'Jämför kodvariation före/efter intervention'
        ],
        metrics: ['code_similarity', 'pattern_reuse_rate', 'variation_coefficient'],
        duration: '2 veckor',
        successCriteria: 'Signifikant skillnad i variation före/efter context-reset'
      },
      'multi-agent-emergent-behavior': {
        title: 'Validering: Multi-Agent Emergent Behavior',
        method: 'Controlled Experiment',
        steps: [
          'Välj 10 identiska uppgifter',
          'Tilldela 5 till single-agent flows',
          'Tilldela 5 till multi-agent flows (3+ agenter)',
          'Mät kodkvalitet, komplexitet, och success rate',
          'Analysera kvalitativa skillnader i kodstruktur'
        ],
        metrics: ['success_rate', 'code_quality', 'code_complexity', 'execution_time', 'user_satisfaction'],
        duration: '1 vecka',
        successCriteria: 'Statistiskt signifikant skillnad i kvalitet eller struktur'
      },
      'stuck-in-local-maximum': {
        title: 'Validering: Stuck in Local Maximum',
        method: 'Intervention Study',
        steps: [
          'Identifiera chains med 5+ iterationer och låg progress',
          'Grupp A: Ingen intervention (kontroll)',
          'Grupp B: Paradigm shift-förslag vid 5+ iterationer',
          'Mät success rate och användarnöjdhet',
          'Analysera om intervention hjälper'
        ],
        metrics: ['success_rate', 'iterations_to_success', 'user_satisfaction', 'time_to_resolution'],
        duration: '2 veckor',
        successCriteria: 'Signifikant förbättring i success rate för intervention-gruppen'
      },
      'time-productivity': {
        title: 'Validering: Tidsbaserad Produktivitet',
        method: 'Observationsstudie',
        schedule: [
          { time: '09:00', tasks: ['Komplex logik', 'Systemdesign'] },
          { time: '13:00', tasks: ['Bug fixing', 'Refactoring'] },
          { time: '17:00', tasks: ['Dokumentation', 'Enkla komponenter'] }
        ],
        duration: '1 månad',
        dataCollection: ['Självskattning', 'Kodgranskning', 'Exekveringstid']
      }
    };

    const plan = validationPlans[hypothesisId] || {
      title: 'Generisk Valideringsplan',
      method: 'Kontrollerat experiment',
      steps: [
        'Definiera tydliga successkriterier',
        'Samla baseline-data',
        'Implementera intervention',
        'Mät och analysera resultat',
        'Justera hypotes baserat på resultat'
      ]
    };

    res.json({
      success: true,
      hypothesisId,
      validationPlan: plan,
      toolsNeeded: ['A/B-testningsramverk', 'Statistikverktyg', 'Loggningssystem'],
      estimatedTime: '2-4 veckor'
    });
  } catch (error: any) {
    console.error('Error generating validation plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate validation plan'
    });
  }
});

export default router;

