const fs = require('fs');

// Validate required environment variables
function validateEnvVars() {
    const required = [
        // These are now optional for the demo, will be pulled from DEMO_ vars
        // 'TWITTER_USERNAME',
        // 'TWITTER_PASSWORD',
        'GOOGLE_SHEETS_ID',
        'GOOGLE_SERVICE_EMAIL',
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(key => console.error(`  - ${key}`));
        console.error('\nPlease check your .env file and ensure all required variables are set.');
        process.exit(1);
    }

    // Special check for the private key, which can be a file or an env var
    if (!process.env.GOOGLE_PRIVATE_KEY && !process.env.GOOGLE_PRIVATE_KEY_PATH) {
        console.error('❌ Missing required environment variable: GOOGLE_PRIVATE_KEY or GOOGLE_PRIVATE_KEY_PATH');
        process.exit(1);
    }
    
    console.log('✅ All required environment variables are present');
}

// Only validate if this is not a test environment
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    validateEnvVars();
}

// Read the private key from a file if the path is provided (for Render),
// otherwise use the environment variable (for local).
const privateKey = process.env.GOOGLE_PRIVATE_KEY_PATH
    ? fs.readFileSync(process.env.GOOGLE_PRIVATE_KEY_PATH, 'utf8')
    : process.env.GOOGLE_PRIVATE_KEY;

module.exports = {
    // Twitter credentials
    twitter: {
        username: process.env.TWITTER_USERNAME, // Used by demo server if DEMO_ vars aren't set
        password: process.env.TWITTER_PASSWORD, // Used by demo server if DEMO_ vars aren't set
        phoneOrEmail: process.env.TWITTER_PHONE || process.env.TWITTER_EMAIL, // For 2FA if required
    },

    // Google Sheets configuration
    googleSheets: {
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        clientEmail: process.env.GOOGLE_SERVICE_EMAIL,
        privateKey: privateKey
    },

    // Scraping configuration
    scraping: {
        keywords: [
            // Keywords that imply a user is actively seeking interaction or help
            'looking for betting tips',
            'who to bet on tonight?',
            'need a good sports bet',
            'best betting community?',
            'any good betting groups',
            'help with my bets'
        ],
        leadsPerKeyword: 5, // Limit to 5 leads for testing
        delayBetweenKeywords: {
            min: 30000, // 30 seconds
            max: 60000  // 60 seconds
        },
        proxies: [
            process.env.PROXY_1,
            process.env.PROXY_2,
            process.env.PROXY_3
        ].filter(Boolean) // Remove undefined proxies
    },

    // Filter rules
    filterRules: {
        minFollowers: 50,
        maxFollowers: 5000, // Further lowered to target more personal accounts
        failIfVerified: true, // If true, any lead with a verified checkmark will be failed.
        preFilterCheckDMs: true, // NEW: If true, visits profile to check if DM button exists before passing.
        bioBlacklist: [
            'crypto',
            'NFT',
            'bitcoin',
            'forex',
            'trading',
            'investment advice',
            'not seeking opportunities',
            'no DMs',
            'DM = block',
            // Add more business-related terms to filter out other services
            'tipster service',
            'premium picks',
            'subscribe for tips',
            'betting service',
            'link in bio',
            'official account',
            'customer support',
            'business inquiries'
        ],
        bioWhitelist: [
            // Optional: only contact if bio contains these
            // 'entrepreneur',
            // 'founder',
            // 'business owner'
        ],
        minScore: 70, // Example filter rule
    },

    // Rate limiting
    rateLimits: {
        dmPerDay: 30,
        likesPerDay: 100,
        retweetsPerDay: 50,
        commentsPerDay: 20,
        actionsPerHour: 15
    },

    // Message templates
    messageTemplates: [
        "Hi {username}! I came across your profile and found your work in {industry} really interesting. Would love to connect and learn more about what you're building!",
        "Hey {username}! Your recent posts about {topic} caught my attention. I'm working on something similar - would you be open to a quick chat?",
        "Hi there! I noticed we both are in the {industry} space. I'd love to connect and potentially collaborate. Are you open to new connections?"
    ],

    // Engagement settings
    engagement: {
        activitiesPerCycle: 10, // Max number of actions to perform in one 30-min cycle
        commentTemplates: [
            "Great insight!",
            "This is really valuable, thanks for sharing!",
            "Couldn't agree more with this perspective.",
            "Really interesting take on this!",
            "This resonates with my experience too.",
            "Thanks for sharing this!",
            "Well said!",
            "Absolutely agree!",
            "Great point!"
        ],
        humanBehavior: {
            minDelayBetweenActions: 30000, // 30 seconds
            maxDelayBetweenActions: 180000, // 3 minutes
            workingHoursStart: 9, // 9 AM
            workingHoursEnd: 18, // 6 PM
            breakDuration: 30 * 60 * 1000, // 30 minutes every few hours
            lunchBreakStart: 12, // 12 PM
            lunchBreakEnd: 13 // 1 PM
        }
    },

    // Error handling
    errorHandling: {
        maxRetries: 3,
        retryDelay: 5 * 60 * 1000, // 5 minutes
        circuitBreakerThreshold: 5, // Stop after 5 consecutive errors
        cycleWait: 30 * 60 * 1000 // 30 minutes between cycles
    },

    // Browser settings
    browser: {
        headless: process.env.HEADLESS !== 'false', // Allow running with visible browser for debugging
        slowMo: parseInt(process.env.SLOW_MO) || 0, // Slow down operations for debugging
        timeout: 30000 // 30 second timeout for operations
    }
};