class MockLeadScraper {
    constructor() {
        this.mockLeads = [
            {
                username: 'sports_fan_2024',
                bio: 'Love NBA and football! Always watching games',
                followersCount: 1500,
                profileUrl: 'https://twitter.com/sports_fan_2024'
            },
            {
                username: 'basketball_lover',
                bio: 'Basketball enthusiast | Lakers fan | Sports betting tips',
                followersCount: 850,
                profileUrl: 'https://twitter.com/basketball_lover'
            },
            {
                username: 'nfl_watcher',
                bio: 'NFL every Sunday | Fantasy football expert',
                followersCount: 2300,
                profileUrl: 'https://twitter.com/nfl_watcher'
            },
            {
                username: 'ufc_fanatic',
                bio: 'UFC fights every weekend | MMA news',
                followersCount: 670,
                profileUrl: 'https://twitter.com/ufc_fanatic'
            },
            {
                username: 'soccer_world',
                bio: 'Soccer/Football from around the world | Premier League',
                followersCount: 1200,
                profileUrl: 'https://twitter.com/soccer_world'
            },
            {
                username: 'nba_insider',
                bio: 'NBA news and analysis | Draft expert',
                followersCount: 3400,
                profileUrl: 'https://twitter.com/nba_insider'
            },
            {
                username: 'sports_better',
                bio: 'Sports betting strategies and tips',
                followersCount: 950,
                profileUrl: 'https://twitter.com/sports_better'
            },
            {
                username: 'football_fan_joe',
                bio: 'College and NFL football fanatic',
                followersCount: 560,
                profileUrl: 'https://twitter.com/football_fan_joe'
            }
        ];
    }

    async scrapeByKeyword(keyword, limit = 50) {
        console.log(`🔍 Mock scraping for keyword: "${keyword}" (limit: ${limit})`);
        
        // Simulate some delay
        await this.sleep(2000);
        
        // Filter mock leads based on keyword
        const keywordLower = keyword.toLowerCase();
        const relevantLeads = this.mockLeads.filter(lead => 
            lead.bio.toLowerCase().includes(keywordLower) ||
            lead.username.toLowerCase().includes(keywordLower) ||
            (keywordLower === 'sports' && (
                lead.bio.toLowerCase().includes('nba') ||
                lead.bio.toLowerCase().includes('nfl') ||
                lead.bio.toLowerCase().includes('football') ||
                lead.bio.toLowerCase().includes('basketball') ||
                lead.bio.toLowerCase().includes('ufc') ||
                lead.bio.toLowerCase().includes('soccer')
            ))
        );
        
        // Take only the requested number
        const results = relevantLeads.slice(0, Math.min(limit, relevantLeads.length));
        
        // Add scraped metadata
        const leads = results.map(lead => ({
            ...lead,
            id: `${lead.username}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            scrapedAt: new Date().toISOString(),
            keyword: keyword
        }));
        
        console.log(`✅ Mock scraping completed: ${leads.length} leads found for "${keyword}"`);
        
        // Simulate some more delay
        await this.sleep(1000);
        
        return leads;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { MockLeadScraper };