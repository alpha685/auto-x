require("dotenv").config();

async function testGoogleSheetsV4() {
    console.log("🧪 Testing Google Sheets connection (v4 API)...");
    
    // Check environment variables first
    if (!process.env.GOOGLE_SHEETS_ID) {
        console.error("❌ GOOGLE_SHEETS_ID not found in environment variables");
        return false;
    }
    
    if (!process.env.GOOGLE_SERVICE_EMAIL) {
        console.error("❌ GOOGLE_SERVICE_EMAIL not found in environment variables");
        return false;
    }
    
    if (!process.env.GOOGLE_PRIVATE_KEY) {
        console.error("❌ GOOGLE_PRIVATE_KEY not found in environment variables");
        return false;
    }
    
    console.log("✅ Environment variables found");
    console.log(`📊 Sheet ID: ${process.env.GOOGLE_SHEETS_ID}`);
    console.log(`📧 Service Email: ${process.env.GOOGLE_SERVICE_EMAIL}`);
    
    try {
        const { GoogleSpreadsheet } = require("google-spreadsheet");
        const { JWT } = require('google-auth-library');
        
        console.log("📦 Loaded required packages");
        
        // Create JWT service account credentials
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file',
            ],
        });
        
        console.log("🔐 Created JWT auth");
        
        // Initialize document with auth (v4 style)
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
        console.log("📊 Created GoogleSpreadsheet instance with auth");
        
        // Load document info
        await doc.loadInfo();
        console.log("✅ Successfully loaded document info");
        console.log(`📊 Document title: ${doc.title}`);
        console.log(`📄 Number of sheets: ${doc.sheetCount}`);
        
        // List all sheets
        console.log("📋 Available sheets:");
        Object.values(doc.sheetsByTitle).forEach(sheet => {
            console.log(`  - ${sheet.title} (${sheet.rowCount} rows, ${sheet.columnCount} columns)`);
        });
        
        // Try to access or create a Leads sheet
        let leadsSheet = doc.sheetsByTitle["Leads"];
        if (!leadsSheet) {
            console.log("📝 Creating Leads sheet...");
            leadsSheet = await doc.addSheet({ 
                title: "Leads",
                headerValues: ["Timestamp", "Username", "Profile URL", "Bio", "Follower Count"]
            });
            console.log("✅ Created Leads sheet");
        } else {
            console.log("✅ Found existing Leads sheet");
        }
        
        // Try to add a test row
        console.log("🧪 Testing data operations...");
        const testRow = {
            Timestamp: new Date().toISOString(),
            Username: "test_user",
            "Profile URL": "https://twitter.com/test_user",
            Bio: "This is a test bio",
            "Follower Count": 1000
        };
        
        await leadsSheet.addRow(testRow);
        console.log("✅ Successfully added test row");
        
        // Try to read the data back
        const rows = await leadsSheet.getRows();
        console.log(`📋 Found ${rows.length} rows in the sheet`);
        
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            console.log("📄 Last row data:", {
                username: lastRow.get("Username"),
                bio: lastRow.get("Bio")
            });
        }
        
        console.log("🎉 All tests passed!");
        return true;
        
    } catch (error) {
        console.error("❌ Google Sheets test failed:", error.message);
        console.error("Full error:", error);
        
        if (error.message.includes('403')) {
            console.error("\n🔧 This is a permission error. Make sure:");
            console.error("1. Your Google Sheet is shared with: " + process.env.GOOGLE_SERVICE_EMAIL);
            console.error("2. The service account has 'Editor' permissions");
            console.error("3. Google Sheets API is enabled in your Google Cloud Console");
        } else if (error.message.includes('404')) {
            console.error("\n🔧 Sheet not found. Check your GOOGLE_SHEETS_ID in .env file");
        } else if (error.message.includes('invalid_grant')) {
            console.error("\n🔧 Invalid credentials. Check your GOOGLE_PRIVATE_KEY format");
        }
        
        return false;
    }
}

if (require.main === module) {
    testGoogleSheetsV4().then(success => {
        if (!success) {
            process.exit(1);
        }
    });
}

module.exports = { testGoogleSheetsV4 };