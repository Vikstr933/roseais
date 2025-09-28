-- Add prompt templates for component generation
INSERT INTO prompt_templates (
  name,
  description,
  template,
  variables,
  category,
  tags,
  best_practices,
  version
) VALUES 
(
  'Component Requirements Analysis',
  'Template for analyzing component requirements and features',
  'Analyze the following component request and provide a detailed breakdown:

Component Request: {{user_prompt}}

Please provide:
1. Component Name
2. Core Features
3. Required Props
4. State Management Needs
5. UI/UX Considerations
6. Technical Requirements
7. Potential Edge Cases
8. Accessibility Requirements',
  jsonb_build_object(
    'user_prompt', 'string'
  ),
  'analysis',
  jsonb_build_array('react', 'components', 'requirements'),
  jsonb_build_object(
    'comprehensive_analysis', true,
    'clear_documentation', true
  ),
  '1.0'
),
(
  'Component Architecture Design',
  'Template for designing component architecture',
  'Based on the requirements analysis:
{{analysis_result}}

Design the component architecture considering:
1. Component Structure
2. Data Flow
3. State Management Strategy
4. Event Handling
5. Performance Optimizations
6. Reusability Patterns',
  jsonb_build_object(
    'analysis_result', 'string'
  ),
  'design',
  jsonb_build_array('architecture', 'design-patterns'),
  jsonb_build_object(
    'modular_design', true,
    'scalable_architecture', true
  ),
  '1.0'
),
(
  'Component Implementation',
  'Template for implementing the component',
  'Implement the React component based on:

Requirements: {{analysis_result}}
Architecture: {{design_result}}

Provide the implementation with:
1. TypeScript/React code
2. Styling (CSS/Tailwind)
3. Props interface
4. State management
5. Event handlers
6. Documentation',
  jsonb_build_object(
    'analysis_result', 'string',
    'design_result', 'string'
  ),
  'implementation',
  jsonb_build_array('react', 'typescript', 'implementation'),
  jsonb_build_object(
    'clean_code', true,
    'type_safety', true
  ),
  '1.0'
);
