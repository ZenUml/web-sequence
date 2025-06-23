#!/usr/bin/env node

/**
 * Test script to validate pnpm migration
 * Run with: node test-pnpm-migration.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Testing pnpm migration...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Test 1: Check if pnpm is installed
test('pnpm is installed', () => {
  const version = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  if (!version.startsWith('9.')) {
    throw new Error(`Expected pnpm 9.x, got ${version}`);
  }
});

// Test 2: Check package.json has correct packageManager
test('package.json has correct packageManager', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.packageManager !== 'pnpm@9.15.0') {
    throw new Error(`Expected pnpm@9.15.0, got ${pkg.packageManager}`);
  }
});

// Test 3: Check package.json uses overrides (not resolutions)
test('package.json uses overrides instead of resolutions', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.resolutions) {
    throw new Error('Found old "resolutions" field, should be "overrides"');
  }
  if (!pkg.overrides) {
    throw new Error('Missing "overrides" field');
  }
});

// Test 4: Check volta config
test('volta config updated for pnpm', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.volta || !pkg.volta.pnpm) {
    throw new Error('Missing volta.pnpm configuration');
  }
  if (!pkg.volta.pnpm.startsWith('9.')) {
    throw new Error(`Expected pnpm 9.x in volta, got ${pkg.volta.pnpm}`);
  }
});

// Test 5: Check .npmrc exists
test('.npmrc file exists', () => {
  if (!fs.existsSync('.npmrc')) {
    throw new Error('.npmrc file not found');
  }
});

// Test 6: Check yarn.lock is removed
test('yarn.lock is removed', () => {
  if (fs.existsSync('yarn.lock')) {
    throw new Error('yarn.lock still exists');
  }
});

// Test 7: Check functions package.json
test('functions package.json updated', () => {
  const pkg = JSON.parse(fs.readFileSync('functions/package.json', 'utf8'));
  if (pkg.packageManager !== 'pnpm@9.15.0') {
    throw new Error(`Functions packageManager should be pnpm@9.15.0, got ${pkg.packageManager}`);
  }
});

// Test 8: Check GitHub Actions workflows
test('GitHub Actions use pnpm/action-setup@v4', () => {
  const stagingWorkflow = fs.readFileSync('.github/workflows/deploy-staging.yml', 'utf8');
  const prodWorkflow = fs.readFileSync('.github/workflows/deploy-prod.yml', 'utf8');
  
  if (!stagingWorkflow.includes('pnpm/action-setup@v4')) {
    throw new Error('Staging workflow not using pnpm/action-setup@v4');
  }
  if (!prodWorkflow.includes('pnpm/action-setup@v4')) {
    throw new Error('Production workflow not using pnpm/action-setup@v4');
  }
});

// Test 9: Check documentation updated
test('documentation references pnpm', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  const contributing = fs.readFileSync('CONTRIBUTING.md', 'utf8');
  
  if (readme.includes('yarn install') || readme.includes('yarn start')) {
    throw new Error('README.md still contains yarn references');
  }
  if (contributing.includes('yarn') && !contributing.includes('pnpm')) {
    throw new Error('CONTRIBUTING.md still contains yarn references');
  }
});

// Test 10: Test pnpm install (if node_modules doesn't exist)
test('pnpm install works', () => {
  if (!fs.existsSync('node_modules')) {
    console.log('   Running pnpm install...');
    execSync('pnpm install', { stdio: 'inherit' });
  }
  if (!fs.existsSync('node_modules')) {
    throw new Error('pnpm install failed to create node_modules');
  }
});

// Summary
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Migration validation failed. Please fix the issues above.');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed! pnpm migration successful.');
  console.log('\n📝 Next steps:');
  console.log('   1. Run "pnpm install" to generate pnpm-lock.yaml');
  console.log('   2. Test your development workflow: "pnpm dev"');
  console.log('   3. Test the build process: "pnpm build"');
  console.log('   4. Commit the changes and push to trigger CI/CD');
}