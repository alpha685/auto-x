const { GoogleSpreadsheet } = require("google-spreadsheet");
require("dotenv").config();

async function setupGoogleSheets() {
    console.log("🔧 Setting up Google Sheets...");
    
    try {
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_SERVICE_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        });
        
        await doc.loadInfo();
        
        // Create or update the main sheet
        let worksheet = doc.sheetsByTitle["Leads"];
        if (!worksheet) {
            worksheet = await doc.addSheet({ 
                title: "Leads",
                headerValues: [
                    "Timestamp",
                    "Username", 
                    "Profile URL",
                    "Bio",
                    "Follower Count",
                    "Following Count",
                    "Tweet Count",
                    "Keyword",
                    "Filter Status",
                    "Filter Reason",
                    "DM Status",
                    "DM Sent Date",
                    "Engagement Status",
                    "Last Error",
                    "Error Timestamp",
                    "Notes"
                ]
            });
        }
        
        // Create control sheet for kill switch
        let controlSheet = doc.sheetsByTitle["Control"];
        if (!controlSheet) {
            controlSheet = await doc.addSheet({ 
                title: "Control",
                headerValues: ["Kill Switch", "Daily Limit", "Current Count", "Last Reset"]
            });
            
            // Add initial values
            await controlSheet.addRow({
                "Kill Switch": "RUN",
                "Daily Limit": "30",
                "Current Count": "0",
                "Last Reset": new Date().toISOString()
            });
        }
        
        console.log("✅ Google Sheets setup complete!");
        console.log(`📊 Sheet URL: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEETS_ID}`);
        
    } catch (error) {
        console.error("❌ Google Sheets setup failed:", error.message);
        console.error("Please check your Google Sheets credentials in .env file");
        process.exit(1);
    }
}

async function testTwitterLogin() {
    console.log("🔐 Testing Twitter login...");
    
    // Check if credentials are provided
    if (!process.env.TWITTER_USERNAME || !process.env.TWITTER_PASSWORD) {
        console.log("⚠️ Twitter credentials not provided, skipping login test");
        console.log("Please add TWITTER_USERNAME and TWITTER_PASSWORD to your .env file");
        return;
    }
    
    const { TwitterBot } = require("./src/TwitterBot");
    const bot = new TwitterBot({
        username: process.env.TWITTER_USERNAME,
        password: process.env.TWITTER_PASSWORD,
        phoneOrEmail: process.env.TWITTER_PHONE
    });
    
    try {
        await bot.initialize();
        console.log("✅ Twitter login successful!");
        await bot.close();
    } catch (error) {
        console.error("❌ Twitter login failed:", error.message);
        console.log("Please check your Twitter credentials in .env file");
        // Don't exit here, as user might want to set up sheets first
    }
}

async function createEnvFile() {
    const fs = require('fs');
    const path = require('path');
    
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
        console.log("📝 Creating .env file template...");
        
        const envTemplate = `# Twitter Credentials
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password
TWITTER_PHONE=your_phone_or_email

# Google Sheets Configuration
GOOGLE_SHEETS_ID=your_google_sheets_id
GOOGLE_SERVICE_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----"

# Optional Proxy Settings
PROXY_1=
PROXY_2=
PROXY_3=
`;
        
        fs.writeFileSync(envPath, envTemplate);
        console.log("✅ .env file created! Please fill in your credentials.");
        console.log("📋 Edit the .env file with your actual credentials before running the system.");
        return false;
    }
    
    return true;
}

async function main() {
    console.log("🚀 Setting up Twitter Automation System...\n");
    
    const envExists = await createEnvFile();
    
    if (!envExists) {
        console.log("\n⏹️  Setup paused. Please configure your .env file first.");
        return;
    }
    
    // Check if essential env vars are set
    if (!process.env.GOOGLE_SHEETS_ID) {
        console.log("⚠️ GOOGLE_SHEETS_ID not set in .env file");
        console.log("Please configure your .env file with proper credentials");
        return;
    }
    
    await setupGoogleSheets();
    await testTwitterLogin();
    
    console.log("\n✅ Setup complete! You can now run:");
    console.log("   npm start");
    console.log("\n📝 Don't forget to:");
    console.log("   1. Configure your .env file with proper credentials");
    console.log("   2. Set up your Google Service Account");
    console.log("   3. Share your Google Sheet with the service account email");
}

if (require.main === module) {
    main().catch(error => {
        console.error("❌ Setup failed:", error.message);
        process.exit(1);
    });
}

module.exports = { setupGoogleSheets, testTwitterLogin };