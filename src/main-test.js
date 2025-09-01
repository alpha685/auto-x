require("dotenv").config();
const { TwitterBot } = require("./TwitterBot");
const { MockLeadScraper } = require('./MockLeadScraper'); // Use mock instead of real scraper
const { GoogleSheetsManager } = require('./GoogleSheetsManager');
const { FilterEngine } = require('./FilterEngine');
const { EngagementScheduler } = require('./EngagementScheduler');
const config = require('./config/config.js');

class TwitterAutomationSystem {
    constructor() {
        this.twitterBot = null;
        this.leadScraper = new MockLeadScraper(); // Use mock scraper for testing
        this.sheetsManager = new GoogleSheetsManager(config.googleSheets);
        this.filterEngine = new FilterEngine(config.filterRules);
        this.scheduler = new EngagementScheduler();
        this.isRunning = false;
    }

    async start() {
        console.log('🚀 Starting Twitter Automation System (TEST MODE)...');
        console.log('==========================================');
        this.isRunning = true;
        
        try {
            // Initialize components one by one with proper error handling
            await this.initializeComponents();
            
            // Start the main automation loop
            await this.runAutomationLoop();
            
        } catch (error) {
            console.error('❌ Failed to start system:', error.message);
            console.error('Stack trace:', error.stack);
            await this.shutdown();
        }
    }

    async initializeComponents() {
        // 1. Initialize Google Sheets first (fastest and most reliable)
        console.log('📋 Initializing Google Sheets...');
        try {
            await this.sheetsManager.initialize();
            console.log('✅ Google Sheets initialized successfully');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error.message);
            throw new Error(`Google Sheets setup failed: ${error.message}`);
        }

