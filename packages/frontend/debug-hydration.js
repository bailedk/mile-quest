const { chromium } = require('playwright');

async function debugHydrationErrors() {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  // Collect all page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  // Collect response errors
  const responseErrors = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      responseErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  // Navigate to the page
  console.log('Loading http://localhost:3000...');
  
  try {
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait a bit for any delayed errors
    await page.waitForTimeout(3000);
    
    // Get the page content
    const pageTitle = await page.title();
    const pageURL = page.url();
    
    console.log('\n=== Page Load Summary ===');
    console.log('Title:', pageTitle);
    console.log('URL:', pageURL);
    
    // Print console messages
    if (consoleMessages.length > 0) {
      console.log('\n=== Console Messages ===');
      consoleMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text}`);
        if (msg.location) {
          console.log(`  at ${msg.location.url}:${msg.location.lineNumber}`);
        }
      });
    }
    
    // Print page errors
    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(error => {
        console.log('Error:', error.message);
        if (error.stack) {
          console.log('Stack:', error.stack);
        }
      });
    }
    
    // Print response errors
    if (responseErrors.length > 0) {
      console.log('\n=== Response Errors ===');
      responseErrors.forEach(error => {
        console.log(`${error.status} ${error.statusText}: ${error.url}`);
      });
    }
    
    // Check for React hydration errors specifically
    const hydrationErrors = await page.evaluate(() => {
      const errors = [];
      const errorElements = document.querySelectorAll('[data-nextjs-error]');
      errorElements.forEach(el => {
        errors.push(el.textContent);
      });
      
      // Check for React error overlay
      const overlay = document.querySelector('#__next-build-error');
      if (overlay) {
        errors.push('Next.js build error overlay present');
      }
      
      return errors;
    });
    
    if (hydrationErrors.length > 0) {
      console.log('\n=== Hydration Errors ===');
      hydrationErrors.forEach(error => console.log(error));
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'initial-page-load.png', fullPage: true });
    console.log('\nScreenshot saved as initial-page-load.png');
    
    // Try to navigate to dashboard without auth
    console.log('\n=== Testing Dashboard Navigation ===');
    await page.goto('http://localhost:3000/dashboard', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.waitForTimeout(2000);
    
    const dashboardURL = page.url();
    console.log('Dashboard navigation resulted in URL:', dashboardURL);
    
    // Keep browser open for manual inspection
    console.log('\nBrowser will stay open for manual inspection. Press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('Error during page load:', error);
  }
}

debugHydrationErrors().catch(console.error);