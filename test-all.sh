#!/bin/bash

# Comprehensive test script for Mile Quest
# Runs all backend and frontend tests with coverage reporting

set -e

echo "🧪 Mile Quest - Comprehensive Test Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Change to project root
cd "$(dirname "$0")"

# Initialize counters
BACKEND_EXIT_CODE=0
FRONTEND_EXIT_CODE=0
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_status "Starting comprehensive test suite..."

# Backend Tests
echo
print_status "Running Backend Tests (Jest)..."
echo "================================"

cd packages/backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Backend dependencies not found. Installing..."
    npm install
fi

# Run backend tests with coverage
print_status "Executing backend test suite..."
if npm run test:coverage; then
    print_success "Backend tests completed successfully"
    
    # Extract test results
    if [ -f "coverage/coverage-summary.json" ]; then
        print_status "Backend test coverage summary:"
        node -p "
            const coverage = require('./coverage/coverage-summary.json');
            const total = coverage.total;
            console.log('  Lines: ' + total.lines.pct + '%');
            console.log('  Functions: ' + total.functions.pct + '%');
            console.log('  Branches: ' + total.branches.pct + '%');
            console.log('  Statements: ' + total.statements.pct + '%');
        "
    fi
else
    BACKEND_EXIT_CODE=1
    print_error "Backend tests failed"
fi

# Frontend Tests
echo
cd ../frontend

print_status "Running Frontend Tests (Vitest)..."
echo "=================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    npm install
fi

# Run frontend tests with coverage
print_status "Executing frontend test suite..."
if npm run test:coverage; then
    print_success "Frontend tests completed successfully"
    
    # Extract test results if coverage report exists
    if [ -f "coverage/coverage-summary.json" ]; then
        print_status "Frontend test coverage summary:"
        node -p "
            const coverage = require('./coverage/coverage-summary.json');
            const total = coverage.total;
            console.log('  Lines: ' + total.lines.pct + '%');
            console.log('  Functions: ' + total.functions.pct + '%');
            console.log('  Branches: ' + total.branches.pct + '%');
            console.log('  Statements: ' + total.statements.pct + '%');
        "
    fi
else
    FRONTEND_EXIT_CODE=1
    print_error "Frontend tests failed"
fi

# Return to project root
cd ../../

# Generate consolidated test report
echo
print_status "Generating consolidated test report..."
echo "====================================="

# Create test report directory
mkdir -p test-reports

# Generate HTML report
cat > test-reports/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mile Quest - Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .success { background: #e8f5e8; border-color: #4caf50; }
        .error { background: #ffeaea; border-color: #f44336; }
        .coverage { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .coverage-item { padding: 10px; background: #f5f5f5; border-radius: 4px; text-align: center; }
        .metric { font-size: 24px; font-weight: bold; color: #2196F3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Mile Quest - Test Results</h1>
        <p>Generated on $(date)</p>
    </div>
    
    <div class="section $([ $BACKEND_EXIT_CODE -eq 0 ] && echo "success" || echo "error")">
        <h2>Backend Tests (Jest)</h2>
        <p>Status: $([ $BACKEND_EXIT_CODE -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")</p>
        <p>Coverage reports available in: <code>packages/backend/coverage/</code></p>
    </div>
    
    <div class="section $([ $FRONTEND_EXIT_CODE -eq 0 ] && echo "success" || echo "error")">
        <h2>Frontend Tests (Vitest)</h2>
        <p>Status: $([ $FRONTEND_EXIT_CODE -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")</p>
        <p>Coverage reports available in: <code>packages/frontend/coverage/</code></p>
    </div>
    
    <div class="section">
        <h2>Test Categories Covered</h2>
        <ul>
            <li>✅ Backend API Endpoints (Activity CRUD, Team Progress, Dashboard)</li>
            <li>✅ Authentication Middleware & JWT Validation</li>
            <li>✅ Database Services & Aggregation Functions</li>
            <li>✅ Real-time WebSocket Integration</li>
            <li>✅ Frontend Components (Dashboard, Activity Logging, Team Management)</li>
            <li>✅ React Hooks (Real-time Updates, Authentication)</li>
            <li>✅ Integration Tests (Critical User Flows)</li>
            <li>✅ Mobile Optimization Features</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Coverage Goals</h2>
        <div class="coverage">
            <div class="coverage-item">
                <div class="metric">>80%</div>
                <div>Backend Coverage</div>
            </div>
            <div class="coverage-item">
                <div class="metric">>70%</div>
                <div>Frontend Coverage</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>Test Files Created</h2>
        <h3>Backend Tests:</h3>
        <ul>
            <li><code>src/__tests__/utils/test-helpers.ts</code> - Test utilities and mock factories</li>
            <li><code>src/__tests__/handlers/activities.test.ts</code> - Activity CRUD endpoint tests</li>
            <li><code>src/__tests__/services/progress.test.ts</code> - Team progress tracking tests</li>
            <li><code>src/__tests__/handlers/dashboard.test.ts</code> - Dashboard aggregation tests</li>
            <li><code>src/__tests__/middleware/auth.middleware.test.ts</code> - Authentication middleware tests</li>
            <li><code>src/__tests__/services/database-aggregations.test.ts</code> - Database service tests</li>
            <li><code>src/__tests__/jest.setup.ts</code> - Enhanced Jest configuration</li>
        </ul>
        
        <h3>Frontend Tests:</h3>
        <ul>
            <li><code>src/__tests__/utils/test-helpers.tsx</code> - Frontend test utilities</li>
            <li><code>src/__tests__/components/dashboard.test.tsx</code> - Dashboard component tests</li>
            <li><code>src/__tests__/components/activity-logging.test.tsx</code> - Activity form tests</li>
            <li><code>src/__tests__/hooks/realtime-integration.test.tsx</code> - Real-time hook tests</li>
            <li><code>src/__tests__/auth/auth-integration.test.tsx</code> - Authentication tests</li>
            <li><code>src/__tests__/integration/user-flows.test.tsx</code> - End-to-end flow tests</li>
        </ul>
    </div>
</body>
</html>
EOF

print_success "Test report generated: test-reports/index.html"

# Summary
echo
print_status "Test Suite Summary"
echo "=================="

if [ $BACKEND_EXIT_CODE -eq 0 ] && [ $FRONTEND_EXIT_CODE -eq 0 ]; then
    print_success "All tests passed successfully! ✨"
    echo
    echo "📊 Coverage Reports:"
    echo "  Backend:  packages/backend/coverage/lcov-report/index.html"
    echo "  Frontend: packages/frontend/coverage/index.html"
    echo
    echo "📋 Test Report: test-reports/index.html"
    echo
    echo "🎯 Next Steps:"
    echo "  1. Review coverage reports to identify any gaps"
    echo "  2. Add tests for any uncovered critical paths"
    echo "  3. Set up CI/CD pipeline to run these tests automatically"
    echo "  4. Configure test quality gates for pull requests"
    
    exit 0
else
    print_error "Some tests failed!"
    echo
    if [ $BACKEND_EXIT_CODE -ne 0 ]; then
        print_error "Backend tests failed (exit code: $BACKEND_EXIT_CODE)"
    fi
    if [ $FRONTEND_EXIT_CODE -ne 0 ]; then
        print_error "Frontend tests failed (exit code: $FRONTEND_EXIT_CODE)"
    fi
    echo
    echo "🔧 Troubleshooting:"
    echo "  1. Check individual test output above for specific failures"
    echo "  2. Verify all dependencies are installed (npm install)"
    echo "  3. Ensure test environment variables are set correctly"
    echo "  4. Check for any missing mock implementations"
    
    exit 1
fi