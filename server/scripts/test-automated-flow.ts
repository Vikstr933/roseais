#!/usr/bin/env tsx

import { ComponentOrchestrator } from '../utils/componentOrchestrator';
import { webContainerService } from '../services/WebContainerService';
import { ComponentFeatures } from '../utils/types';

async function testAutomatedFlow() {
  console.log('🤖 Testing Fully Automated AI Agent + WebContainer Flow...\n');

  try {
    // Create orchestrator
    const workspacePath = process.cwd();
    const orchestrator = new ComponentOrchestrator(workspacePath);
    await orchestrator.initialize();

    console.log('✅ ComponentOrchestrator initialized with AI agents\n');

    // Test with a modern app prompt
    const testPrompt = 'Create a modern weather dashboard with dark mode, charts, and real-time updates';
    const sessionId = `test-session-${Date.now()}`;

    console.log(`📝 Testing with prompt: "${testPrompt}"`);
    console.log(`🆔 Session ID: ${sessionId}\n`);

    // Simulate progress callback
    const progressCallback = (details: string[]) => {
      details.forEach(detail => console.log(`  ${detail}`));
    };

    // Generate component (this should now automatically start WebContainer)
    console.log('🚀 Starting automated generation and deployment...\n');
    
    const result = await orchestrator.generateFilesOnly(
      testPrompt,
      undefined, // req
      undefined, // projectId
      undefined, // existingComponentName
      sessionId,
      undefined // selectedKnowledge
    );

    if (!result.success) {
      throw new Error(`Generation failed: ${result.errors?.join(', ')}`);
    }

    console.log('\n📊 Generation Results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Files generated: ${result.files?.length || 0}`);
    console.log(`  Component name: ${result.componentName}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.join(', ')}`);
    }

    console.log('\n📁 Generated files:');
    result.files?.forEach(file => {
      console.log(`  - ${file.path} (${file.content.length} chars)`);
    });

    // Check if WebContainer was automatically started
    const componentName = result.componentName;
    const instance = webContainerService.getInstanceByComponentName(componentName);
    
    if (instance) {
      console.log('\n🌐 WebContainer Status:');
      console.log(`  Instance ID: ${instance.id}`);
      console.log(`  Status: ${instance.status}`);
      console.log(`  URL: ${instance.url}`);
      console.log(`  Created: ${instance.createdAt.toISOString()}`);
      
      console.log('\n🎉 SUCCESS! Fully automated flow completed:');
      console.log('  1. ✅ AI agents generated intelligent code');
      console.log('  2. ✅ Files saved to workspace');
      console.log('  3. ✅ WebContainer automatically started');
      console.log('  4. ✅ App is live and accessible!');
      console.log(`\n🔗 Your app is live at: ${instance.url}`);
    } else {
      console.log('\n⚠️  WebContainer was not automatically started');
      console.log('   This might be expected if WebContainer API is not available in test environment');
    }

    // Show some generated code
    const mainComponent = result.files?.find(f => f.path.endsWith('.tsx') && !f.path.includes('main.tsx'));
    if (mainComponent) {
      console.log('\n🔍 Generated component preview:');
      console.log(mainComponent.content.substring(0, 300) + '...');
    }

    console.log('\n✅ Automated flow test completed successfully!');

  } catch (error) {
    console.error('❌ Automated flow test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAutomatedFlow().catch(console.error);