        // 2. Initialize Twitter Bot (only when needed)
        console.log('🔐 Twitter Bot will be initialized when needed for engagement actions');
        console.log('✅ All components ready for operation');
    }

    async ensureTwitterBotReady() {
        if (!this.twitterBot) {
            console.log('🔐 Initializing Twitter Bot for engagement...');
            this.twitterBot = new TwitterBot(config.twitter);
            await this.twitterBot.initialize();
            console.log('✅ Twitter Bot initialized and ready');
        }
        return this.twitterBot;
    }

    async runAutomationLoop() {
        let cycleCount = 0;
        
        while (this.isRunning && cycleCount < 1) { // Only run 1 cycle for testing
            cycleCount++;
            console.log(`\n🔄 Starting automation cycle ${cycleCount}`);
            console.log('==========================================');
            
            try {
                // Check kill switch before each phase
                if (await this.checkKillSwitch()) {
                    console.log('🛑 Kill switch activated. Stopping system...');
                    break;
                }

                // Phase 1: Scrape new leads (using mock data)
                await this.scrapingPhase();
                
                // Check kill switch
                if (await this.checkKillSwitch()) {
                    console.log('🛑 Kill switch activated. Stopping system...');
                    break;
                }
                
                // Phase 2: Process and filter leads (always runs if there are unfiltered leads)
                await this.filteringPhase();
                
                // Check kill switch
                if (await this.checkKillSwitch()) {
                    console.log('🛑 Kill switch activated. Stopping system...');
                    break;
                }
                
                // Phase 3: Execute engagement actions (only show plan, don't execute)
                await this.engagementPhase();
                
                console.log(`✅ Cycle ${cycleCount} completed successfully`);
                
                // Stop after one cycle in test mode
                this.isRunning = false;
                
            } catch (error) {
                console.error(`❌ Error in automation cycle ${cycleCount}:`, error.message);
                console.log('🔄 Waiting 5 minutes before retry...');
                await this.sleep(5 * 60 * 1000); // Wait 5 minutes before retry
            }
        }
    }

    async scrapingPhase() {
        console.log('\n📊 Starting lead scraping phase (MOCK MODE)...');
        console.log('----------------------------------');
        
        const keywords = ['sports', 'NBA', 'basketball']; // Test with fewer keywords
        const newLeads = [];
        
        console.log(`🔍 Will scrape ${keywords.length} keywords: ${keywords.join(', ')}`);
        
        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            
            try {
                console.log(`\n🔍 Scraping keyword ${i + 1}/${keywords.length}: "${keyword}"`);
                
                // Use mock scraper with small limit
                const leads = await this.leadScraper.scrapeByKeyword(keyword, 2);
                
                if (leads && leads.length > 0) {
                    newLeads.push(...leads);
                    console.log(`✅ Found ${leads.length} leads for "${keyword}"`);
                } else {
                    console.log(`ℹ️ No leads found for "${keyword}"`);
                }
                
                // Small delay between keyword searches
                if (i < keywords.length - 1) {
                    const delay = 2000; // 2 seconds for testing
                    console.log(`⏳ Waiting ${Math.floor(delay / 1000)} seconds before next keyword...`);
                    await this.sleep(delay);
                }
                
            } catch (error) {
                console.error(`❌ Failed to scrape keyword "${keyword}":`, error.message);
                // Continue with next keyword instead of failing completely
            }
        }
        
        // Log to Google Sheets
        if (newLeads.length > 0) {
            try {
                console.log(`\n📝 Adding ${newLeads.length} leads to Google Sheets...`);
                await this.sheetsManager.appendLeads(newLeads);
                console.log(`✅ Successfully added ${newLeads.length} new leads to sheets`);
            } catch (error) {
                console.error('❌ Failed to save leads to Google Sheets:', error.message);
            }
        } else {
            console.log('ℹ️ No new leads found in this scraping cycle');
        }
        
        console.log('📊 Scraping phase completed');
    }

    async filteringPhase() {
        console.log('\n🔍 Starting lead filtering phase...');
        console.log('----------------------------------');
        
        try {
            // Get unprocessed leads from sheets
            const rawLeads = await this.sheetsManager.getUnfilteredLeads();
            console.log(`📋 Found ${rawLeads.length} leads to filter`);
            
            if (rawLeads.length === 0) {
                console.log('ℹ️ No leads need filtering at this time');
                return;
            }
            
            let passedCount = 0;
            let failedCount = 0;
            
            for (let i = 0; i < rawLeads.length; i++) {
                const lead = rawLeads[i];
                
                try {
                    const filterResult = await this.filterEngine.evaluateLead(lead);
                    await this.sheetsManager.updateLeadStatus(lead.id, filterResult);
                    
                    if (filterResult.passed) {
                        passedCount++;
                        console.log(`✅ @${lead.username}: PASS`);
                    } else {
                        failedCount++;
                        console.log(`❌ @${lead.username}: FAIL - ${filterResult.reason}`);
                    }
                } catch (error) {
                    console.error(`❌ Error filtering @${lead.username}:`, error.message);
                }
                
                // Small delay between filter operations
                if (i < rawLeads.length - 1) {
                    await this.sleep(100);
                }
            }
            
            console.log(`✅ Filtering completed: ${passedCount} passed, ${failedCount} failed`);
            
        } catch (error) {
            console.error('❌ Error in filtering phase:', error.message);
        }
    }

    async engagementPhase() {
        console.log('\n💬 Starting engagement phase (PREVIEW MODE)...');
        console.log('----------------------------------');
        
        try {
            // Get leads ready for engagement
            const readyLeads = await this.sheetsManager.getLeadsForEngagement();
            console.log(`📋 Found ${readyLeads.length} leads ready for engagement`);
            
            if (readyLeads.length === 0) {
                console.log('ℹ️ No leads ready for engagement at this time');
                return;
            }
            
            // Plan daily activities
            const dailyPlan = this.scheduler.createDailyPlan(readyLeads);
            console.log(`📅 Created engagement plan with ${dailyPlan.length} activities`);
            
            // Show planned activities (don't execute in test mode)
            const activitiesToShow = dailyPlan.slice(0, 5); // Show first 5 activities
            
            if (activitiesToShow.length === 0) {
                console.log('ℹ️ No activities scheduled for execution');
                return;
            }
            
            console.log('\n🎯 PLANNED ACTIVITIES (PREVIEW ONLY):');
            console.log('=====================================');
            
            for (let i = 0; i < activitiesToShow.length; i++) {
                const activity = activitiesToShow[i];
                
                console.log(`\n${i + 1}. ${activity.type.toUpperCase()} for @${activity.username}`);
                
                if (activity.type === 'dm' && activity.message) {
                    console.log(`   📨 Message: "${activity.message}"`);
                } else if (activity.type === 'comment' && activity.comment) {
                    console.log(`   💬 Comment: "${activity.comment}"`);
                } else if (activity.postUrl) {
                    console.log(`   🔗 Post URL: ${activity.postUrl}`);
                }
                
                console.log(`   ⏰ Scheduled: ${new Date(activity.scheduledTime).toLocaleTimeString()}`);
                console.log(`   🎯 Priority: ${activity.priority}`);
            }
            
            console.log('\n💡 In TEST MODE - no actual engagement performed');
            console.log('   To run actual engagement, use the full system with real Twitter login');
            console.log('💬 Engagement phase completed (preview only)');
            
        } catch (error) {
            console.error('❌ Error in engagement phase:', error.message);
        }
    }

    async executeActivity(activity, twitterBot) {
        // This method would be used in real mode
        switch (activity.type) {
            case 'dm':
                await twitterBot.sendDM(activity.username, activity.message);
                await this.sheetsManager.markDMSent(activity.leadId);
                break;
                
            case 'like':
                if (activity.postUrl) {
                    await twitterBot.likePost(activity.postUrl);
                }
                break;
                
            case 'retweet':
                if (activity.postUrl) {
                    await twitterBot.retweetPost(activity.postUrl);
                }
                break;
                
            case 'comment':
                if (activity.postUrl && activity.comment) {
                    await twitterBot.commentOnPost(activity.postUrl, activity.comment);
                }
                break;
                
            default:
                console.log(`⚠️ Unknown activity type: ${activity.type}`);
        }
    }

    async checkKillSwitch() {
        try {
            const killSwitchValue = await this.sheetsManager.getKillSwitchStatus();
            if (killSwitchValue === 'STOP') {
                console.log('🛑 Kill switch is set to STOP');
                return true;
            } else if (killSwitchValue === 'PAUSE') {
                console.log('⏸️ Kill switch is set to PAUSE - waiting...');
                // Wait and check again
                await this.sleep(60000); // Wait 1 minute
                return await this.checkKillSwitch();
            }
            return false;
        } catch (error) {
            console.log('⚠️ Could not check kill switch, continuing operation...', error.message);
            return false; // If check fails, continue running (fail-safe)
        }
    }

    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        console.log('\n🛑 Shutting down Twitter Automation System...');
        console.log('==========================================');
        this.isRunning = false;
        
        try {
            if (this.twitterBot) {
                console.log('🔒 Closing Twitter Bot...');
                await this.twitterBot.close();
                console.log('✅ Twitter Bot closed');
            }
        } catch (error) {
            console.error('❌ Error closing Twitter bot:', error.message);
        }
        
        try {
            if (this.sheetsManager) {
                console.log('📊 Closing Google Sheets connection...');
                await this.sheetsManager.close();
                console.log('✅ Google Sheets closed');
            }
        } catch (error) {
            console.error('❌ Error closing Sheets manager:', error.message);
        }
        
        console.log('✅ System shutdown complete');
        console.log('==========================================');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT (Ctrl+C), shutting down gracefully...');
    if (global.automationSystem) {
        await global.automationSystem.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    if (global.automationSystem) {
        await global.automationSystem.shutdown();
    }
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Export main class
module.exports = { TwitterAutomationSystem };

// Only run if this is the main module
if (require.main === module) {
    console.log('🌟 Twitter Automation System Starting (TEST MODE)...');
    console.log('==========================================');
    console.log('📅 Started at:', new Date().toLocaleString());
    console.log('🔧 Node version:', process.version);
    console.log('📁 Working directory:', process.cwd());
    console.log('🧪 MODE: Testing with Mock Data');
    console.log('==========================================\n');
    
    const system = new TwitterAutomationSystem();
    global.automationSystem = system;
    
    system.start().catch(error => {
        console.error('❌ System startup failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    });
}