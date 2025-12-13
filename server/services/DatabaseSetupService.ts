import { SimpleLogger } from '../utils/SimpleLogger';
import Anthropic from '@anthropic-ai/sdk';

const logger = new SimpleLogger('DatabaseSetupService');

export interface DatabaseRequirement {
  type: 'mongodb' | 'postgresql' | 'mysql' | 'sqlite' | 'none';
  detected: boolean;
  confidence: number;
  configFiles: string[];
  connectionString?: string;
  setupInstructions?: string;
  needsSetup: boolean;
}

export interface ProjectDatabaseInfo {
  requirements: DatabaseRequirement[];
  needsDatabase: boolean;
  recommendedSetup: DatabaseRequirement | null;
  envVariables: Record<string, string>;
}

export class DatabaseSetupService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Detect database requirements from project files
   * @param files Project files
   * @param readmeAnalysis Optional README.md analysis results
   */
  public async detectDatabaseRequirements(
    files: Array<{ path: string; content: string }>,
    readmeAnalysis?: {
      environmentVariables?: string[];
      databaseInfo?: string;
      setupInstructions?: string;
    } | null
  ): Promise<ProjectDatabaseInfo> {
    const requirements: DatabaseRequirement[] = [];
    const envVariables: Record<string, string> = {};

    // Find package.json, requirements.txt, composer.json, etc.
    const packageJson = files.find(f => f.path.includes('package.json'));
    const requirementsTxt = files.find(f => f.path.includes('requirements.txt'));
    const composerJson = files.find(f => f.path.includes('composer.json'));
    const pomXml = files.find(f => f.path.includes('pom.xml'));
    const envExample = files.find(f => f.path.includes('.env.example') || f.path.includes('.env.sample'));
    const envFile = files.find(f => f.path.includes('.env') && !f.path.includes('.env.example'));

    // Detect MongoDB
    const mongodbRequirement = this.detectMongoDB(files, packageJson);
    if (mongodbRequirement.detected) {
      requirements.push(mongodbRequirement);
      envVariables['MONGODB_URI'] = mongodbRequirement.connectionString || 'mongodb://localhost:27017/your-database-name';
    }

    // Detect PostgreSQL
    const postgresRequirement = this.detectPostgreSQL(files, packageJson, requirementsTxt);
    if (postgresRequirement.detected) {
      requirements.push(postgresRequirement);
      // Use PROJECT_DATABASE_URL to avoid conflict with platform's DATABASE_URL
      envVariables['PROJECT_DATABASE_URL'] = postgresRequirement.connectionString || 'postgresql://user:password@localhost:5432/your-database-name';
    }

    // Detect MySQL
    const mysqlRequirement = this.detectMySQL(files, packageJson, composerJson);
    if (mysqlRequirement.detected) {
      requirements.push(mysqlRequirement);
      envVariables['MYSQL_HOST'] = 'localhost';
      envVariables['MYSQL_USER'] = 'root';
      envVariables['MYSQL_PASSWORD'] = 'password';
      envVariables['MYSQL_DATABASE'] = 'your-database-name';
    }

    // Use AI to analyze if database is needed but not detected
    if (requirements.length === 0) {
      const aiAnalysis = await this.analyzeWithAI(files);
      if (aiAnalysis.needsDatabase) {
        requirements.push(aiAnalysis.requirement);
        if (aiAnalysis.requirement.type === 'mongodb') {
          envVariables['MONGODB_URI'] = aiAnalysis.requirement.connectionString || 'mongodb://localhost:27017/your-database-name';
        } else if (aiAnalysis.requirement.type === 'postgresql') {
          // Use PROJECT_DATABASE_URL to avoid conflict with platform's DATABASE_URL
          envVariables['PROJECT_DATABASE_URL'] = aiAnalysis.requirement.connectionString || 'postgresql://user:password@localhost:5432/your-database-name';
        }
      }
    }

    // Extract existing env variables from .env.example or .env
    if (envExample || envFile) {
      const envContent = (envExample || envFile)!.content;
      const existingVars = this.parseEnvFile(envContent);
      Object.assign(envVariables, existingVars);
    }

    const recommendedSetup = requirements.length > 0 
      ? requirements.sort((a, b) => b.confidence - a.confidence)[0]
      : null;

    return {
      requirements,
      needsDatabase: requirements.length > 0,
      recommendedSetup,
      envVariables
    };
  }

  /**
   * Detect MongoDB requirements
   */
  private detectMongoDB(
    files: Array<{ path: string; content: string }>,
    packageJson?: { path: string; content: string }
  ): DatabaseRequirement {
    const configFiles: string[] = [];
    let confidence = 0;

    // Check package.json for mongoose, mongodb, etc.
    if (packageJson) {
      const content = packageJson.content.toLowerCase();
      if (content.includes('mongoose') || content.includes('mongodb')) {
        confidence += 0.8;
        configFiles.push(packageJson.path);
      }
    }

    // Check for MongoDB connection strings in files
    for (const file of files) {
      const content = file.content.toLowerCase();
      if (content.includes('mongodb://') || content.includes('mongodb+srv://')) {
        confidence += 0.5;
        configFiles.push(file.path);
      }
      if (content.includes('mongoose.connect') || content.includes('mongoclient')) {
        confidence += 0.3;
        if (!configFiles.includes(file.path)) {
          configFiles.push(file.path);
        }
      }
    }

    return {
      type: 'mongodb',
      detected: confidence > 0.3,
      confidence,
      configFiles,
      connectionString: 'mongodb://localhost:27017/your-database-name',
      setupInstructions: 'MongoDB is required. Install MongoDB locally or use MongoDB Atlas (cloud).',
      needsSetup: confidence > 0.3
    };
  }

  /**
   * Detect PostgreSQL requirements
   */
  private detectPostgreSQL(
    files: Array<{ path: string; content: string }>,
    packageJson?: { path: string; content: string },
    requirementsTxt?: { path: string; content: string }
  ): DatabaseRequirement {
    const configFiles: string[] = [];
    let confidence = 0;

    // Check package.json for pg, postgres, sequelize, etc.
    if (packageJson) {
      const content = packageJson.content.toLowerCase();
      if (content.includes('"pg"') || content.includes('"postgres"') || content.includes('"sequelize"')) {
        confidence += 0.8;
        configFiles.push(packageJson.path);
      }
    }

    // Check requirements.txt for psycopg2, etc.
    if (requirementsTxt) {
      const content = requirementsTxt.content.toLowerCase();
      if (content.includes('psycopg2') || content.includes('postgresql')) {
        confidence += 0.7;
        configFiles.push(requirementsTxt.path);
      }
    }

    // Check for PostgreSQL connection strings
    for (const file of files) {
      const content = file.content.toLowerCase();
      if (content.includes('postgresql://') || content.includes('postgres://')) {
        confidence += 0.5;
        configFiles.push(file.path);
      }
    }

    return {
      type: 'postgresql',
      detected: confidence > 0.3,
      confidence,
      configFiles,
      connectionString: 'postgresql://user:password@localhost:5432/your-database-name',
      setupInstructions: 'PostgreSQL is required. Install PostgreSQL locally or use Supabase/Neon (cloud).',
      needsSetup: confidence > 0.3
    };
  }

  /**
   * Detect MySQL requirements
   */
  private detectMySQL(
    files: Array<{ path: string; content: string }>,
    packageJson?: { path: string; content: string },
    composerJson?: { path: string; content: string }
  ): DatabaseRequirement {
    const configFiles: string[] = [];
    let confidence = 0;

    // Check package.json for mysql, mysql2, etc.
    if (packageJson) {
      const content = packageJson.content.toLowerCase();
      if (content.includes('"mysql"') || content.includes('"mysql2"')) {
        confidence += 0.8;
        configFiles.push(packageJson.path);
      }
    }

    // Check composer.json for doctrine, etc.
    if (composerJson) {
      const content = composerJson.content.toLowerCase();
      if (content.includes('doctrine') || content.includes('mysql')) {
        confidence += 0.7;
        configFiles.push(composerJson.path);
      }
    }

    // Check for MySQL connection strings
    for (const file of files) {
      const content = file.content.toLowerCase();
      if (content.includes('mysql://') || content.includes('mysql2://')) {
        confidence += 0.5;
        configFiles.push(file.path);
      }
    }

    return {
      type: 'mysql',
      detected: confidence > 0.3,
      confidence,
      configFiles,
      connectionString: 'mysql://user:password@localhost:3306/your-database-name',
      setupInstructions: 'MySQL is required. Install MySQL locally or use a cloud MySQL service.',
      needsSetup: confidence > 0.3
    };
  }

  /**
   * Use AI to analyze if database is needed
   */
  private async analyzeWithAI(
    files: Array<{ path: string; content: string }>
  ): Promise<{ needsDatabase: boolean; requirement: DatabaseRequirement }> {
    try {
      // Get relevant files (package.json, server files, config files)
      const relevantFiles = files
        .filter(f => 
          f.path.includes('package.json') ||
          f.path.includes('server') ||
          f.path.includes('config') ||
          f.path.includes('app.js') ||
          f.path.includes('index.js') ||
          f.path.includes('main.py') ||
          f.path.includes('app.py')
        )
        .slice(0, 10)
        .map(f => `${f.path}:\n${f.content.substring(0, 2000)}`)
        .join('\n\n---\n\n');

      const prompt = `Analyze these project files and determine if this project needs a database (MongoDB, PostgreSQL, MySQL, etc.).

Files:
${relevantFiles}

Respond with JSON:
{
  "needsDatabase": true/false,
  "databaseType": "mongodb" | "postgresql" | "mysql" | "none",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        if (analysis.needsDatabase && analysis.databaseType !== 'none') {
          return {
            needsDatabase: true,
            requirement: {
              type: analysis.databaseType,
              detected: true,
              confidence: analysis.confidence || 0.5,
              configFiles: [],
              connectionString: this.getDefaultConnectionString(analysis.databaseType),
              setupInstructions: `This project requires ${analysis.databaseType}. ${analysis.reason || ''}`,
              needsSetup: true
            }
          };
        }
      }
    } catch (error) {
      logger.warn('AI database analysis failed', error as Error);
    }

    return {
      needsDatabase: false,
      requirement: {
        type: 'none',
        detected: false,
        confidence: 0,
        configFiles: [],
        needsSetup: false
      }
    };
  }

  /**
   * Get default connection string for database type
   */
  private getDefaultConnectionString(type: string): string {
    switch (type) {
      case 'mongodb':
        return 'mongodb://localhost:27017/your-database-name';
      case 'postgresql':
        return 'postgresql://user:password@localhost:5432/your-database-name';
      case 'mysql':
        return 'mysql://user:password@localhost:3306/your-database-name';
      default:
        return '';
    }
  }

  /**
   * Parse .env file content
   */
  private parseEnvFile(content: string): Record<string, string> {
    const vars: Record<string, string> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          vars[key] = value;
        }
      }
    }

    return vars;
  }

  /**
   * Generate .env.example file for project
   */
  public generateEnvExample(databaseInfo: ProjectDatabaseInfo, projectName: string): string {
    const lines: string[] = [];
    
    lines.push(`# Environment variables for ${projectName}`);
    lines.push('# Copy this file to .env and fill in your actual values');
    lines.push('');

    // Add database variables
    if (databaseInfo.needsDatabase && databaseInfo.recommendedSetup) {
      lines.push(`# Database Configuration (${databaseInfo.recommendedSetup.type})`);
      if (databaseInfo.recommendedSetup.type === 'mongodb') {
        lines.push('MONGODB_URI=mongodb://localhost:27017/your-database-name');
        lines.push('# Or use MongoDB Atlas:');
        lines.push('# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name');
      } else if (databaseInfo.recommendedSetup.type === 'postgresql') {
        lines.push('# Use PROJECT_DATABASE_URL to avoid conflict with platform DATABASE_URL');
        lines.push('PROJECT_DATABASE_URL=postgresql://user:password@localhost:5432/your-database-name');
        lines.push('# Or use Supabase/Neon:');
        lines.push('# PROJECT_DATABASE_URL=postgresql://user:password@host:5432/database');
        lines.push('');
        lines.push('# Note: Some frameworks expect DATABASE_URL. If needed, you can alias it:');
        lines.push('# DATABASE_URL=${PROJECT_DATABASE_URL}');
      } else if (databaseInfo.recommendedSetup.type === 'mysql') {
        lines.push('MYSQL_HOST=localhost');
        lines.push('MYSQL_USER=root');
        lines.push('MYSQL_PASSWORD=password');
        lines.push('MYSQL_DATABASE=your-database-name');
      }
      lines.push('');
    }

    // Add other env variables from detected files
    for (const [key, value] of Object.entries(databaseInfo.envVariables)) {
      // Filter out DATABASE_URL to avoid conflict, but keep PROJECT_DATABASE_URL
      if (!key.includes('DATABASE_URL') && !key.includes('MONGODB') && !key.includes('MYSQL')) {
        lines.push(`${key}=${value}`);
      }
    }

    // Add common variables
    if (!databaseInfo.envVariables['NODE_ENV']) {
      lines.push('');
      lines.push('# Application');
      lines.push('NODE_ENV=development');
      lines.push('PORT=3000');
    }

    return lines.join('\n');
  }

  /**
   * Generate setup instructions
   */
  public generateSetupInstructions(databaseInfo: ProjectDatabaseInfo, autoProvisioned?: boolean): string {
    if (!databaseInfo.needsDatabase || !databaseInfo.recommendedSetup) {
      return '';
    }

    const req = databaseInfo.recommendedSetup;
    const instructions: string[] = [];

    if (autoProvisioned) {
      instructions.push(`✅ **Database Automatically Provisioned!**`);
      instructions.push('');
      instructions.push(`Your **${req.type.toUpperCase()}** database has been automatically set up and configured.`);
      instructions.push('The connection string has been saved to your project configuration.');
      instructions.push('');
      instructions.push('**Next Steps:**');
      instructions.push('1. The database is ready to use - no manual setup needed!');
      instructions.push('2. Run any migration scripts included in the project to set up tables/schemas');
      instructions.push('3. Your `.env` file will be automatically configured with the connection string');
      instructions.push('');
    } else {
      instructions.push(`📊 **Database Setup Required**`);
      instructions.push('');
      instructions.push(`This project requires a **${req.type.toUpperCase()}** database.`);
      instructions.push('');

      if (req.type === 'mongodb') {
        instructions.push('**Option 1: MongoDB Atlas (Cloud - Recommended)**');
        instructions.push('1. **Sign up:** https://www.mongodb.com/cloud/atlas/register');
        instructions.push('2. **Create cluster:** https://cloud.mongodb.com → Create → Free tier');
        instructions.push('3. **Get connection string:**');
        instructions.push('   - Go to Database → Connect → Connect your application');
        instructions.push('   - Copy the connection string');
        instructions.push('   - Replace `<password>` with your database user password');
        instructions.push('   - Replace `<dbname>` with your database name');
        instructions.push('4. **Update `.env`:** Add `MONGODB_URI=<your-connection-string>`');
        instructions.push('');
        instructions.push('**Option 2: Local MongoDB**');
        instructions.push('1. **Install MongoDB:** https://www.mongodb.com/try/download/community');
        instructions.push('2. **Start MongoDB:** Run `mongod` in terminal');
        instructions.push('3. **Update `.env`:** Add `MONGODB_URI=mongodb://localhost:27017/your-database-name`');
        instructions.push('');
      } else if (req.type === 'postgresql') {
        instructions.push('**Option 1: Supabase (Cloud - Recommended)**');
        instructions.push('1. **Sign up:** https://supabase.com/dashboard/sign-up');
        instructions.push('2. **Create project:** Click "New Project" → Fill in details → Create');
        instructions.push('3. **Get connection string:**');
        instructions.push('   - Go to Project Settings → Database');
        instructions.push('   - Copy "Connection string" (URI format)');
        instructions.push('   - Use the "Transaction" pooler mode for better performance');
        instructions.push('4. **Update `.env`:** Add `PROJECT_DATABASE_URL=<your-connection-string>`');
        instructions.push('');
        instructions.push('**Option 2: Neon (Serverless - Alternative)**');
        instructions.push('1. **Sign up:** https://neon.tech/signup');
        instructions.push('2. **Create project:** Click "New Project" → Create');
        instructions.push('3. **Get connection string:**');
        instructions.push('   - Copy connection string from dashboard');
        instructions.push('4. **Update `.env`:** Add `PROJECT_DATABASE_URL=<your-connection-string>`');
        instructions.push('');
        instructions.push('**Option 3: Local PostgreSQL**');
        instructions.push('1. **Install PostgreSQL:** https://www.postgresql.org/download/');
        instructions.push('2. **Create database:** Run `createdb your-database-name`');
        instructions.push('3. **Update `.env`:** Add `PROJECT_DATABASE_URL=postgresql://user:password@localhost:5432/your-database-name`');
        instructions.push('');
      } else if (req.type === 'mysql') {
        instructions.push('**Option 1: Local MySQL**');
        instructions.push('1. Install MySQL: https://dev.mysql.com/downloads/');
        instructions.push('2. Create database: `CREATE DATABASE your-database-name;`');
        instructions.push('3. Update `.env` with MySQL credentials');
        instructions.push('');
        instructions.push('**Option 2: Cloud MySQL**');
        instructions.push('1. Use services like PlanetScale, AWS RDS, or Google Cloud SQL');
        instructions.push('2. Get connection details and update `.env`');
        instructions.push('');
      }

      instructions.push('After setting up the database, run any migration scripts included in the project.');
    }

    return instructions.join('\n');
  }
}

export const databaseSetupService = new DatabaseSetupService();

