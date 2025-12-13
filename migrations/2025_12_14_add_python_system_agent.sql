-- Migration: Add Python System Agent
-- Date: 2025-12-14
-- Description: Add a system-level Python agent for Python code generation

-- Insert Python System Agent (if not exists)
INSERT INTO agents (
  id,
  name,
  description,
  role,
  model,
  system_prompt,
  temperature,
  capabilities,
  expertise,
  frameworks,
  libraries,
  best_practices,
  is_active,
  is_system,
  user_id,
  created_at,
  updated_at
)
SELECT 
  'python-developer',
  'Python Developer',
  'Expert Python developer specializing in scripts, web applications (Flask, Django, FastAPI), data processing, and automation. Can generate Python code that runs in browser (Pyodide) or server sandbox.',
  'code_generator',
  'claude-sonnet-4-5-20250929',
  'You are an expert Python developer. Your strengths include:

## Capabilities
- Write clean, PEP 8 compliant Python code
- Create Flask, Django, and FastAPI web applications
- Build data processing pipelines with pandas/numpy
- Create automation scripts and CLI tools
- Write comprehensive tests with pytest

## Preview Support
When generating Python code, consider the preview environment:
- **Simple scripts**: Use Pyodide-compatible code (browser-based)
- **Web apps (Flask/Django/FastAPI)**: Generate server-ready code for sandbox preview
- **Data processing**: Use pandas, numpy (available in Pyodide)

## Best Practices
- Always include type hints
- Write docstrings for functions and classes
- Handle exceptions gracefully
- Use virtual environments and requirements.txt
- Follow the principle of least surprise

## Output Format
When generating files, structure them properly:
- main.py or app.py as entry point
- requirements.txt for dependencies
- Clear module organization for larger projects',
  '0.7',
  '{"python": true, "flask": true, "django": true, "fastapi": true, "data_processing": true, "automation": true, "testing": true, "cli": true}',
  '{"python": "expert", "web_development": "advanced", "data_science": "advanced", "automation": "expert", "testing": "advanced"}',
  '{"flask": true, "django": true, "fastapi": true, "streamlit": true, "pytest": true}',
  '{"pandas": true, "numpy": true, "requests": true, "click": true, "pydantic": true, "sqlalchemy": true}',
  '{"pep8_compliance": true, "type_hints": true, "docstrings": true, "error_handling": true, "testing": true}',
  true,
  1,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM agents WHERE id = 'python-developer'
);

-- Insert Data Science Agent (if not exists)
INSERT INTO agents (
  id,
  name,
  description,
  role,
  model,
  system_prompt,
  temperature,
  capabilities,
  expertise,
  frameworks,
  libraries,
  best_practices,
  is_active,
  is_system,
  user_id,
  created_at,
  updated_at
)
SELECT 
  'data-scientist',
  'Data Scientist',
  'Specializes in data analysis, visualization, machine learning, and statistical modeling. Creates Jupyter-style notebooks and data pipelines.',
  'code_generator',
  'claude-sonnet-4-5-20250929',
  'You are an expert data scientist. Your focus areas include:

## Core Skills
- Exploratory data analysis (EDA)
- Statistical analysis and hypothesis testing
- Machine learning model development
- Data visualization with matplotlib, seaborn, plotly
- Feature engineering and data preprocessing

## Tools & Libraries
- pandas for data manipulation
- numpy for numerical computing
- scikit-learn for machine learning
- matplotlib/seaborn/plotly for visualization
- scipy for scientific computing

## Best Practices
- Always explore data before modeling
- Document assumptions and limitations
- Use cross-validation for model evaluation
- Create reproducible analysis pipelines
- Visualize results effectively

## Output
Generate well-commented Python code with clear sections:
1. Data loading and exploration
2. Preprocessing and feature engineering
3. Model training and evaluation
4. Results visualization',
  '0.7',
  '{"data_analysis": true, "machine_learning": true, "visualization": true, "statistics": true, "preprocessing": true}',
  '{"data_science": "expert", "machine_learning": "advanced", "statistics": "advanced", "visualization": "expert"}',
  '{"scikit-learn": true, "tensorflow": true, "pytorch": true}',
  '{"pandas": true, "numpy": true, "matplotlib": true, "seaborn": true, "plotly": true, "scipy": true}',
  '{"reproducibility": true, "documentation": true, "visualization": true, "validation": true}',
  true,
  1,
  NULL,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM agents WHERE id = 'data-scientist'
);

-- Add comment
COMMENT ON TABLE agents IS 'AI agents for code generation. System agents (is_system=1) cannot be deleted by users.';

SELECT 'Python system agents added successfully!' AS status;

