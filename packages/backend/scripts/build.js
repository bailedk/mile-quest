#!/usr/bin/env node

/**
 * Build script for Lambda functions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Lambda functions to build
const functions = [
  'health',
  'auth',
  'users',
  'teams',
  'activities',
  'dashboard',
];

// Ensure dist directories exist
functions.forEach(func => {
  const dir = path.join(__dirname, '..', 'dist', 'lambda', func);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Build each function
console.log('🚀 Building Lambda functions...\n');

functions.forEach(func => {
  console.log(`📦 Building ${func}...`);
  
  const cmd = `esbuild src/handlers/${func}/index.ts --bundle --platform=node --target=node20 --outfile=dist/lambda/${func}/index.js --external:@aws-sdk/* --external:pg-native --external:@prisma/client --external:.prisma/client`;
  
  try {
    execSync(cmd, { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit' 
    });
    console.log(`✅ ${func} built successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to build ${func}:`, error.message);
    process.exit(1);
  }
});

// Copy Prisma client files to each function
console.log('📋 Copying Prisma client...');
functions.forEach(func => {
  const prismaSource = path.join(__dirname, '..', '..', '..', 'node_modules', '.prisma');
  const prismaDest = path.join(__dirname, '..', 'dist', 'lambda', func, 'node_modules', '.prisma');
  
  if (fs.existsSync(prismaSource)) {
    fs.mkdirSync(path.dirname(prismaDest), { recursive: true });
    fs.cpSync(prismaSource, prismaDest, { recursive: true });
  }
  
  // Also copy @prisma/client
  const prismaClientSource = path.join(__dirname, '..', '..', '..', 'node_modules', '@prisma', 'client');
  const prismaClientDest = path.join(__dirname, '..', 'dist', 'lambda', func, 'node_modules', '@prisma', 'client');
  
  if (fs.existsSync(prismaClientSource)) {
    fs.mkdirSync(path.dirname(prismaClientDest), { recursive: true });
    fs.cpSync(prismaClientSource, prismaClientDest, { recursive: true });
  }
});

console.log('✨ All Lambda functions built successfully!');