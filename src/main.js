// Load environment variables
require("dotenv").config();

// Import configuration and core components
const config = require('./config/config.js');
const { TwitterBot } = require('./TwitterBot.js');
const { LeadScraper } = require('./LeadScraper.js'); // For real mode
const { MockLeadScraper } = require('./mockleadscraper.js'); // For demo mode - FIX: Corrected filename case
const { GoogleSheetsManager } = require('./GoogleSheetsManager.js');
const { FilterEngine } = require('./FilterEngine.js');
const { EngagementScheduler } = require('./EngagementScheduler.js');

class TwitterAutomationSystem {
    constructor(userConfig = {}) {
        // Merge user-provided config with base config
        // This allows the UI to override credentials, keywords, etc.
        const dynamicConfig = { ...config };
        dynamicConfig.twitter.username = userConfig.twitterUsername || config.twitter.username;
        dynamicConfig.twitter.password = userConfig.twitterPassword || config.twitter.password; // FIX: Corrected typo from user-giconfig
        dynamicConfig.scraping.keywords = userConfig.keywords || config.scraping.keywords;
        dynamicConfig.messageTemplates = userConfig.messageTemplates || config.messageTemplates;
        this.isDemo = userConfig.isDemo || false;

        // Initialize all components
        this.scheduler = new EngagementScheduler(dynamicConfig);
        this.filterEngine = new FilterEngine(dynamicConfig.filterRules);
        this.sheetsManager = new GoogleSheetsManager(dynamicConfig.googleSheets);

        // Conditionally initialize scraper and bot based on mode
        if (this.isDemo) {
            console.log("🤖 Running in DEMO MODE. Using mock scraper and skipping login.");
            this.leadScraper = new MockLeadScraper();
            this.twitterBot = null; // No real bot needed for the demo
        } else {
            this.leadScraper = new LeadScraper();
            this.twitterBot = new TwitterBot(dynamicConfig.twitter);
        }

        this.errorCount = 0;
        this.maxErrors = config.errorHandling.circuitBreakerThreshold;
        this.isShuttingDown = false;
    }

    /**
     * Main entry point to start the automation system.
     */
    async start() {
        console.log('🌟 Twitter Automation System Starting (PRODUCTION MODE)...');
        console.log('==========================================');
        console.log(`📅 Started at: ${new Date().toLocaleString()}`); // This will be overwritten by the UI logger
        console.log(`🔧 Node version: ${process.version}`);
        console.log(`📁 Working directory: ${process.cwd()}`);
        console.log(this.isDemo ? '🧪 MODE: Live Web Demo (with mock data)' : '⚠️  MODE: Production (Real Twitter Automation)');
        console.log('==========================================\n');

        try {
            // Validate environment and initialize critical components
            this.validateEnvironment();
            await this.sheetsManager.initialize();

            // Only initialize the real Twitter bot if not in demo mode
            if (!this.isDemo) {
                await this.twitterBot.initialize();
            }

            // Start the main automation loop
            await this.runAutomationLoop();
        } catch (error) {
            // Use console.log for max visibility in logging platforms like Render
            console.log('❌ CRITICAL STARTUP FAILURE. The system will shut down.');
            console.log('Error Message:', error.message);
            console.log('Full Error Stack:', error.stack); // Log the full stack for better debugging
            await this.shutdown();
            process.exit(1);
        }
    }

    /**
     * Validates that all required configuration is present.
     */
    validateEnvironment() {
        console.log('🔍 Validating environment...');
        // The validation is now handled inside config.js,
        // but we can add more checks here if needed.
        console.log('✅ Environment validation passed');
    }

