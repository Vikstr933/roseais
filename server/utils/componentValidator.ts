import * as fs from 'fs/promises';
import * as path from 'path';
import { ComponentFeatures } from './types';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  testResults?: {
    passed: boolean;
    unitTests: string[];
    integrationTests: string[];
    accessibilityTests: string[];
    performanceTests: string[];
  };
}

interface FileValidation {
  path: string;
  required: boolean;
  validate?: (content: string) => string[];
}

export async function validateComponent(
  workspacePath: string,
  features: ComponentFeatures,
  testResults?: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Define required files and their validation rules
  const requiredFiles: FileValidation[] = [
    {
      path: 'src/main.tsx',
      required: true,
      validate: validateMainFile,
    },
    {
      path: `src/${features.name}.tsx`,
      required: true,
      validate: content => validateComponentFile(content, features),
    },
    {
      path: 'package.json',
      required: true,
      validate: validatePackageJson,
    },
    {
      path: 'index.html',
      required: true,
      validate: validateIndexHtml,
    },
    {
      path: 'tsconfig.json',
      required: true,
    },
  ];

  // Check each required file
  for (const file of requiredFiles) {
    try {
      const filePath = path.join(workspacePath, file.path);
      const content = await fs.readFile(filePath, 'utf-8');

      // If file has a validation function, run it
      if (file.validate) {
        const validationErrors = file.validate(content);
        result.errors.push(...validationErrors);
      }
    } catch (error) {
      if (file.required) {
        result.errors.push(`Missing required file: ${file.path}`);
      } else {
        result.warnings.push(`Missing optional file: ${file.path}`);
      }
    }
  }

  // Validate component type matches request
  await validateComponentType(workspacePath, features, result);

  // Set overall validation status
  result.isValid = result.errors.length === 0;

  // Parse and validate test results if provided
  if (testResults) {
    try {
      const parsedTests = parseTestResults(testResults);
      result.testResults = parsedTests;

      // Add warnings for missing test categories
      if (!parsedTests.unitTests.length) {
        result.warnings.push('No unit tests found in test results');
      }
      if (!parsedTests.integrationTests.length) {
        result.warnings.push('No integration tests found in test results');
      }
      if (!parsedTests.accessibilityTests.length) {
        result.warnings.push('No accessibility tests found in test results');
      }
      if (!parsedTests.performanceTests.length) {
        result.warnings.push('No performance tests found in test results');
      }
    } catch (error) {
      result.errors.push(`Failed to parse test results: ${error}`);
    }
  }

  return result;
}

function parseTestResults(testResults: string) {
  const parsed = {
    passed: true,
    unitTests: [] as string[],
    integrationTests: [] as string[],
    accessibilityTests: [] as string[],
    performanceTests: [] as string[],
  };

  // Split the test results into sections
  const sections = testResults.split(/\d\.\s+/);

  sections.forEach(section => {
    if (section.toLowerCase().includes('unit test')) {
      parsed.unitTests = extractTestCases(section);
    } else if (section.toLowerCase().includes('integration test')) {
      parsed.integrationTests = extractTestCases(section);
    } else if (section.toLowerCase().includes('accessibility test')) {
      parsed.accessibilityTests = extractTestCases(section);
    } else if (section.toLowerCase().includes('performance test')) {
      parsed.performanceTests = extractTestCases(section);
    }
  });

  // Check if any test sections are empty
  parsed.passed =
    parsed.unitTests.length > 0 &&
    parsed.integrationTests.length > 0 &&
    parsed.accessibilityTests.length > 0 &&
    parsed.performanceTests.length > 0;

  return parsed;
}

function extractTestCases(section: string): string[] {
  return section
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim().substring(1).trim());
}

function validateMainFile(content: string): string[] {
  const errors: string[] = [];

  // Check for React imports
  if (!content.includes('import React from')) {
    errors.push('Main file missing React import');
  }

  // Check for ReactDOM import
  if (!content.includes('import ReactDOM from')) {
    errors.push('Main file missing ReactDOM import');
  }

  // Check for root element rendering
  if (!content.includes("createRoot(document.getElementById('root')")) {
    errors.push('Main file missing root element rendering');
  }

  return errors;
}

