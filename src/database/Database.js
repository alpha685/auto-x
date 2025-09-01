const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

class Database {
    constructor(dbPath = "./data/automation.db") {
        this.dbPath = dbPath;
        this.db = null;
    }

    async initialize() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.createTables();
    }

    async createTables() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                profile_url TEXT,
                bio TEXT,
                followers_count INTEGER,
                scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                filter_status TEXT DEFAULT 'PENDING',
                dm_status TEXT DEFAULT 'NOT_SENT',
                dm_sent_at DATETIME,
                keyword TEXT,
                last_engagement_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER,
                activity_type TEXT,
                status TEXT,
                performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT,
                FOREIGN KEY (lead_id) REFERENCES leads (id)
            );

            CREATE TABLE IF NOT EXISTS system_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT,
                metric_value TEXT,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(filter_status, dm_status);
            CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(performed_at);
        `);
    }

    async insertLead(leadData) {
        const result = await this.db.run(`
            INSERT OR IGNORE INTO leads 
            (username, profile_url, bio, followers_count, keyword)
            VALUES (?, ?, ?, ?, ?)
        `, [
            leadData.username,
            leadData.profileUrl,
            leadData.bio,
            leadData.followersCount,
            leadData.keyword
        ]);
        
        return result.lastID;
    }

    async getLeadsForProcessing(limit = 50) {
        return await this.db.all(`
            SELECT * FROM leads 
            WHERE filter_status = 'PENDING'
            ORDER BY scraped_at ASC 
            LIMIT ?
        `, [limit]);
    }

    async updateLeadStatus(leadId, status, reason = null) {
        await this.db.run(`
            UPDATE leads 
            SET filter_status = ?, last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, leadId]);
    }

    async getEngagementQueue(limit = 30) {
        return await this.db.all(`
            SELECT * FROM leads 
            WHERE filter_status = 'PASS' 
            AND dm_status = 'NOT_SENT'
            AND (last_engagement_at IS NULL OR last_engagement_at < date('now', '-7 days'))
            ORDER BY scraped_at ASC 
            LIMIT ?
        `, [limit]);
    }

    async recordActivity(leadId, activityType, status, errorMessage = null) {
        await this.db.run(`
            INSERT INTO activities (lead_id, activity_type, status, error_message)
            VALUES (?, ?, ?, ?)
        `, [leadId, activityType, status, errorMessage]);
    }

    async getStats(days = 7) {
        const stats = await this.db.get(`
            SELECT 
                COUNT(*) as total_leads,
                SUM(CASE WHEN filter_status = 'PASS' THEN 1 ELSE 0 END) as qualified_leads,
                SUM(CASE WHEN dm_status = 'SENT' THEN 1 ELSE 0 END) as dms_sent,
                COUNT(DISTINCT keyword) as keywords_scraped
            FROM leads 
            WHERE scraped_at > date('now', '-${days} days')
        `);

        const activityStats = await this.db.all(`
            SELECT 
                activity_type,
                status,
                COUNT(*) as count
            FROM activities 
            WHERE performed_at > date('now', '-${days} days')
            GROUP BY activity_type, status
        `);

        return { ...stats, activities: activityStats };
    }
}