    /**
     * The main continuous loop of the automation system.
     */
    async runAutomationLoop() {
        let cycleCount = 0;
        while (!this.isShuttingDown) {
            cycleCount++;
            console.log(`\n🔄 Starting automation cycle ${cycleCount}`);
            console.log('==========================================');

            try {
                // Helper function to run a phase and check the kill switch
                const runPhase = async (phaseFn, phaseName) => {
                    if (await this.checkKillSwitch()) {
                        console.log(`🛑 Kill switch activated before ${phaseName} phase. Stopping system...`);
                        return true; // Stop the loop
                    }
                    await phaseFn.call(this);
                    return false; // Continue
                };

                if (await runPhase(this.scrapingPhase, 'scraping')) break;
                if (await runPhase(this.filteringPhase, 'filtering')) break;
                if (await runPhase(this.engagementPhase, 'engagement')) break;

                console.log(`✅ Cycle ${cycleCount} completed successfully`);
                this.errorCount = 0; // Reset error count on success

                // Wait before next cycle
                const cycleWaitTime = config.errorHandling.cycleWait;
                console.log(`⏳ Waiting ${cycleWaitTime / 60000} minutes before next cycle...`);
                console.log(`💤 Next cycle will start at: ${new Date(Date.now() + cycleWaitTime).toLocaleTimeString()}`);
                await this.sleep(cycleWaitTime);

            } catch (error) {
                this.errorCount++;
                console.error(`❌ Error in automation cycle ${cycleCount}:`, error.message);

                // If the error is critical (like a permissions issue), stop immediately.
                if (error.message.includes('permission') || error.message.includes('403')) {
                     console.error('🚨 A critical permission error occurred. The system cannot continue.');
                     console.error('💡 Please fix the error reported above and restart the system.');
                     await this.shutdown();
                     break; // Exit the loop
                }

                if (this.errorCount >= this.maxErrors) {
                    console.error(`🚨 Too many consecutive errors (${this.errorCount}). Stopping system for safety.`);
                    await this.shutdown();
                    break;
                }

                const retryDelayTime = config.errorHandling.retryDelay;
                console.log(`🔄 Waiting ${retryDelayTime / 60000} minutes before retry... (Error ${this.errorCount}/${this.maxErrors})`);
                await this.sleep(retryDelayTime);
            }
        }
    }

    /**
     * Phase 1: Scrapes for new leads based on keywords.
     */
    async scrapingPhase() {
        console.log('\n📊 Starting lead scraping phase...');
        console.log('----------------------------------');
        const keywords = config.scraping.keywords;
        const newLeads = [];
        let successfulScrapes = 0;

        console.log(`🔍 Will scrape ${keywords.length} keywords: ${keywords.join(', ')}\n`);

        for (let i = 0; i < keywords.length; i++) {
            const keyword = keywords[i];
            try {
                console.log(`🔍 Scraping keyword ${i + 1}/${keywords.length}: "${keyword}"`);
                let leads;
                if (this.isDemo) {
                    // Mock scraper doesn't need a page object
                    leads = await this.leadScraper.scrapeByKeyword(keyword, config.scraping.leadsPerKeyword || 5);
                } else {
                    leads = await this.leadScraper.scrapeByKeyword(this.twitterBot.page, keyword, config.scraping.leadsPerKeyword || 20);
                }

                if (leads && leads.length > 0) {
                    newLeads.push(...leads);
                    console.log(`✅ Found ${leads.length} leads for "${keyword}"`);
                    successfulScrapes++;
                } else {
                    console.log(`ℹ️ No new leads found for "${keyword}"`);
                }

                // Random delay between keyword searches to avoid rate limits
                if (i < keywords.length - 1) {
                    const minDelay = config.scraping.delayBetweenKeywords.min;
                    const maxDelay = config.scraping.delayBetweenKeywords.max;
                    const delay = this.randomDelay(minDelay, maxDelay);
                    console.log(`⏳ Waiting ${Math.round(delay / 1000)} seconds before next keyword...`);
                    await this.sleep(delay);
                }
            } catch (error) {
                console.error(`❌ Failed to scrape keyword "${keyword}":`, error.message);
            }
        }

        console.log(`\n📈 Scraping Results: ${successfulScrapes}/${keywords.length} keywords successful`);

        // Give the bot a memory: Filter out leads that are already in the sheet.
        const existingUsernames = await this.sheetsManager.getAllUsernames();
        const uniqueNewLeads = newLeads.filter(lead => !existingUsernames.has(lead.username));

        if (uniqueNewLeads.length > 0) {
            try {
                console.log(`\n📝 Found ${newLeads.length} total leads. Adding ${uniqueNewLeads.length} unique new leads to Google Sheets...`);
                await this.sheetsManager.appendLeads(uniqueNewLeads);
                console.log('✅ Successfully added new leads to sheets');
            } catch (error) {
                console.error('❌ Failed to save leads to Google Sheets:', error.message);
                throw error; // Propagate critical error to the main loop
            }
        } else {
            console.log('\nℹ️ No unique new leads found in this scraping cycle.');
        }

        console.log('📊 Scraping phase completed');

        // Add a small delay to allow Google Sheets to process the recent writes
        console.log('⏳ Allowing a moment for Google Sheets to sync...');
        await this.sleep(5000); // 5-second delay
    }

