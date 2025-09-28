import Database from 'better-sqlite3';
import path from 'path';

function seedData() {
  try {
    const dbPath = path.join(process.cwd(), 'db', 'db.sqlite');
    const db = new Database(dbPath);

    console.log('Seeding database with sample data...');

    // Sample agents data
    const agentsData = [
      {
        name: "Frontend Developer",
        description: "Expert in React, Vue, Angular, and modern frontend technologies",
        role: "frontend",
        model: "claude-3-5-sonnet-20241022",
        system_prompt: "You are a senior frontend developer specializing in React, Vue, and modern web technologies. You create clean, maintainable, and performant user interfaces.",
        temperature: "0.7",
        capabilities: JSON.stringify(["React Development", "Vue Development", "Component Design", "State Management"]),
        expertise: JSON.stringify({"React": "expert", "TypeScript": "expert", "CSS": "expert"}),
        frameworks: JSON.stringify(["React", "Next.js", "Vue", "Angular"]),
        libraries: JSON.stringify(["React Router", "Redux", "Tailwind CSS", "Framer Motion"]),
        best_practices: JSON.stringify(["Component Composition", "Clean Code", "Performance Optimization"]),
        is_active: 1
      },
      {
        name: "Backend Developer",
        description: "Expert in Node.js, Python, databases, and API development",
        role: "backend",
        model: "claude-3-5-sonnet-20241022",
        system_prompt: "You are a senior backend developer specializing in Node.js, Python, and database design. You create scalable, secure, and efficient APIs.",
        temperature: "0.7",
        capabilities: JSON.stringify(["API Development", "Database Design", "Authentication", "Microservices"]),
        expertise: JSON.stringify({"Node.js": "expert", "Python": "expert", "PostgreSQL": "expert"}),
        frameworks: JSON.stringify(["Express.js", "FastAPI", "Django", "NestJS"]),
        libraries: JSON.stringify(["JWT", "Sequelize", "Prisma", "Redis"]),
        best_practices: JSON.stringify(["SOLID Principles", "Clean Architecture", "Security Best Practices"]),
        is_active: 1
      },
      {
        name: "Database Designer",
        description: "Expert in database architecture, optimization, and data modeling",
        role: "database",
        model: "claude-3-5-sonnet-20241022",
        system_prompt: "You are a senior database architect specializing in PostgreSQL, MySQL, and data modeling. You design efficient, scalable database schemas.",
        temperature: "0.6",
        capabilities: JSON.stringify(["Schema Design", "Query Optimization", "Data Modeling", "Performance Tuning"]),
        expertise: JSON.stringify({"PostgreSQL": "expert", "MySQL": "expert", "Redis": "expert"}),
        frameworks: JSON.stringify(["Drizzle ORM", "Prisma", "Sequelize"]),
        libraries: JSON.stringify(["PostgreSQL", "Redis", "MongoDB"]),
        best_practices: JSON.stringify(["Normalization", "Indexing", "Data Integrity"]),
        is_active: 1
      }
    ];

    // Insert sample agents
    const insertAgent = db.prepare(`
      INSERT INTO agents (name, description, role, model, system_prompt, temperature, capabilities, expertise, frameworks, libraries, best_practices, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const agent of agentsData) {
      try {
        insertAgent.run(
          agent.name,
          agent.description,
          agent.role,
          agent.model,
          agent.system_prompt,
          agent.temperature,
          agent.capabilities,
          agent.expertise,
          agent.frameworks,
          agent.libraries,
          agent.best_practices,
          agent.is_active
        );
        console.log(`✅ Inserted agent: ${agent.name}`);
      } catch (error) {
        console.error(`❌ Failed to insert agent ${agent.name}:`, error);
      }
    }

    // Sample scripts data
    const scriptsData = [
      {
        name: "React Component Generator",
        description: "Autonomous agent that generates complete React components with TypeScript",
        language: "TypeScript",
        version: "1.0.0",
        script_template: "import React from 'react';\n\ninterface {{componentName}}Props {\n  // Define props here\n}\n\nconst {{componentName}}: React.FC<{{componentName}}Props> = () => {\n  return (\n    <div>\n      <h1>{{componentName}}</h1>\n    </div>\n  );\n};\n\nexport default {{componentName}};",
        config_schema: JSON.stringify({componentName: "string", props: "object"}),
        requirements: JSON.stringify(["Node.js 16+", "React 18+", "TypeScript 4.9+"]),
        category: "frontend",
        tags: JSON.stringify(["react", "typescript", "components"])
      },
      {
        name: "API Endpoint Generator",
        description: "Generates RESTful API endpoints with proper error handling and validation",
        language: "TypeScript",
        version: "1.0.0",
        script_template: "import { Request, Response } from 'express';\n\n// {{endpointName}} endpoint\nexport const {{endpointName}} = async (req: Request, res: Response) => {\n  try {\n    // Implementation here\n    res.json({ success: true, data: {} });\n  } catch (error) {\n    res.status(500).json({ error: 'Internal server error' });\n  }\n};",
        config_schema: JSON.stringify({endpointName: "string", method: "string"}),
        requirements: JSON.stringify(["Node.js 16+", "Express.js", "TypeScript"]),
        category: "backend",
        tags: JSON.stringify(["api", "express", "typescript"])
      }
    ];

    const insertScript = db.prepare(`
      INSERT INTO agent_scripts (name, description, language, version, script_template, config_schema, requirements, category, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const script of scriptsData) {
      try {
        insertScript.run(
          script.name,
          script.description,
          script.language,
          script.version,
          script.script_template,
          script.config_schema,
          script.requirements,
          script.category,
          script.tags
        );
        console.log(`✅ Inserted script: ${script.name}`);
      } catch (error) {
        console.error(`❌ Failed to insert script ${script.name}:`, error);
      }
    }

    // Verify data
    const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get();
    const scriptCount = db.prepare('SELECT COUNT(*) as count FROM agent_scripts').get();
    
    console.log(`📊 Database seeded with ${agentCount.count} agents and ${scriptCount.count} scripts`);

    db.close();
    console.log('🎉 Database seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

seedData();
