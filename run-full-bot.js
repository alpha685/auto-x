// Load environment variables from your .env file
require("dotenv").config();
const { TwitterAutomationSystem } = require('./src/main.js');

async function main() {
    console.log('🚀 Starting Full Automation Bot...');
    console.log('================================');
    console.log('This will use the credentials and configuration from your .env file.');

    // By passing an empty config, the system will default to "full mode"
    // and use the environment variables as defined in src/config/config.js
    const system = new TwitterAutomationSystem({});

    // Graceful shutdown handler for Ctrl+C
    const shutdown = async () => {
        console.log('\n🛑 Received shutdown signal, shutting down gracefully...');
        await system.shutdown();
        process.exit(0);
    };

    process.on('SIGINT', shutdown); // Catches Ctrl+C
    process.on('SIGTERM', shutdown); // Catches 'kill' commands

    try {
        await system.start();
    } catch (error) {
        console.error('❌ A fatal error occurred during system startup. The process will now exit.');
        process.exit(1);
    }
}

main();
