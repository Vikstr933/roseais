import { db } from '../db';
import { agentScripts } from '../db/schema';

async function seedAgentScripts() {
  try {
    const scripts = [
      {
        name: "React Component Generator",
        description: "Autonomous agent that generates complete React components with TypeScript",
        language: "TypeScript",
        version: "1.0.0",
        scriptTemplate: `import React, { useState, useEffect } from 'react';

interface {{componentName}}Props {
  // Define your props here
}

export const {{componentName}}: React.FC<{{componentName}}Props> = ({}) => {
  // Component implementation
  return (
    <div className="{{componentName.toLowerCase()}}">
      {/* Component JSX */}
    </div>
  );
};

export default {{componentName}};`,
        configSchema: {
          componentName: "string",
          props: "object",
          styling: "string",
          testing: "boolean"
        },
        requirements: ["Node.js 16+", "React 18+", "TypeScript"],
        category: "frontend",
        tags: ["react", "typescript", "components", "automation"]
      },
      {
        name: "API Endpoint Builder",
        description: "Creates RESTful API endpoints with validation and documentation",
        language: "TypeScript",
        version: "1.2.0",
        scriptTemplate: `import express from 'express';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// {{endpointName}} endpoint
router.{{method}}('{{route}}', [
  // Validation middleware
  body('{{field}}').isString().notEmpty()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Endpoint implementation
    const result = await {{serviceFunction}}(req.body);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;`,
        configSchema: {
          endpoints: "array",
          validation: "object",
          database: "string",
          authentication: "boolean"
        },
        requirements: ["Node.js 16+", "Express.js", "Joi/Zod"],
        category: "backend",
        tags: ["api", "express", "validation", "documentation"]
      },
      {
        name: "Database Schema Manager",
        description: "Manages database schemas, migrations, and relationships",
        language: "Python",
        version: "2.1.0",
        scriptTemplate: `from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime

Base = declarative_base()

class {{tableName}}(Base):
    __tablename__ = '{{tableName}}'

    id = Column(Integer, primary_key=True, index=True)
    # Define your columns here
    created_at = Column(DateTime, default=datetime.utcnow)

    # Define relationships
    # {{relationship}}

# Database setup
DATABASE_URL = "sqlite:///./{{databaseName}}.db"
engine = create_engine(DATABASE_URL)
Base.metadata.create_all(bind=engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`,
        configSchema: {
          databaseType: "string",
          tables: "array",
          relationships: "array",
          indexes: "array"
        },
        requirements: ["Python 3.8+", "SQLAlchemy", "Alembic"],
        category: "database",
        tags: ["database", "schema", "migrations", "sql"]
      }
    ];

    for (const script of scripts) {
      try {
        const result = await db.insert(agentScripts).values(script).returning();
        console.log(`✅ Inserted script: ${script.name}`);
      } catch (error) {
        console.error(`❌ Failed to insert script ${script.name}:`, error);
      }
    }

    console.log('🎉 Agent scripts seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding agent scripts:', error);
  } finally {
    process.exit();
  }
}

seedAgentScripts();
