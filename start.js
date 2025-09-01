#!/usr/bin/env node

require("dotenv").config();

async function performStartupChecks() {
    console.log('🔍 Performing startup checks...');
    console.log('==========================================');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    console.log(`📦 Node.js version: ${nodeVersion}`);
    if (majorVersion < 16) {
        console.error('❌ Node.js version 16 or higher is required');
        process.exit(1);
    }
    console.log('✅ Node.js version is compatible');
    
    // Check environment variables
    console.log('\n🔐 Checking environment variables...');
    const requiredVars = [
        'TWITTER_USERNAME',
        'TWITTER_PASSWORD', 
        'GOOGLE_SHEETS_ID',
        'GOOGLE_SERVICE_EMAIL',
        'GOOGLE_PRIVATE_KEY'
    ];
    
    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing environment variables:');
        missing.forEach(key => console.error(`   - ${key}`));
        console.error('\nPlease check your .env file');
        return false;
    }
    console.log('✅ All environment variables present');
    
    // Test Google Sheets connection
    console.log('\n📊 Testing Google Sheets connection...');
    try {
        const { testGoogleSheetsV4 } = require('./test_sheet.js');
        const sheetsWorking = await testGoogleSheetsV4();
        
        if (!sheetsWorking) {
            console.error('❌ Google Sheets connection failed');
            return false;
        }
        console.log('✅ Google Sheets connection successful');
        
    } catch (error) {
        console.error('❌ Google Sheets test failed:', error.message);
        return false;
    }
    
    // Check if Playwright browsers are installed
    console.log('\n🎭 Checking Playwright installation...');
    try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        await browser.close();
        console.log('✅ Playwright browsers are working');
    } catch (error) {
        console.error('❌ Playwright issue:', error.message);
        console.log('💡 Try running: npx playwright install chromium');
        return false;
    }
    
    return true;
}

async function main() {
    console.log('🌟 Twitter Automation System - Startup Checks');
    console.log('==============================================');
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log('==============================================\n');
    
    const checksPass = await performStartupChecks();
    
    if (!checksPass) {
        console.log('\n❌ Startup checks failed. Please fix the issues above before running the system.');
        process.exit(1);
    }
    
    console.log('\n🎉 All startup checks passed!');
    console.log('==========================================');
    
    // Ask user if they want to start the system
    console.log('\nOptions:');
    console.log('1. Start the full automation system (npm start)');
    console.log('2. Run in test mode (limited scraping)');
    console.log('3. Exit');
    
    // For now, we'll just start the system
    console.log('\n🚀 Starting the Twitter Automation System...');
    console.log('==========================================\n');
    
    try {
        const { TwitterAutomationSystem } = require('./src/main.js');
        const system = new TwitterAutomationSystem();
        
        // Set up global reference for graceful shutdown
        global.automationSystem = system;
        
        await system.start();
    } catch (error) {
        console.error('❌ Failed to start system:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    if (global.automationSystem) {
        await global.automationSystem.shutdown();
    }
    process.exit(0);
});

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Startup failed:', error);
        process.exit(1);
    });
}

module.exports = { performStartupChecks };