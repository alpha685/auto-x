const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require('google-auth-library');

/**
 * Manages all interactions with Google Sheets.
 * This class is designed to be robust against common API issues like
 * rate limits and eventual consistency.
 */
class GoogleSheetsManager {
    constructor(config) {
        if (!config || !config.spreadsheetId || !config.credentialsJson) {
            throw new Error("GoogleSheetsManager requires spreadsheetId and credentialsJson in config.");
        }
        this.config = config;
        this.doc = null;
        this.worksheet = null;
    }

    /**
     * Initializes the connection to the Google Spreadsheet document.
     * Authenticates and loads the document properties and worksheets.
     */
    async initialize() {
        try {
            console.log("🔧 Connecting to Google Sheets...");
            
            // Parse the credentials from the JSON string
            const creds = JSON.parse(this.config.credentialsJson);
            
            const serviceAccountAuth = new JWT({
                email: creds.client_email,
                key: creds.private_key, // The key is already correctly formatted in the JSON
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.file',
                ],
            });

            this.doc = new GoogleSpreadsheet(this.config.spreadsheetId, serviceAccountAuth);
            
            console.log("...loading document info...");
            await this.doc.loadInfo();
            console.log(`📊 Connected to: ${this.doc.title}`);
            console.log(`   -> Sheet URL: https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}`);
            
            await this.ensureLeadsWorksheet();
            await this._verifyWritePermissions(); // Add a new step to verify write access
            
            console.log("✅ Google Sheets initialized successfully");
        } catch (error) {
            // Add a check for JSON parsing errors
            if (error instanceof SyntaxError) {
                console.error("\n❌ CRITICAL: Failed to parse GOOGLE_CREDENTIALS_JSON. Please ensure it's a valid JSON string copied directly from your service account file.");
            }
            this.handleConnectionError(error); // This will re-throw
        }
    }

    /**
     * Performs a "canary write" to ensure the service account has Editor permissions.
     * This is a critical step to prevent silent failures where the bot thinks it's writing
     * data but nothing is being saved.
     * @private
     */
    async _verifyWritePermissions() {
        console.log("...verifying write permissions on the sheet...");
        try {
            let statusSheet = this.doc.sheetsByTitle["Bot_Status"];
            if (!statusSheet) {
                statusSheet = await this.doc.addSheet({
                    title: "Bot_Status",
                    headerValues: ["Status", "Last Check-in", "Notes"]
                });
                await statusSheet.addRow({
                    Status: "OK",
                    "Last Check-in": new Date().toISOString(),
                    Notes: "This sheet is used by the bot to verify write permissions. It can be safely hidden or ignored."
                });
            }

            // Perform a test write by updating a cell
            await statusSheet.loadCells('B2');
            const cell = statusSheet.getCell(1, 1); // Cell B2
            cell.value = new Date().toISOString();
            await statusSheet.saveUpdatedCells();

            console.log("✅ Write permissions verified successfully.");
        } catch (error) {
            console.error("\n❌ CRITICAL: Write permission verification failed.");
            error.message = `Failed to write to the 'Bot_Status' sheet. This almost certainly means the service account does not have 'Editor' permissions. Original error: ${error.message}`;
            this.handleConnectionError(error); // This will print detailed help and re-throw
        }
    }

    /**
     * Ensures the 'Leads' worksheet exists and has the correct headers.
     * If it doesn't exist, it will be created.
     * If headers are missing, it will throw a critical error.
     */
    async ensureLeadsWorksheet() {
        const requiredHeaders = [
            "Timestamp", "Username", "Profile URL", "Bio", "Follower Count",
            "Keyword", "Filter Status", "Filter Reason", "Verified", "DM Status",
            "DM Sent Date", "Last Error", "Error Timestamp"
        ];
        
        this.worksheet = this.doc.sheetsByTitle["Leads"];
        
        if (!this.worksheet) {
            console.log("📝 'Leads' worksheet not found. Creating it...");
            this.worksheet = await this.doc.addSheet({ 
                title: "Leads",
                headerValues: requiredHeaders
            });
            console.log("✅ Created 'Leads' worksheet.");
        } else {
            console.log("✅ Found existing 'Leads' worksheet");
            await this.worksheet.loadHeaderRow();
            const currentHeaders = this.worksheet.headerValues;
            const missingHeaders = requiredHeaders.filter(h => !currentHeaders.includes(h));
            
            if (missingHeaders.length > 0) {
                console.warn(`⚠️  The 'Leads' worksheet is missing required columns: ${missingHeaders.join(', ')}.`);
                console.log("...attempting to add missing columns automatically.");
                
                // Add the missing headers to the existing ones without losing data.
                const newHeaders = [...currentHeaders, ...missingHeaders];
                await this.worksheet.setHeaderRow(newHeaders);
                console.log("✅ Missing columns have been added successfully.");
            }
        }
    }

    /**
     * Appends new leads to the sheet one by one for maximum reliability.
     * This method is slower than a batch update but is less prone to silent failures.
     * @param {Array<object>} leads - An array of lead objects to add.
     */
    async appendLeads(leads) {
        if (!leads || leads.length === 0) {
            console.log("ℹ️ No new leads to append.");
            return;
        }

        console.log(`📝 Attempting to add ${leads.length} leads one-by-one...`);
        for (const lead of leads) {
            try {
                await this.worksheet.addRow({
                    Timestamp: lead.scrapedAt || new Date().toISOString(),
                    Username: lead.username || '',
                    "Profile URL": lead.profileUrl || '',
                    Bio: (lead.bio || '').substring(0, 500),
                    "Follower Count": lead.followersCount || 0,
                    Keyword: lead.keyword || '',
                    "Filter Status": "PENDING",
                    "Verified": lead.isVerified ? 'YES' : 'NO',
                    "Filter Reason": '',
                    "DM Status": "NOT_SENT",
                    "DM Sent Date": '',
                    "Last Error": '',
                    "Error Timestamp": ''
                });
                console.log(`  -> Sent add command for @${lead.username}`);
            } catch (error) {
                console.error(`❌ CRITICAL FAILURE while adding lead @${lead.username}:`, error.message);
                this.handleConnectionError(error); // This will print detailed help and re-throw
                throw new Error(`Failed to write to Google Sheets. Aborting.`);
            }
        }
        console.log(`✅ Finished sending all ${leads.length} add commands.`);

        // Paranoid Verification by Content: After all writes, check if the data actually saved.
        console.log("...performing content verification to confirm data was written.");
        let allVerified = false;
        const maxRetries = 3;

        for (let i = 0; i < maxRetries; i++) {
            const delay = 7000 * (i + 1); // 7s, 14s, 21s
            console.log(`...waiting ${delay / 1000}s for Google to sync before verification attempt ${i + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                // Safely refresh the worksheet state from the API instead of using clearRows()
                console.log('[Verification] Forcing document refresh from API...');
                await this.doc.loadInfo();
                this.worksheet = this.doc.sheetsByTitle["Leads"];
                if (!this.worksheet) {
                    throw new Error("Could not re-select 'Leads' worksheet after refresh.");
                }

                const currentRows = await this.worksheet.getRows();
                const existingUsernames = new Set(currentRows.map(r => r.get('Username')));

                const unverifiedLeads = leads.filter(l => !existingUsernames.has(l.username));

                if (unverifiedLeads.length === 0) {
                    allVerified = true;
                    console.log("✅ Verification successful. All new leads are confirmed on the sheet.");
                    break;
                } else {
                    const missingUsernames = unverifiedLeads.map(l => l.username).join(', @');
                    console.error(`[Verification] ❌ FAILED to verify ${unverifiedLeads.length} leads. Missing: @${missingUsernames}.`);
                    if (i === maxRetries - 1) {
                        console.error("\n🚨 This is the exact issue you are facing. The bot sent write commands that did not error, but the data is not appearing in the sheet. This is a strong indicator of a permissions problem.");
                    }
                }
            } catch (readError) {
                 console.log(`[Verification] Error reading sheet for verification: ${readError.message}. Retrying...`);
            }
        }

        if (!allVerified) {
            const errorMsg = "CRITICAL FAILURE: The script sent data to Google Sheets without API errors, but the data could not be found in the sheet afterwards. Please check that the service account has 'Editor' permissions on the Google Sheet.";
            console.error(`❌ ${errorMsg}`);
            this.handleConnectionError(new Error("Post-write content verification failed."));
            throw new Error(errorMsg);
        }
    }

    /**
     * Fetches all rows from the sheet that have a 'PENDING' status.
     * @returns {Promise<Array<object>>} - An array of unfiltered lead objects.
     */
    async getUnfilteredLeads() {
        try {
            console.log("...fetching all rows to find unfiltered leads.");
            const rows = await this.worksheet.getRows();

            const unfiltered = rows
                .filter(row => (row.get("Filter Status") || "").toUpperCase() === "PENDING")
                .map(row => ({
                    id: row.rowNumber,
                    username: row.get("Username") || "",
                    bio: row.get("Bio") || "",
                    followersCount: parseInt(row.get("Follower Count") || "0", 10),
                    isVerified: (row.get("Verified") || "").toUpperCase() === 'YES'
                }));

            console.log(`📋 Found ${unfiltered.length} unfiltered leads.`);
            return unfiltered;
        } catch (error) {
            console.error("❌ Failed to get unfiltered leads:", error.message);
            return []; // Return empty array to prevent crashing the system.
        }
    }

    /**
     * Updates the status of multiple leads in a single batch operation.
     * @param {Array<object>} updates - Array of objects with { rowNumber, status, reason }.
     */
    async batchUpdateLeadStatuses(updates) {
        if (!updates || updates.length === 0) return;
        
        try {
            const rows = await this.worksheet.getRows();
            const rowsToUpdate = [];
            const rowMap = new Map(rows.map(row => [row.rowNumber, row]));
            
            for (const update of updates) {
                const row = rowMap.get(update.rowNumber);
                if (row) {
                    row.set("Filter Status", update.status);
                    row.set("Filter Reason", update.reason);
                    rowsToUpdate.push(row);
                }
            }

            if (rowsToUpdate.length > 0) {
                // The saveUpdatedRows method can be unreliable.
                // A one-by-one save is slower but guaranteed to work.
                for (const row of rowsToUpdate) {
                    await row.save();
                }
                console.log(`✅ Batch updated status for ${rowsToUpdate.length} leads.`);
            }
        } catch (error) {
            console.error(`❌ Failed to batch update lead statuses:`, error.message);
            throw error; // Propagate to let the main loop handle it.
        }
    }

    /**
     * Fetches leads that have passed filtering and are ready for engagement.
     * @returns {Promise<Array<object>>} - An array of lead objects ready for DMs.
     */
    async getLeadsForEngagement() {
        try {
            console.log("...fetching all rows to find leads ready for engagement.");
            const rows = await this.worksheet.getRows();
            
            const ready = rows
                .filter(row => 
                    (row.get("Filter Status") || "").toUpperCase() === "PASS" && 
                    (row.get("DM Status") || "").toUpperCase() === "NOT_SENT"
                )
                .map(row => ({
                    id: row.rowNumber,
                    username: row.get("Username") || "",
                    profileUrl: row.get("Profile URL") || "",
                    bio: row.get("Bio") || ""
                }));
                
            console.log(`📋 Found ${ready.length} leads ready for engagement.`);
            return ready;
        } catch (error) {
            console.error("❌ Failed to get leads for engagement:", error.message);
            return [];
        }
    }

    /**
     * Marks a lead's DM status as 'SENT' in the sheet.
     * @param {number} leadId - The row number of the lead.
     */
    async markDMSent(leadId) {
        try {
            const rows = await this.worksheet.getRows();
            const targetRow = rows.find(row => row.rowNumber === leadId);
            
            if (targetRow) {
                targetRow.set("DM Status", "SENT");
                targetRow.set("DM Sent Date", new Date().toISOString());
                await targetRow.save();
                console.log(`✅ Marked DM as sent for lead in row ${leadId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to mark DM as sent for ${leadId}:`, error.message);
        }
    }

    /**
     * Checks a 'Control' sheet for a kill switch status.
     * @returns {Promise<string>} - 'RUN', 'STOP', or 'PAUSE'. Defaults to 'RUN'.
     */
    async getKillSwitchStatus() {
        try {
            let controlSheet = this.doc.sheetsByTitle["Control"];
            if (!controlSheet) {
                console.log("📝 Creating 'Control' sheet...");
                controlSheet = await this.doc.addSheet({ 
                    title: "Control",
                    headerValues: ["Kill Switch", "Notes"]
                });
                await controlSheet.addRow({ "Kill Switch": "RUN", "Notes": "Set to STOP or PAUSE to control the bot." });
                return "RUN";
            }
            
            const rows = await controlSheet.getRows();
            if (rows.length > 0) {
                const value = (rows[0].get("Kill Switch") || "RUN").toUpperCase();
                console.log(`🔄 Kill switch status: ${value}`);
                return value;
            }
            return "RUN";
        } catch (error) {
            console.log("⚠️ Could not check kill switch, defaulting to RUN:", error.message);
            return "RUN";
        }
    }

    /**
     * Logs an error message for a specific lead in the sheet.
     * @param {number} leadId - The row number of the lead.
     * @param {string} errorMessage - The error message to log.
     */
    async logError(leadId, errorMessage) {
        try {
            const rows = await this.worksheet.getRows();
            const targetRow = rows.find(row => row.rowNumber === leadId);
            
            if (targetRow) {
                targetRow.set("Last Error", errorMessage.substring(0, 500));
                targetRow.set("Error Timestamp", new Date().toISOString());
                await targetRow.save();
                console.log(`📝 Logged error for lead in row ${leadId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to log error for ${leadId}:`, error.message);
        }
    }

    /**
     * Handles common connection and authentication errors during initialization.
     * @param {Error} error - The error object.
     */
    handleConnectionError(error) {
        console.error("❌ Google Sheets initialization failed:", error.message);
        if (error.response?.data?.error) {
            const { code, message } = error.response.data.error;
            console.error(`  -> API Error Code ${code}: ${message}`);
        }
        if (error.message.includes('403') || error.message.includes('permission denied') || error.message.includes('does not have permission')) {
            console.error("\n🔧 This is a PERMISSION ERROR. Please check the following:");
            try {
                const creds = JSON.parse(this.config.credentialsJson);
                console.error(`1. The Google Sheet is shared with this EXACT email: ${creds.client_email}`);
            } catch (e) {
                console.error("1. The Google Sheet is shared with the service account email from your credentials file.");
            }
            console.error("2. The permission level for that email is set to 'Editor'.");
            console.error("3. The 'Google Sheets API' and 'Google Drive API' are ENABLED in your Google Cloud project.");
        } else if (error.message.includes('404') || error.message.includes('requested entity was not found')) {
            console.error("\n🔧 This is a NOT FOUND ERROR. Please check your GOOGLE_SHEETS_ID in the .env file.");
        } else if (error.message.includes('invalid_grant')) {
            console.error("\n🔧 This is an AUTHENTICATION ERROR (invalid_grant). This usually means there's an issue with the credentials JSON.");
            console.error("   Please re-download your service account JSON file from Google Cloud and update the GOOGLE_CREDENTIALS_JSON environment variable.");
        } else if (error.message.includes('DECODER routines::unsupported')) {
            console.error("\n🔧 This is a CRYPTOGRAPHIC ERROR. It means the private key format is incompatible. This solution should have fixed it, which is very strange. Please double-check that the GOOGLE_CREDENTIALS_JSON is an exact copy of the file from Google Cloud.");
        }
        throw error;
    }

    /**
     * Efficiently fetches all usernames currently in the sheet to prevent duplicates.
     * @returns {Promise<Set<string>>} - A Set of all usernames.
     */
    async getAllUsernames() {
        try {
            console.log("...fetching all existing usernames to prevent duplicates.");
            const rows = await this.worksheet.getRows();
            const usernames = new Set(rows.map(row => row.get('Username')).filter(Boolean));
            console.log(`...found ${usernames.size} existing usernames in the sheet.`);
            return usernames;
        } catch (error) {
            console.error("❌ Failed to get all usernames:", error.message);
            return new Set(); // Return an empty set on error to avoid breaking the flow
        }
    }

    /**
     * A placeholder for closing connections, though not strictly necessary for this library.
     */
    async close() {
        console.log("📝 Google Sheets connection manager is shutting down.");
    }
}

module.exports = { GoogleSheetsManager };
