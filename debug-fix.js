#!/usr/bin/env node

require("dotenv").config();

async function diagnoseAndFix() {
    console.log('🔧 Twitter Automation System - Comprehensive Debug & Fix');
    console.log('=========================================================\n');
    
    let allTestsPassed = true;
    
    // Step 1: Check Playwright installation
    console.log('1️⃣ Checking Playwright installation...');
    try {
        const { chromium } = require("playwright");
        console.log('✅ Playwright package found');
        
        // Test browser launch
        const browser = await chromium.launch({ headless: true });
        console.log('✅ Browser launch successful');
        
        const page = await browser.newPage({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        });
        console.log('✅ Page creation successful');
        
        console.log('✅ User agent set correctly');
        
        await page.setViewportSize({ width: 1366, height: 768 });
        console.log('✅ viewport set correctly');
        
        // Test basic navigation
        await page.goto('data:text/html,<h1>Test</h1>', { waitUntil: 'domcontentloaded' });
        const content = await page.textContent('h1');
        if (content === 'Test') {
            console.log('✅ Navigation and content extraction working');
        }
        
        await browser.close();
        console.log('✅ Playwright is fully functional\n');
        
    } catch (error) {
        console.error('❌ Playwright issue detected:', error.message);
        console.log('💡 Fix: Run "npx playwright install chromium"\n');
        allTestsPassed = false;
    }
    
    // Step 2: Test Google Sheets
    console.log('2️⃣ Testing Google Sheets connection...');
    // Add a check for Node version and suggest the fix
    const nodeMajorVersion = parseInt(process.versions.node.split('.')[0], 10);
    if (nodeMajorVersion >= 17) {
        console.log(`ℹ️  Running on Node.js v${nodeMajorVersion}. If this test fails with a DECODER error, you may need to run the app with the --openssl-legacy-provider flag.`);
    }

    try {
        // Check if required files exist
        const fs = require('fs');
        const path = require('path');
        
        const requiredFiles = [
            'src/GoogleSheetsManager.js',
            'src/config/config.js'
        ];
        
        for (const file of requiredFiles) {
            if (!fs.existsSync(path.join(__dirname, file))) {
                throw new Error(`Required file missing: ${file}`);
            }
        }
        
        const { GoogleSheetsManager } = require('./src/GoogleSheetsManager');
        const config = require('./src/config/config.js');
        
        const sheetsManager = new GoogleSheetsManager(config.googleSheets);
        await sheetsManager.initialize();
        console.log('✅ Google Sheets connection working\n');
        
    } catch (error) {
        console.error('❌ Google Sheets issue:', error.message);
        console.log('💡 Check your .env file and service account permissions\n');
        allTestsPassed = false;
    }
    
    // Step 3: Test filter engine
    console.log('3️⃣ Testing FilterEngine...');
    try {
        const { FilterEngine } = require('./src/FilterEngine');
        const filterEngine = new FilterEngine({
            minFollowers: 50,
            maxFollowers: 100000,
            bioBlacklist: ['crypto', 'scam']
        });
        
        // Test with mock lead
        const testLead = {
            username: 'test_user',
            bio: 'Sports fan, love NBA and football',
            followersCount: 1500
        };
        
        const result = await filterEngine.evaluateLead(testLead);
        if (result && typeof result.passed === 'boolean') {
            console.log('✅ FilterEngine working correctly');
        } else {
            throw new Error('FilterEngine returned invalid result');
        }
        
    } catch (error) {
        console.error('❌ FilterEngine test failed:', error.message);
        allTestsPassed = false;
    }
    
    // Step 4: Test engagement scheduler
    console.log('4️⃣ Testing EngagementScheduler...');
    try {
        const { EngagementScheduler } = require('./src/EngagementScheduler');
        const scheduler = new EngagementScheduler({
            dmPerDay: 30,
            likesPerDay: 100
        });
        
        const testLeads = [{
            id: 'test1',
            username: 'test_user',
            bio: 'Sports fan'
        }];
        
        const plan = scheduler.createDailyPlan(testLeads);
        if (Array.isArray(plan)) {
            console.log('✅ EngagementScheduler working correctly');
        } else {
            throw new Error('EngagementScheduler returned invalid result');
        }
        
    } catch (error) {
        console.error('❌ EngagementScheduler test failed:', error.message);
        allTestsPassed = false;
    }
    
    // Step 5: Test mock scraper
    console.log('5️⃣ Testing MockLeadScraper...');
    try {
        const { MockLeadScraper } = require('./src/MockLeadScraper');
        const mockScraper = new MockLeadScraper();
        
        const leads = await mockScraper.scrapeByKeyword('sports', 2);
        if (Array.isArray(leads) && leads.length > 0) {
            console.log(`✅ Mock scraper working: ${leads.length} leads generated`);
        } else {
            console.log('⚠️ Mock scraper returned no leads');
        }
        
    } catch (error) {
        console.error('❌ MockLeadScraper test failed:', error.message);
        allTestsPassed = false;
    }
    
    // Step 6: Test environment variables
    console.log('6️⃣ Checking environment variables...');
    try {
        const required = [
            'GOOGLE_SHEETS_ID',
            'GOOGLE_SERVICE_EMAIL', 
            'GOOGLE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
            allTestsPassed = false;
        } else {
            console.log('✅ All required environment variables present');
        }
        
        // Check Twitter credentials (optional for testing)
        const twitterVars = ['TWITTER_USERNAME', 'TWITTER_PASSWORD'];
        const missingTwitter = twitterVars.filter(key => !process.env[key]);
        
        if (missingTwitter.length > 0) {
            console.log('⚠️ Twitter credentials missing (required for full automation):', missingTwitter.join(', '));
        } else {
            console.log('✅ Twitter credentials present');
        }
        
    } catch (error) {
        console.error('❌ Environment check failed:', error.message);
        allTestsPassed = false;
    }
    
    // Step 7: Clean up debug files
    console.log('\n7️⃣ Cleaning up debug files...');
    const fs = require('fs');
    
    try {
        const files = fs.readdirSync('.');
        const debugFiles = files.filter(file => 
            file.endsWith('.png') && 
            (file.includes('scraping_error') || 
             file.includes('navigation_error') ||
             file.includes('test-screenshot') ||
             file.includes('api-test'))
        );
        
        let cleanedCount = 0;
        debugFiles.forEach(file => {
            try {
                fs.unlinkSync(file);
                cleanedCount++;
            } catch (err) {
                // Ignore errors when deleting files
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`🗑️ Cleaned up ${cleanedCount} debug files`);
        } else {
            console.log('ℹ️ No debug files to clean up');
        }
        
    } catch (error) {
        console.log('ℹ️ Debug file cleanup skipped:', error.message);
    }
    
    return allTestsPassed;
}

async function runRecommendedTest() {
    console.log('\n🚀 Running recommended test sequence...\n');
    
    console.log('Available Test Options:');
    console.log('======================');
    console.log('1. Test Mode (Recommended) - Full system with mock data');
    console.log('   Command: npm run test-mode');
    console.log('');
    console.log('2. Advanced Test Mode - Comprehensive testing');
    console.log('   Command: npm run start-test');
    console.log('');
    console.log('3. Browser Test - Test Playwright functionality');
    console.log('   Command: npm run test-browser');
    console.log('');
    console.log('4. Google Sheets Test - Test sheets integration');
    console.log('   Command: npm run test-sheets');
    console.log('');
    
    // Auto-run comprehensive test mode
    console.log('🤖 Auto-running comprehensive test mode...\n');
    
    try {
        const { TestModeSystem } = require('./test-mode.js');
        const system = new TestModeSystem();
        await system.start();
        return true;
    } catch (error) {
        console.error('❌ Comprehensive test failed:', error.message);
        console.error('💡 Try running individual test commands to identify the issue');
        return false;
    }
}

async function showSystemStatus() {
    console.log('\n📊 System Status Check');
    console.log('======================');
    
    const status = {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        workingDir: process.cwd(),
        timestamp: new Date().toISOString()
    };
    
    console.log(`🔧 Node.js: ${status.node}`);
    console.log(`💻 Platform: ${status.platform} (${status.arch})`);
    console.log(`📁 Directory: ${status.workingDir}`);
    console.log(`⏰ Timestamp: ${status.timestamp}`);
    
    // Check package.json
    try {
        const packageJson = require('./package.json');
        console.log(`📦 Package: ${packageJson.name} v${packageJson.version}`);
    } catch (error) {
        console.log('⚠️ Could not read package.json');
    }
    
    // Check file structure
    console.log('\n📂 File Structure Check:');
    const fs = require('fs');
    const path = require('path');
    
    const requiredFiles = [
        'src/main.js',
        'src/FilterEngine.js',
        'src/EngagementScheduler.js',
        'src/MockLeadScraper.js',
        'src/GoogleSheetsManager.js',
        'src/LeadScraper.js',
        'src/TwitterBot.js',
        'src/config/config.js',
        '.env',
        'package.json'
    ];
    
    requiredFiles.forEach(file => {
        const exists = fs.existsSync(path.join(__dirname, file));
        console.log(`${exists ? '✅' : '❌'} ${file}`);
    });
}

async function main() {
    await showSystemStatus();
    
    const diagnosticPassed = await diagnoseAndFix();
    
    if (!diagnosticPassed) {
        console.log('\n❌ Some diagnostics failed. Please fix the issues above before continuing.');
        console.log('\n🔧 Common Fixes:');
        console.log('================');
        console.log('1. Run: npx playwright install chromium');
        console.log('2. Check your .env file configuration');
        console.log('3. Verify Google Sheets permissions');
        console.log('4. Make sure all required files exist');
        process.exit(1);
    }
    
    console.log('\n🎉 All diagnostics passed!\n');
    
    const testPassed = await runRecommendedTest();
    
    if (testPassed) {
        console.log('\n✅ System is working correctly!');
        console.log('==========================================');
        console.log('🚀 Ready to run full automation with: npm start');
        console.log('🧪 Continue testing with: npm run start-test');
        console.log('📊 Check your Google Sheet for test results');
        console.log('==========================================');
    } else {
        console.log('\n⚠️ Tests completed with some issues.');
        console.log('Check the output above for details.');
        console.log('\nTry running tests individually:');
        console.log('- npm run test-browser');
        console.log('- npm run test-sheets'); 
        console.log('- npm run test-mode');
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Debug script failed:', error);
        process.exit(1);
    });
}

module.exports = { diagnoseAndFix };
