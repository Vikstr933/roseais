-- Add component generation chain
INSERT INTO prompt_chains (
  name,
  description,
  steps,
  input_schema,
  output_schema,
  version,
  is_active,
  retry_strategy,
  error_handling,
  timeout,
  max_tokens
) VALUES (
  'Component Generation Chain',
  'Chain for generating React components through multiple steps',
  jsonb_build_array(
    jsonb_build_object(
      'name', 'analyze_requirements',
      'description', 'Analyze component requirements',
      'agent_role', 'App Architect',
      'template', 'Component Requirements Analysis',
      'input_mapping', jsonb_build_object(
        'user_prompt', 'user_prompt'
      ),
      'output_mapping', jsonb_build_object(
        'analysis_result', 'text'
      ),
      'validation', jsonb_build_object(
        'required_fields', array['Component Name', 'Core Features']
      )
    ),
    jsonb_build_object(
      'name', 'design_architecture',
      'description', 'Design component architecture',
      'agent_role', 'App Architect',
      'template', 'Component Architecture Design',
      'input_mapping', jsonb_build_object(
        'analysis_result', 'analysis_result'
      ),
      'output_mapping', jsonb_build_object(
        'design_result', 'text'
      ),
      'dependencies', array['analyze_requirements']
    ),
    jsonb_build_object(
      'name', 'implement_component',
      'description', 'Implement the component',
      'agent_role', 'Developer',
      'template', 'Component Implementation',
      'input_mapping', jsonb_build_object(
        'analysis_result', 'analysis_result',
        'design_result', 'design_result'
      ),
      'output_mapping', jsonb_build_object(
        'implementation_result', 'text'
      ),
      'dependencies', array['design_architecture']
    )
  ),
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'user_prompt', jsonb_build_object(
        'type', 'string',
        'description', 'User request for component generation'
      )
    ),
    'required', array['user_prompt']
  ),
  jsonb_build_object(
    'type', 'object',
    'properties', jsonb_build_object(
      'component_code', jsonb_build_object(
        'type', 'string',
        'description', 'Generated component code'
      ),
      'documentation', jsonb_build_object(
        'type', 'string',
        'description', 'Component documentation'
      )
    )
  ),
  '1.0',
  true,
  jsonb_build_object(
    'max_retries', 3,
    'delay_between_retries', 1000
  ),
  jsonb_build_object(
    'on_failure', 'retry',
    'on_timeout', 'abort'
  ),
  30000,
  4000
);
