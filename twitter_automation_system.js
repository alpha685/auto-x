const { TwitterBot } = require("./src/TwitterBot");
const { LeadScraper } = require("./src/LeadScraper");
const { GoogleSheetsManager } = require("./src/GoogleSheetsManager");
const { FilterEngine } = require("./src/FilterEngine");
const { EngagementScheduler } = require("./src/EngagementScheduler");
const config = require("./config/config.js");

class TwitterAutomationSystem {
    constructor() {
        this.twitterBot = new TwitterBot(config.twitter);
        this.leadScraper = new LeadScraper();
        this.sheetsManager = new GoogleSheetsManager(config.googleSheets);
        this.filterEngine = new FilterEngine(config.filterRules);
        this.scheduler = new EngagementScheduler();
        this.isRunning = false;
    }

    async start() {
        console.log("🚀 Starting Twitter Automation System...");
        this.isRunning = true;
        
        try {
            // Initialize all components
            await this.twitterBot.initialize();
            await this.sheetsManager.initialize();
            
            // Start the main automation loop
            this.runAutomationLoop();
            
        } catch (error) {
            console.error("❌ Failed to start system:", error);
            await this.shutdown();
        }
    }

    async runAutomationLoop() {
        while (this.isRunning) {
            try {
                // Check kill switch
                if (await this.checkKillSwitch()) {
                    console.log("🛑 Kill switch activated. Stopping...");
                    break;
                }

                // Phase 1: Scrape new leads
                await this.scrapingPhase();
                
                // Phase 2: Process and filter leads
                await this.filteringPhase();
                
                // Phase 3: Execute engagement actions
                await this.engagementPhase();
                
                // Wait before next cycle (30 minutes)
                await this.sleep(30 * 60 * 1000);
                
            } catch (error) {
                console.error("❌ Error in automation loop:", error);
                await this.sleep(60000); // Wait 1 minute before retry
            }
        }
    }

    async scrapingPhase() {
        console.log("📊 Starting lead scraping phase...");
        
        const keywords = config.scraping.keywords;
        const newLeads = [];
        
        for (const keyword of keywords) {
            try {
                const leads = await this.leadScraper.scrapeByKeyword(keyword, 50);
                newLeads.push(...leads);
                
                // Random delay between keyword searches
                await this.sleep(this.randomDelay(30000, 60000));
                
            } catch (error) {
                console.error(`❌ Failed to scrape keyword "${keyword}":`, error);
            }
        }
        
        // Log to Google Sheets
        if (newLeads.length > 0) {
            await this.sheetsManager.appendLeads(newLeads);
            console.log(`✅ Scraped ${newLeads.length} new leads`);
        }
    }

    async filteringPhase() {
        console.log("🔍 Starting lead filtering phase...");
        
        // Get unprocessed leads from sheets
        const rawLeads = await this.sheetsManager.getUnfilteredLeads();
        
        for (const lead of rawLeads) {
            const filterResult = await this.filterEngine.evaluateLead(lead);
            await this.sheetsManager.updateLeadStatus(lead.id, filterResult);
        }
        
        console.log(`✅ Filtered ${rawLeads.length} leads`);
    }

    async engagementPhase() {
        console.log("💬 Starting engagement phase...");
        
        // Get leads ready for engagement
        const readyLeads = await this.sheetsManager.getLeadsForEngagement();
        
        // Plan daily activities
        const dailyPlan = this.scheduler.createDailyPlan(readyLeads);
        
        // Execute planned activities
        for (const activity of dailyPlan) {
            try {
                await this.executeActivity(activity);
                await this.sleep(this.randomDelay(60000, 180000)); // 1-3 min between actions
                
            } catch (error) {
                console.error("❌ Activity failed:", error);
                await this.sheetsManager.logError(activity.leadId, error.message);
            }
        }
    }

    async executeActivity(activity) {
        switch (activity.type) {
            case "dm":
                await this.twitterBot.sendDM(activity.username, activity.message);
                await this.sheetsManager.markDMSent(activity.leadId);
                break;
                
            case "like":
                await this.twitterBot.likePost(activity.postUrl);
                break;
                
            case "retweet":
                await this.twitterBot.retweetPost(activity.postUrl);
                break;
                
            case "comment":
                await this.twitterBot.commentOnPost(activity.postUrl, activity.comment);
                break;
        }
        
        console.log(`✅ ${activity.type} completed for @${activity.username}`);
    }

    async checkKillSwitch() {
        // Check a remote endpoint or Google Sheets cell for kill switch
        try {
            const killSwitchValue = await this.sheetsManager.getKillSwitchStatus();
            return killSwitchValue === "STOP";
        } catch {
            return false; // If check fails, continue running
        }
    }

    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async shutdown() {
        console.log("🛑 Shutting down system...");
        this.isRunning = false;
        await this.twitterBot.close();
        await this.sheetsManager.close();
    }
}

// Export main class
module.exports = { TwitterAutomationSystem };

