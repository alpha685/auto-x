class EngagementScheduler {
    constructor(config = {}) {
        this.rateLimits = {
            dmPerDay: config.rateLimits?.dmPerDay || 30,
            likesPerDay: config.rateLimits?.likesPerDay || 100,
            retweetsPerDay: config.rateLimits?.retweetsPerDay || 50,
            commentsPerDay: config.rateLimits?.commentsPerDay || 20,
            actionsPerHour: config.rateLimits?.actionsPerHour || 15,
            ...config.rateLimits
        };

        this.dailyCounters = {
            dm: 0,
            likes: 0,
            retweets: 0,
            comments: 0,
            lastReset: new Date().toDateString()
        };
        // Use templates from the config file
        this.messageTemplates = config.messageTemplates || [];
        this.commentTemplates = config.engagement?.commentTemplates || [];

        console.log('📅 EngagementScheduler initialized with rate limits:', this.rateLimits);
    }

    createDailyPlan(leads, maxActivities = null) {
        try {
            console.log(`📋 Creating daily engagement plan for ${leads.length} leads`);
            
            if (!Array.isArray(leads) || leads.length === 0) {
                console.log('ℹ️ No leads provided for engagement planning');
                return [];
            }
            
            this.resetDailyCountersIfNeeded();
            
            const activities = [];
            const today = new Date().toDateString();
            
            // Calculate how many activities we can still do today
            const remainingDMs = Math.max(0, this.rateLimits.dmPerDay - this.dailyCounters.dm);
            const remainingLikes = Math.max(0, this.rateLimits.likesPerDay - this.dailyCounters.likes);
            const remainingRetweets = Math.max(0, this.rateLimits.retweetsPerDay - this.dailyCounters.retweets);
            const remainingComments = Math.max(0, this.rateLimits.commentsPerDay - this.dailyCounters.comments);
            
            console.log(`📊 Remaining activities: DMs(${remainingDMs}), Likes(${remainingLikes}), Retweets(${remainingRetweets}), Comments(${remainingComments})`);
            
            // Prioritize DMs as they are most valuable
            let dmCount = 0;
            for (const lead of leads) {
                if (dmCount >= remainingDMs) break;
                
                if (!lead.username) {
                    console.log('⚠️ Skipping lead without username');
                    continue;
                }
                
                const message = this.generatePersonalizedMessage(lead);
                activities.push({
                    type: 'dm',
                    leadId: lead.id,
                    username: lead.username,
                    message: message,
                    scheduledTime: this.getRandomTimeToday(),
                    priority: 1 // Highest priority
                });
                dmCount++;
            }
            
            // Add engagement activities for variety
            let likeCount = 0;
            let retweetCount = 0;
            let commentCount = 0;
            
            for (const lead of leads) {
                if (!lead.username) continue;
                
                // Add likes (most common engagement)
                if (likeCount < remainingLikes && likeCount < leads.length * 2) {
                    activities.push({
                        type: 'like',
                        leadId: lead.id,
                        username: lead.username,
                        postUrl: `https://twitter.com/${lead.username}`, // Would need to find actual recent posts
                        scheduledTime: this.getRandomTimeToday(),
                        priority: 3
                    });
                    likeCount++;
                }
                
                // Add occasional retweets
                if (retweetCount < remainingRetweets && Math.random() < 0.3) {
                    activities.push({
                        type: 'retweet',
                        leadId: lead.id,
                        username: lead.username,
                        postUrl: `https://twitter.com/${lead.username}`,
                        scheduledTime: this.getRandomTimeToday(),
                        priority: 2
                    });
                    retweetCount++;
                }
                
                // Add occasional comments
                if (commentCount < remainingComments && Math.random() < 0.2) {
                    activities.push({
                        type: 'comment',
                        leadId: lead.id,
                        username: lead.username,
                        postUrl: `https://twitter.com/${lead.username}`,
                        comment: this.getRandomComment(),
                        scheduledTime: this.getRandomTimeToday(),
                        priority: 2
                    });
                    commentCount++;
                }
            }
            
            // Sort by priority and then by scheduled time
            activities.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // Lower number = higher priority
                }
                return new Date(a.scheduledTime) - new Date(b.scheduledTime);
            });
            
            // Limit total activities if specified
            const finalActivities = maxActivities ? activities.slice(0, maxActivities) : activities;
            
            console.log(`📅 Created plan with ${finalActivities.length} activities (${dmCount} DMs, ${likeCount} likes, ${retweetCount} retweets, ${commentCount} comments)`);
            return finalActivities;

        } catch (error) {
            console.error('❌ Error creating daily plan:', error.message);
            return [];
        }
    }

    generatePersonalizedMessage(lead) {
        try {
            const template = this.messageTemplates[Math.floor(Math.random() * this.messageTemplates.length)];
            
            // Extract topic from bio or use generic term
            let topic = 'sports';
            if (lead.bio) {
                const bioLower = lead.bio.toLowerCase();
                if (bioLower.includes('nba') || bioLower.includes('basketball')) topic = 'basketball';
                else if (bioLower.includes('football') || bioLower.includes('nfl')) topic = 'football';
                else if (bioLower.includes('soccer') || bioLower.includes('fifa')) topic = 'soccer';
                else if (bioLower.includes('ufc') || bioLower.includes('mma')) topic = 'MMA';
                else if (bioLower.includes('betting') || bioLower.includes('odds')) topic = 'sports betting';
                else if (bioLower.includes('baseball') || bioLower.includes('mlb')) topic = 'baseball';
                else if (bioLower.includes('hockey') || bioLower.includes('nhl')) topic = 'hockey';
            }
            
            return template
                .replace('{username}', lead.username || 'friend')
                .replace('{topic}', topic);

        } catch (error) {
            console.error('❌ Error generating message:', error.message);
            return `Hi ${lead.username || 'there'}! Would love to connect!`;
        }
    }

    getRandomComment() {
        return this.commentTemplates[Math.floor(Math.random() * this.commentTemplates.length)];
    }

    getRandomTimeToday() {
        try {
            const now = new Date();
            const startOfDay = new Date(now);
            startOfDay.setHours(9, 0, 0, 0); // Start at 9 AM
            
            const endOfDay = new Date(now);
            endOfDay.setHours(18, 0, 0, 0); // End at 6 PM
            
            // If it's already past 6 PM, schedule for tomorrow
            if (now > endOfDay) {
                startOfDay.setDate(startOfDay.getDate() + 1);
                endOfDay.setDate(endOfDay.getDate() + 1);
            }
            
            const randomTime = new Date(startOfDay.getTime() + Math.random() * (endOfDay.getTime() - startOfDay.getTime()));
            return randomTime.toISOString();
        } catch (error) {
            console.error('❌ Error generating random time:', error.message);
            // Return a time 1 hour from now as fallback
            return new Date(Date.now() + 60 * 60 * 1000).toISOString();
        }
    }

    resetDailyCountersIfNeeded() {
        try {
            const today = new Date().toDateString();
            if (this.dailyCounters.lastReset !== today) {
                console.log('🔄 Resetting daily activity counters');
                this.dailyCounters = {
                    dm: 0,
                    likes: 0,
                    retweets: 0,
                    comments: 0,
                    lastReset: today
                };
            }
        } catch (error) {
            console.error('❌ Error resetting daily counters:', error.message);
        }
    }

    incrementCounter(activityType) {
        try {
            this.resetDailyCountersIfNeeded();
            
            switch (activityType) {
                case 'dm':
                    this.dailyCounters.dm++;
                    break;
                case 'like':
                    this.dailyCounters.likes++;
                    break;
                case 'retweet':
                    this.dailyCounters.retweets++;
                    break;
                case 'comment':
                    this.dailyCounters.comments++;
                    break;
                default:
                    console.log(`⚠️ Unknown activity type: ${activityType}`);
                    return;
            }
            
            console.log(`📊 Updated counter: ${activityType} = ${this.dailyCounters[activityType]}`);
        } catch (error) {
            console.error('❌ Error incrementing counter:', error.message);
        }
    }

    canPerformActivity(activityType) {
        try {
            this.resetDailyCountersIfNeeded();
            
            switch (activityType) {
                case 'dm':
                    return this.dailyCounters.dm < this.rateLimits.dmPerDay;
                case 'like':
                    return this.dailyCounters.likes < this.rateLimits.likesPerDay;
                case 'retweet':
                    return this.dailyCounters.retweets < this.rateLimits.retweetsPerDay;
                case 'comment':
                    return this.dailyCounters.comments < this.rateLimits.commentsPerDay;
                default:
                    return false;
            }
        } catch (error) {
            console.error('❌ Error checking activity permission:', error.message);
            return false;
        }
    }

    getRemainingActivities() {
        try {
            this.resetDailyCountersIfNeeded();
            
            return {
                dm: Math.max(0, this.rateLimits.dmPerDay - this.dailyCounters.dm),
                likes: Math.max(0, this.rateLimits.likesPerDay - this.dailyCounters.likes),
                retweets: Math.max(0, this.rateLimits.retweetsPerDay - this.dailyCounters.retweets),
                comments: Math.max(0, this.rateLimits.commentsPerDay - this.dailyCounters.comments)
            };
        } catch (error) {
            console.error('❌ Error getting remaining activities:', error.message);
            return { dm: 0, likes: 0, retweets: 0, comments: 0 };
        }
    }

    getHumanLikeDelay() {
        try {
            // Return a delay between 30 seconds to 3 minutes
            const min = 30 * 1000; // 30 seconds
            const max = 3 * 60 * 1000; // 3 minutes
            return Math.floor(Math.random() * (max - min + 1)) + min;
        } catch (error) {
            console.error('❌ Error calculating delay:', error.message);
            return 60 * 1000; // Default to 1 minute
        }
    }

    // Get activity statistics
    getActivityStats() {
        this.resetDailyCountersIfNeeded();
        
        return {
            counters: { ...this.dailyCounters },
            limits: { ...this.rateLimits },
            remaining: this.getRemainingActivities()
        };
    }

    // Validate activity before scheduling
    validateActivity(activity) {
        if (!activity) return false;
        if (!activity.type) return false;
        if (!activity.username) return false;
        if (!activity.leadId) return false;
        
        switch (activity.type) {
            case 'dm':
                return !!activity.message;
            case 'like':
            case 'retweet':
                return !!activity.postUrl;
            case 'comment':
                return !!activity.postUrl && !!activity.comment;
            default:
                return false;
        }
    }
}

module.exports = { EngagementScheduler };