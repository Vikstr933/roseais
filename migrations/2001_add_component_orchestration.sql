-- Add orchestration patterns for component generation
INSERT INTO orchestration_patterns (
  name,
  description,
  pattern,
  task_decomposition,
  agent_roles,
  coordination_rules,
  category
) VALUES (
  'Component Generation Pattern',
  'Pattern for generating React components through multi-agent collaboration',
  jsonb_build_object(
    'type', 'sequential',
    'error_handling', 'retry',
    'max_retries', 3
  ),
  jsonb_build_array(
    'Requirements Analysis',
    'Architecture Design',
    'Implementation',
    'Testing'
  ),
  jsonb_build_array(
    'App Architect',
    'Developer',
    'QA Engineer'
  ),
  jsonb_build_object(
    'validation_gates', true,
    'feedback_loops', true,
    'error_propagation', true
  ),
  'component_generation'
);