    /**
     * Phase 2: Fetches unfiltered leads from sheets and applies filter rules.
     */
    async filteringPhase() {
        console.log('\n🔍 Starting lead filtering phase...');
        console.log('----------------------------------');
        try {
            const rawLeads = await this.sheetsManager.getUnfilteredLeads();
            if (rawLeads.length === 0) {
                console.log('ℹ️ No leads need filtering at this time');
                return;
            }
            console.log(`📋 Found ${rawLeads.length} leads to filter`);

            let passedCount = 0;
            let failedCount = 0;
            const updates = [];

            for (const lead of rawLeads) {
                try {
                    const filterResult = await this.filterEngine.evaluateLead(lead);
                    updates.push({ rowNumber: lead.id, status: filterResult.passed ? "PASS" : "FAIL", reason: filterResult.reason });

                    if (filterResult.passed) {
                        passedCount++;
                        console.log(`✅ @${lead.username}: PASS`);
                    } else {
                        failedCount++;
                        console.log(`❌ @${lead.username}: FAIL - ${filterResult.reason}`);
                    }
                } catch (error) {
                    console.error(`❌ Error filtering @${lead.username}:`, error.message);
                    updates.push({ rowNumber: lead.id, status: 'ERROR', reason: `Filter error: ${error.message}`.substring(0, 500) });
                }
            }

            if (updates.length > 0) {
                console.log(`\n📝 Batch updating status for ${updates.length} leads in Google Sheets...`);
                await this.sheetsManager.batchUpdateLeadStatuses(updates);
            }

            console.log(`\n✅ Filtering completed: ${passedCount} passed, ${failedCount} failed`);
        } catch (error) {
            console.error('❌ Error in filtering phase:', error.message);
            // Don't throw, allow cycle to continue if possible
        }
    }

