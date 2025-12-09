import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { pluginKnowledge } from '../../db/schema-pg';
import { eq, and, desc } from 'drizzle-orm';

const logger = new SimpleLogger('MemoryService');

export interface MemoryFact {
  id: number;
  fact: string;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryService {
  /**
   * Remember a fact about the user
   */
  async rememberFact(
    userId: string,
    fact: string,
    category?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db.insert(pluginKnowledge).values({
        userId,
        pluginId: 'personal-assistant',
        externalId: `memory-${Date.now()}`,
        title: `User Fact: ${category || 'general'}`,
        content: fact,
        type: 'memory',
        metadata: { category: category || 'general' },
        timestamp: new Date(),
        syncedAt: new Date()
      });

      logger.info(`Remembered fact for user ${userId}: ${fact.substring(0, 50)}...`);

      return {
        success: true,
        message: 'Fact remembered successfully'
      };
    } catch (error) {
      logger.error('Error remembering fact', error as Error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Recall memories/facts about the user
   */
  async recallMemory(
    userId: string,
    query: string,
    category?: string
  ): Promise<MemoryFact[]> {
    try {
      const conditions = [
        eq(pluginKnowledge.userId, userId),
        eq(pluginKnowledge.type, 'memory')
      ];

      if (category) {
        // Search in metadata for category
        const memories = await db
          .select()
          .from(pluginKnowledge)
          .where(and(...conditions))
          .orderBy(desc(pluginKnowledge.syncedAt));

        // Filter by category and search query
        return memories
          .filter(m => {
            const metadata = typeof m.metadata === 'string' 
              ? JSON.parse(m.metadata) 
              : m.metadata;
            const matchesCategory = !category || metadata?.category === category;
            const matchesQuery = !query || 
              m.title?.toLowerCase().includes(query.toLowerCase()) ||
              (typeof m.content === 'string' && m.content.toLowerCase().includes(query.toLowerCase()));
            return matchesCategory && matchesQuery;
          })
          .map(m => ({
            id: m.id,
            fact: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            category: typeof m.metadata === 'string' 
              ? JSON.parse(m.metadata)?.category 
              : (m.metadata as any)?.category,
            userId: m.userId,
            createdAt: m.timestamp || new Date(),
            updatedAt: m.syncedAt || new Date()
          }));
      }

      // Search all memories
      const memories = await db
        .select()
        .from(pluginKnowledge)
        .where(and(...conditions))
        .orderBy(desc(pluginKnowledge.syncedAt))
        .limit(50);

      return memories
        .filter(m => {
          if (!query) return true;
          return m.title?.toLowerCase().includes(query.toLowerCase()) ||
            (typeof m.content === 'string' && m.content.toLowerCase().includes(query.toLowerCase()));
        })
        .map(m => ({
          id: m.id,
          fact: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          category: typeof m.metadata === 'string' 
            ? JSON.parse(m.metadata)?.category 
            : (m.metadata as any)?.category,
          userId: m.userId,
          createdAt: m.timestamp || new Date(),
          updatedAt: m.syncedAt || new Date()
        }));
    } catch (error) {
      logger.error('Error recalling memory', error as Error);
      return [];
    }
  }
}

export const memoryService = new MemoryService();