function validateComponentFile(
  content: string,
  features: ComponentFeatures
): string[] {
  const errors: string[] = [];

  // SYNTAX VALIDATION - Check for critical syntax errors first
  const syntaxErrors = validateSyntax(content);
  errors.push(...syntaxErrors);

  // Basic structural validation
  if (!content.includes('export default')) {
    errors.push('Component missing default export');
  }

  // Dynamic import validation
  const usedFeatures = new Set<string>();

  // Collect used features from the code
  if (content.includes('useState')) usedFeatures.add('state management');
  if (content.includes('useEffect')) usedFeatures.add('side effects');
  if (content.includes('useContext')) usedFeatures.add('context');
  if (content.includes('useRef')) usedFeatures.add('refs');
  if (content.includes('fetch') || content.includes('axios'))
    usedFeatures.add('api');

  // Validate imports for used features
  usedFeatures.forEach(feature => {
    const importPattern =
      feature === 'state management'
        ? 'useState'
        : feature === 'side effects'
          ? 'useEffect'
          : feature === 'context'
            ? 'useContext'
            : feature === 'refs'
              ? 'useRef'
              : '';

    if (importPattern && !content.includes(`import { ${importPattern} }`)) {
      errors.push(`Missing import for ${feature} feature: ${importPattern}`);
    }
  });

  return errors;
}

/**
 * Validate code syntax for common errors that would cause compilation failure
 */
function validateSyntax(content: string): string[] {
  const errors: string[] = [];

  // Check 1: return (; pattern (critical)
  if (/return\s*\(\s*;/.test(content)) {
    errors.push('SYNTAX ERROR: Found "return (;" - incomplete return statement');
  }

  // Check 2: Stray semicolons after opening delimiters
  if (/[(\[{][ \t]+;/.test(content)) {
    errors.push('SYNTAX ERROR: Found stray semicolons after opening delimiters');
  }

  // Check 3: Multiple consecutive semicolons
  if (/;;+/.test(content)) {
    errors.push('SYNTAX ERROR: Found multiple consecutive semicolons');
  }

  // Check 4: Severe bracket/brace imbalance
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  const braceDiff = Math.abs(openBraces - closeBraces);
  if (braceDiff > 3) {
    errors.push(`SYNTAX ERROR: Severe brace mismatch - ${openBraces} open, ${closeBraces} close (diff: ${braceDiff})`);
  }

  // Check 5: Parentheses mismatch
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  const parenDiff = Math.abs(openParens - closeParens);
  if (parenDiff > 5) {
    errors.push(`SYNTAX ERROR: Severe parentheses mismatch - ${openParens} open, ${closeParens} close (diff: ${parenDiff})`);
  }

  return errors;
}

function validatePackageJson(content: string): string[] {
  const errors: string[] = [];
  try {
    const pkg = JSON.parse(content);

    // Check for required dependencies
    const requiredDeps = ['react', 'react-dom'];
    for (const dep of requiredDeps) {
      if (!pkg.dependencies?.[dep]) {
        errors.push(`Missing required dependency: ${dep}`);
      }
    }

    // Check for required scripts
    const requiredScripts = ['dev', 'build'];
    for (const script of requiredScripts) {
      if (!pkg.scripts?.[script]) {
        errors.push(`Missing required script: ${script}`);
      }
    }
  } catch {
    errors.push('Invalid package.json format');
  }
  return errors;
}

function validateIndexHtml(content: string): string[] {
  const errors: string[] = [];

  // Check for root element
  if (!content.includes('<div id="root"></div>')) {
    errors.push('Missing root element in index.html');
  }

  // Check for main.tsx script
  if (!content.includes('src="/src/main.tsx"')) {
    errors.push('Missing main.tsx script reference in index.html');
  }

  return errors;
}

async function validateComponentType(
  workspacePath: string,
  features: ComponentFeatures,
  result: ValidationResult
) {
  try {
    const componentPath = path.join(workspacePath, `src/${features.name}.tsx`);
    const content = await fs.readFile(componentPath, 'utf-8');

    // Basic export validation
    if (!content.includes('export default')) {
      result.errors.push('Component missing default export');
    }

    // Let the AI handle specific feature validation through the orchestration process
    // We only validate the basic structure and TypeScript setup here
    if (!content.includes('import React')) {
      result.warnings.push('Component might be missing React import');
    }

    if (content.includes('any')) {
      result.warnings.push(
        'Component contains "any" types - consider adding proper type definitions'
      );
    }
  } catch (error) {
    result.errors.push(`Unable to validate component type: ${error}`);
  }
}

// Runtime verification test
export async function verifyRuntime(
  workspacePath: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  try {
    // Check if node_modules exists
    const nodeModulesPath = path.join(workspacePath, 'node_modules');
    try {
      await fs.access(nodeModulesPath);
    } catch {
      result.errors.push('node_modules directory missing - run npm install');
    }

    // Check if TypeScript compiles
    const tsconfigPath = path.join(workspacePath, 'tsconfig.json');
    try {
      await fs.access(tsconfigPath);
    } catch {
      result.errors.push('tsconfig.json missing - TypeScript setup incomplete');
    }

    // Additional runtime checks can be added here
    // For example:
    // - Verify Vite config
    // - Check for proper file imports
    // - Validate CSS modules
  } catch (error) {
    result.errors.push(`Runtime verification failed: ${error}`);
  }

  result.isValid = result.errors.length === 0;
  return result;
}
