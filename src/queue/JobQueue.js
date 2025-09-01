const Bull = require("bull");
const Redis = require("ioredis");

class JobQueue {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
        
        this.scrapingQueue = new Bull("scraping", { redis: this.redis });
        this.dmQueue = new Bull("dm-sending", { redis: this.redis });
        this.engagementQueue = new Bull("engagement", { redis: this.redis });
        
        this.setupProcessors();
    }

    setupProcessors() {
        // Scraping job processor
        this.scrapingQueue.process("scrape-keyword", 3, async (job) => {
            const { keyword, limit } = job.data;
            const scraper = new LeadScraper();
            
            job.progress(0);
            const leads = await scraper.scrapeByKeyword(keyword, limit);
            job.progress(100);
            
            return { scrapedCount: leads.length, leads };
        });

        // DM sending processor
        this.dmQueue.process("send-dm", 1, async (job) => {
            const { lead, message } = job.data;
            const twitterBot = new TwitterBot(config.twitter);
            
            await twitterBot.initialize();
            await twitterBot.sendDM(lead.username, message);
            await twitterBot.close();
            
            return { success: true, leadId: lead.id };
        });

        // Engagement processor
        this.engagementQueue.process("engagement", 2, async (job) => {
            const { action, lead } = job.data;
            const twitterBot = new TwitterBot(config.twitter);
            
            await twitterBot.initialize();
            
            switch (action.type) {
                case "like":
                    await twitterBot.likePost(action.postUrl);
                    break;
                case "retweet":
                    await twitterBot.retweetPost(action.postUrl);
                    break;
                case "comment":
                    await twitterBot.commentOnPost(action.postUrl, action.comment);
                    break;
            }
            
            await twitterBot.close();
            return { success: true, action: action.type };
        });
    }

    async addScrapingJob(keyword, limit = 50, delay = 0) {
        return await this.scrapingQueue.add("scrape-keyword", 
            { keyword, limit }, 
            { 
                delay,
                attempts: 3,
                backoff: { type: "exponential", delay: 2000 }
            }
        );
    }

    async addDMJob(lead, message, delay = 0) {
        return await this.dmQueue.add("send-dm", 
            { lead, message }, 
            { 
                delay,
                attempts: 2,
                backoff: { type: "fixed", delay: 30000 }
            }
        );
    }

    async getQueueStats() {
        const stats = {};
        
        for (const [name, queue] of Object.entries({
            scraping: this.scrapingQueue,
            dm: this.dmQueue,
            engagement: this.engagementQueue
        })) {
            stats[name] = {
                waiting: await queue.getWaiting(),
                active: await queue.getActive(),
                completed: await queue.getCompleted(),
                failed: await queue.getFailed()
            };
        }
        
        return stats;
    }
}