    /**
     * Phase 3: Fetches filtered leads and executes engagement actions.
     */
    async engagementPhase() {
        console.log('\n💬 Starting engagement phase...');
        console.log('----------------------------------');
        try {
            const leadsToEngage = await this.sheetsManager.getLeadsForEngagement();
            if (leadsToEngage.length === 0) {
                console.log('ℹ️ No leads ready for engagement at this time');
                return;
            }
            console.log(`📋 Found ${leadsToEngage.length} leads ready for engagement`);

            const dailyPlan = this.scheduler.createDailyPlan(leadsToEngage);
            if (dailyPlan.length === 0) {
                console.log('ℹ️ No activities scheduled based on current rate limits.');
                return;
            }
            console.log(`📅 Created engagement plan with ${dailyPlan.length} activities`);

            // In demo mode, just show the plan and exit the phase
            if (this.isDemo) {
                console.log('\n🎯 PLANNED ACTIVITIES (PREVIEW ONLY):');
                console.log('=====================================');
                const activitiesToShow = dailyPlan.slice(0, 5); // Show first 5
                for (const activity of activitiesToShow) {
                    console.log(`- ${activity.type.toUpperCase()} for @${activity.username}`);
                    if (activity.message) console.log(`  -> Message: "${activity.message.substring(0, 40)}..."`);
                }
                console.log('\n💡 In DEMO MODE - no actual engagement performed.');
                console.log('💬 Engagement phase completed (preview only)');
                return; // Exit phase
            }

            const activitiesToExecute = dailyPlan.slice(0, config.engagement.activitiesPerCycle);
            let successCount = 0;

            for (let i = 0; i < activitiesToExecute.length; i++) {
                const activity = activitiesToExecute[i];
                try {
                    console.log(`\n🎯 Executing ${activity.type} (${i + 1}/${activitiesToExecute.length}) for @${activity.username}`);
                    await this.executeActivity(activity);
                    successCount++;
                    console.log(`✅ ${activity.type} completed for @${activity.username}`);

                    // Random delay between actions to mimic human behavior
                    if (i < activitiesToExecute.length - 1) {
                        const minDelay = config.engagement.humanBehavior.minDelayBetweenActions;
                        const maxDelay = config.engagement.humanBehavior.maxDelayBetweenActions;
                        const delay = this.randomDelay(minDelay, maxDelay);
                        console.log(`⏳ Waiting ${Math.round(delay / 1000)} seconds before next action...`);
                        await this.sleep(delay);
                    }
                } catch (error) {
                    console.error(`❌ Failed to execute ${activity.type} for @${activity.username}:`, error.message);
                    await this.sheetsManager.logError(activity.id, `Engagement error: ${error.message}`);
                }
            }
            console.log(`\n✅ Engagement phase completed: ${successCount}/${activitiesToExecute.length} actions successful.`);
        } catch (error) {
            console.error('❌ Error in engagement phase:', error.message);
        }
    }

    /**
     * Executes a single engagement activity (e.g., send DM).
     * @param {object} activity - The activity to execute.
     */
    async executeActivity(activity) {
        const { type, username, id, message, comment } = activity;
        switch (type) {
            case 'dm':
                await this.twitterBot.sendDM(username, message); // Use the message from the scheduled activity
                await this.sheetsManager.markDMSent(id);
                break;
            case 'like':
            case 'retweet':
            case 'comment':
                const postUrl = await this.twitterBot.getLatestTweetUrl(username);
                if (!postUrl) {
                    console.log(`⚠️ Could not find a recent tweet for @${username}. Skipping action.`);
                    return; // Skip this activity
                }

                if (type === 'like') {
                    await this.twitterBot.likePost(postUrl);
                } else if (type === 'retweet') {
                    await this.twitterBot.retweetPost(postUrl);
                } else if (type === 'comment') {
                    await this.twitterBot.commentOnPost(postUrl, comment);
                }
                break;
            default:
                console.log(`⚠️ Unknown activity type: ${type}`);
        }
    }

    /**
     * Checks the kill switch in the Google Sheet.
     * @returns {Promise<boolean>} - True if the system should stop.
     */
    async checkKillSwitch() {
        const status = await this.sheetsManager.getKillSwitchStatus();
        return status.toUpperCase() !== 'RUN';
    }

    /**
     * Gracefully shuts down the system.
     */
    async shutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        console.log('\n🛑 Shutting down Twitter Automation System...');
        console.log('==========================================');
        if (this.twitterBot) {
            console.log('🔒 Closing Twitter Bot...');
            await this.twitterBot.close();
            console.log('✅ Twitter Bot closed');
        }
        if (this.sheetsManager) {
            console.log('📊 Closing Google Sheets connection...');
            await this.sheetsManager.close();
            console.log('✅ Google Sheets closed');
        }
        console.log('✅ System shutdown complete');
        console.log('==========================================');
    }

    // Helper methods
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

// Main execution block
// The main execution block is now handled by server.js for the web app.

module.exports = { TwitterAutomationSystem };
