class FilterEngine {
    constructor(rules = {}) {
        this.rules = {
            minFollowers: rules.minFollowers || 50,
            maxFollowers: rules.maxFollowers || 100000,
            preFilterCheckDMs: rules.preFilterCheckDMs !== false, // Default to true
            failIfVerified: rules.failIfVerified !== false, // Default to true
            bioBlacklist: rules.bioBlacklist || [
                'crypto', 'NFT', 'bitcoin', 'forex', 'trading',
                'investment advice', 'not seeking opportunities',
                'no DMs', 'DM = block', 'scam', 'bot', 'spam',
                'mlm', 'pyramid', 'get rich quick'
            ],
            bioWhitelist: rules.bioWhitelist || [],
            ...rules
        };
        this.twitterBot = null; // Will be set by the main system
        console.log('🔍 FilterEngine initialized with rules:', {
            minFollowers: this.rules.minFollowers,
            maxFollowers: this.rules.maxFollowers,
            blacklistCount: this.rules.bioBlacklist.length,
            whitelistCount: this.rules.bioWhitelist.length
        });
    }

    setTwitterBot(bot) {
        this.twitterBot = bot;
    }

    async evaluateLead(lead) {
        try {
            console.log(`🔍 Evaluating lead: @${lead.username || 'unknown'}`);
            
            // Validate input
            if (!lead) {
                return {
                    passed: false,
                    reason: 'Lead data is null or undefined'
                };
            }

            // Check if username exists
            if (!lead.username || lead.username.trim() === '') {
                return {
                    passed: false,
                    reason: 'Username is missing or empty'
                };
            }

            // Check verification status if the rule is enabled
            if (this.rules.failIfVerified && lead.isVerified) {
                return {
                    passed: false,
                    reason: 'User is verified'
                };
            }

            // Check follower count
            const followersCount = parseInt(lead.followersCount) || 0;
            
            // If follower count is 0, it's likely a scraping issue. Let it pass this check
            // and rely on other filters. Only fail if it's a non-zero value below the minimum.
            if (followersCount > 0 && followersCount < this.rules.minFollowers) {
                return {
                    passed: false,
                    reason: `Too few followers: ${followersCount} < ${this.rules.minFollowers}`
                };
            }

            if (followersCount > this.rules.maxFollowers) {
                return {
                    passed: false,
                    reason: `Too many followers: ${followersCount} > ${this.rules.maxFollowers}`
                };
            }

            // Check bio blacklist
            const bio = (lead.bio || '').toLowerCase().trim();
            
            for (const blacklistedTerm of this.rules.bioBlacklist) {
                if (bio.includes(blacklistedTerm.toLowerCase())) {
                    return {
                        passed: false,
                        reason: `Bio contains blacklisted term: "${blacklistedTerm}"`
                    };
                }
            }

            // Check bio whitelist (if specified)
            if (this.rules.bioWhitelist.length > 0) {
                const hasWhitelistedTerm = this.rules.bioWhitelist.some(term =>
                    bio.includes(term.toLowerCase())
                );
                
                if (!hasWhitelistedTerm) {
                    return {
                        passed: false,
                        reason: `Bio doesn't contain any whitelisted terms`
                    };
                }
            }

            // Check if bio is empty or too short (but not required)
            if (bio.length === 0) {
                // Allow empty bios but note it
                console.log(`ℹ️ @${lead.username} has empty bio, but allowing...`);
            } else if (bio.length < 5) {
                return {
                    passed: false,
                    reason: 'Bio is too short (less than 5 characters)'
                };
            }

            // Additional quality checks
            if (this.containsSuspiciousPatterns(bio)) {
                return {
                    passed: false,
                    reason: 'Bio contains suspicious patterns'
                };
            }

            // Pre-flight DM Check: Visit the profile to see if the DM button exists.
            // This is the most reliable way to filter out users with closed DMs.
            if (this.rules.preFilterCheckDMs && this.twitterBot) {
                const canDM = await this.twitterBot.checkDMButtonExists(lead.username);
                if (!canDM) {
                    return {
                        passed: false,
                        reason: 'DMs are closed (pre-flight check)'
                    };
                }
            }

            // All filters passed
            return {
                passed: true,
                reason: 'All filters passed',
                score: this.calculateQualityScore(lead)
            };

        } catch (error) {
            console.error(`❌ Error evaluating lead @${lead.username || 'unknown'}:`, error.message);
            return {
                passed: false,
                reason: `Filter evaluation error: ${error.message}`
            };
        }
    }

    containsSuspiciousPatterns(bio) {
        const suspiciousPatterns = [
            /\b(dm me|follow me|check my|link in bio)\b/i,
            /\b(100% guaranteed|make money fast|earn \$\d+)\b/i,
            /\b(only fans|onlyfans|adult content)\b/i,
            /🔥{3,}|💰{2,}|💎{2,}/,  // Excessive emojis
            /https?:\/\/[^\s]{10,}/   // Long URLs
        ];

        return suspiciousPatterns.some(pattern => pattern.test(bio));
    }

    calculateQualityScore(lead) {
        let score = 50; // Base score

        // Follower count scoring
        const followers = parseInt(lead.followersCount) || 0;
        if (followers > 1000) score += 20;
        else if (followers > 500) score += 10;
        else if (followers < 100) score -= 10;

        // Bio quality scoring
        const bio = lead.bio || '';
        if (bio.length > 50) score += 10;
        if (bio.length > 100) score += 5;
        
        // Sports-related keywords bonus
        const sportsTerms = ['sports', 'nba', 'nfl', 'football', 'basketball', 'soccer', 'fan', 'game'];
        const bioLower = bio.toLowerCase();
        const sportsMatches = sportsTerms.filter(term => bioLower.includes(term)).length;
        score += sportsMatches * 5;

        return Math.min(100, Math.max(0, score));
    }

    // Method to update rules dynamically
    updateRules(newRules) {
        this.rules = { ...this.rules, ...newRules };
        console.log('🔄 Filter rules updated');
    }

    // Method to get current rules
    getRules() {
        return { ...this.rules };
    }

    // Method to validate a bio against blacklist only
    isBioBlacklisted(bio) {
        if (!bio) return false;
        
        const bioLower = bio.toLowerCase();
        return this.rules.bioBlacklist.some(term =>
            bioLower.includes(term.toLowerCase())
        );
    }

    // Method to check follower count only
    isFollowerCountValid(count) {
        return count >= this.rules.minFollowers && count <= this.rules.maxFollowers;
    }

    // Batch evaluation method
    async evaluateLeads(leads) {
        if (!Array.isArray(leads)) {
            console.error('❌ evaluateLeads expects an array');
            return [];
        }

        const results = [];
        for (const lead of leads) {
            try {
                const result = await this.evaluateLead(lead);
                results.push({
                    lead,
                    result
                });
            } catch (error) {
                console.error(`❌ Error in batch evaluation for lead:`, error.message);
                results.push({
                    lead,
                    result: {
                        passed: false,
                        reason: `Evaluation error: ${error.message}`
                    }
                });
            }
        }
        return results;
    }

    // Statistics method
    getFilterStats(evaluatedLeads) {
        const stats = {
            total: evaluatedLeads.length,
            passed: 0,
            failed: 0,
            reasons: {}
        };

        evaluatedLeads.forEach(item => {
            if (item.result.passed) {
                stats.passed++;
            } else {
                stats.failed++;
                const reason = item.result.reason;
                stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
            }
        });

        return stats;
    }
}

module.exports = { FilterEngine };