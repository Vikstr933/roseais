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
import { sql, eq, desc, and, gte, count } from 'drizzle-orm';
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
    // Filter to only show agents with names (exclude unknown agents)
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
      .innerJoin(agents, eq(codeGenerationSessions.agentId, agents.id.toString()))
      .where(eq(codeGenerationSessions.userId, userId))
      .groupBy(codeGenerationSessions.agentId, agents.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

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
      agentSuccessVsCodeLength: agentPerformance.map(a => ({
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
    const bestAgent = agentPerformance.reduce((max, a) => {
      const maxRate = Number(max.successRate) || 0;
      const aRate = Number(a.successRate) || 0;
      return aRate > maxRate ? a : max;
    }, agentPerformance[0] || { agentName: null, agentId: null, successRate: 0 });
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
        agentPerformance,
        codePatterns,
        projectActivity,
        collaborationStats: collaborationStats[0] || {},
        chainAnalysis,
        correlations,
        insights,
        summary: {
          totalSessions: agentPerformance.reduce((sum, a) => sum + (a.totalSessions || 0), 0),
          uniqueAgents: agentPerformance.length,
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

/**
 * GET /api/data-insights/hypotheses
 * Returns interesting hypotheses based on data patterns
 */
router.get('/hypotheses', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Analyze patterns and generate hypotheses
    const sessions = await db
      .select()
      .from(codeGenerationSessions)
      .where(eq(codeGenerationSessions.userId, userId))
      .limit(100);

    const hypotheses = [];

    // Hypothesis 1: Longer prompts generate longer code
    const promptLengths = sessions.map(s => ({
      promptLength: s.inputPrompt?.length || 0,
      codeLength: s.generatedCode?.length || 0,
    }));
    
    if (promptLengths.length > 0) {
      const avgPromptLength = promptLengths.reduce((sum, p) => sum + p.promptLength, 0) / promptLengths.length;
      const avgCodeLength = promptLengths.reduce((sum, p) => sum + p.codeLength, 0) / promptLengths.length;
      
      hypotheses.push({
        id: 'prompt-code-correlation',
        title: 'Samband mellan prompt-längd och kod-längd',
        description: `Genomsnittlig prompt-längd: ${Math.round(avgPromptLength)} tecken. Genomsnittlig kod-längd: ${Math.round(avgCodeLength)} tecken.`,
        hypothesis: 'Längre prompts tenderar att generera längre kod',
        confidence: 'medium',
        data: {
          avgPromptLength: Math.round(avgPromptLength),
          avgCodeLength: Math.round(avgCodeLength),
          sampleSize: promptLengths.length,
        },
      });
    }

    // Hypothesis 2: Certain agents are better for specific tasks
    const agentTasks = await db
      .select({
        agentId: codeGenerationSessions.agentId,
        agentName: agents.name,
        status: codeGenerationSessions.status,
        codeLength: sql<number>`LENGTH(${codeGenerationSessions.generatedCode})`,
      })
      .from(codeGenerationSessions)
      .leftJoin(agents, eq(codeGenerationSessions.agentId, agents.id.toString()))
      .where(eq(codeGenerationSessions.userId, userId))
      .limit(50);

    if (agentTasks.length > 0) {
      const agentGroups = agentTasks.reduce((acc, task) => {
        const key = task.agentName || 'Unknown';
        if (!acc[key]) {
          acc[key] = { success: 0, total: 0, avgLength: [] };
        }
        acc[key].total++;
        if (task.status === 'completed') acc[key].success++;
        acc[key].avgLength.push(task.codeLength || 0);
        return acc;
      }, {} as Record<string, { success: number; total: number; avgLength: number[] }>);

      const bestAgentEntry = Object.entries(agentGroups).reduce((max, [name, stats]) => {
        const successRate = (stats.success / stats.total) * 100;
        const maxSuccessRate = (max.stats.success / max.stats.total) * 100;
        return successRate > maxSuccessRate ? { name, stats } : max;
      }, { name: '', stats: { success: 0, total: 1, avgLength: [] as number[] } });
      
      const bestAgent = {
        name: bestAgentEntry.name,
        stats: bestAgentEntry.stats,
      };

      if (bestAgent.name) {
        hypotheses.push({
          id: 'agent-specialization',
          title: 'Agent-specialisering',
          description: `${bestAgent.name} har högst framgångsfrekvens`,
          hypothesis: 'Olika agenter är bättre på olika typer av uppgifter',
          confidence: 'high',
          data: bestAgent.stats,
        });
      }
    }

    res.json({
      success: true,
      hypotheses,
    });
  } catch (error: any) {
    console.error('Error generating hypotheses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate hypotheses',
      message: error.message,
    });
  }
});

export default router;

