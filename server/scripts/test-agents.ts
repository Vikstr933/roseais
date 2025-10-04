#!/usr/bin/env ts-node

import { OrchestrationAgent } from '../agents/OrchestrationAgent';
import { ComponentFeatures } from '../utils/types';

async function testAgentSystem() {
  console.log('🤖 Testing AI Agent System...\n');

  try {
    // Create and initialize the orchestration agent
    const orchestrationAgent = new OrchestrationAgent();
    await orchestrationAgent.initialize();

    console.log('✅ OrchestrationAgent initialized successfully\n');

    // Test with a simple todo app prompt
    const testPrompt = 'Create a modern todo app with dark mode, animations, and local storage';
    const testFeatures: ComponentFeatures = {
      name: 'ModernTodoApp',
      features: ['todo', 'dark-mode', 'animations', 'local-storage'],
      styling: {
        animations: true,
        theme: 'dark',
      },
    };

    console.log(`📝 Testing with prompt: "${testPrompt}"`);
    console.log(`🎯 Features: ${testFeatures.features.join(', ')}\n`);

    // Execute the orchestration task
    const result = await orchestrationAgent.executeTask({
      prompt: testPrompt,
      features: testFeatures,
      progressCallback: (details) => {
        details.forEach(detail => console.log(`  ${detail}`));
      },
    });

    console.log('\n📊 Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Files generated: ${result.files.length}`);
    console.log(`  Agents used: ${result.agentsUsed.join(', ')}`);
    console.log(`  Component name: ${result.componentName}`);

    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.join(', ')}`);
    }

    if (result.warnings.length > 0) {
      console.log(`  Warnings: ${result.warnings.join(', ')}`);
    }

    console.log('\n📁 Generated files:');
    result.files.forEach(file => {
      console.log(`  - ${file.path} (${file.content.length} chars)`);
    });

    // Test a specific file content
    const mainComponent = result.files.find(f => f.path.endsWith('.tsx') && !f.path.includes('main.tsx'));
    if (mainComponent) {
      console.log('\n🔍 Main component preview:');
      console.log(mainComponent.content.substring(0, 200) + '...');
    }

    console.log('\n✅ Agent system test completed successfully!');

  } catch (error) {
    console.error('❌ Agent system test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAgentSystem().catch(console.error);

export { testAgentSystem };
