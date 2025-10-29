/**
 * Test script to verify AgentSelector complexity detection
 */

// Mock AgentSelector class for testing
class AgentSelector {
  assessComplexity(prompt) {
    const promptLower = prompt.toLowerCase();
    let complexityScore = 0;

    // App/System keywords - indicates full application (high weight)
    const appWords = ['app', 'application', 'system', 'platform', 'website', 'site'];
    appWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) {
        complexityScore += 4;
        console.log(`  ✓ Found app word: "${word}" (+4)`);
      }
    });

    // Business domain complexity (high weight)
    const domainWords = ['economy', 'finance', 'budget', 'expense', 'invoice', 'payment', 'transaction', 'savings', 'spending', 'accounting', 'billing', 'tracking', 'tracker'];
    domainWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) {
        complexityScore += 3;
        console.log(`  ✓ Found domain word: "${word}" (+3)`);
      }
    });

    // Multiple features/sections
    const featureWords = ['and', 'also', 'with', 'including', 'plus'];
    featureWords.forEach(word => {
      if (promptLower.includes(word)) {
        complexityScore += 1;
        console.log(`  ✓ Found feature word: "${word}" (+1)`);
      }
    });

    // State management keywords
    const stateWords = ['state', 'data', 'store', 'persist', 'save', 'database', 'api', 'backend'];
    stateWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) {
        complexityScore += 2;
        console.log(`  ✓ Found state word: "${word}" (+2)`);
      }
    });

    // Complex UI keywords
    const uiWords = ['dashboard', 'chart', 'graph', 'visualization', 'animation', '3d', 'analytics'];
    uiWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) {
        complexityScore += 2;
        console.log(`  ✓ Found UI word: "${word}" (+2)`);
      }
    });

    // User interaction complexity
    const interactionWords = ['form', 'input', 'submit', 'validation', 'upload', 'drag', 'filter', 'search'];
    interactionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) {
        complexityScore += 1;
        console.log(`  ✓ Found interaction word: "${word}" (+1)`);
      }
    });

    console.log(`\n  Total Score: ${complexityScore}`);

    // Determine complexity level with adjusted thresholds
    if (complexityScore <= 3) return 'simple';
    if (complexityScore <= 8) return 'moderate';
    return 'complex';
  }
}

// Test prompts
const testCases = [
  {
    name: 'Economy App',
    prompt: 'create an economy spending and savings app',
    expectedComplexity: 'complex'
  },
  {
    name: 'Simple Button',
    prompt: 'create a button component',
    expectedComplexity: 'simple'
  },
  {
    name: 'Budget Dashboard',
    prompt: 'create a budget tracking dashboard with charts and graphs',
    expectedComplexity: 'complex'
  },
  {
    name: 'Todo List',
    prompt: 'create a todo list app with add and delete functionality',
    expectedComplexity: 'moderate'
  },
  {
    name: 'Calculator',
    prompt: 'create a simple calculator',
    expectedComplexity: 'simple'
  }
];

const selector = new AgentSelector();

console.log('🧪 Testing Agent Selection Complexity Detection\n');
console.log('=' .repeat(60));

testCases.forEach(({ name, prompt, expectedComplexity }) => {
  console.log(`\n📝 Test: ${name}`);
  console.log(`Prompt: "${prompt}"`);
  console.log(`Expected: ${expectedComplexity}`);
  console.log('\nAnalysis:');

  const result = selector.assessComplexity(prompt);
  const passed = result === expectedComplexity;

  console.log(`\n${passed ? '✅' : '❌'} Result: ${result} ${passed ? '(PASS)' : '(FAIL)'}`);
  console.log('=' .repeat(60));
});
