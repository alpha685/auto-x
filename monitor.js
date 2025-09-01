const express = require("express");
const { GoogleSheetsManager } = require("./src/GoogleSheetsManager");
const { HealthMonitor } = require("./src/monitors/HealthMonitor");

const app = express();
const healthMonitor = new HealthMonitor();

app.get("/dashboard", (req, res) => {
    const metrics = healthMonitor.getMetrics();
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Twitter Automation Dashboard</title>
        <meta http-equiv="refresh" content="30">
        <style>
            body { font-family: Arial; margin: 20px; }
            .metric { padding: 10px; margin: 10px 0; border: 1px solid #ddd; }
            .status-good { background-color: #d4edda; }
            .status-warn { background-color: #fff3cd; }
            .status-error { background-color: #f8d7da; }
        </style>
    </head>
    <body>
        <h1>Twitter Automation Dashboard</h1>
        <div class="metric status-good">
            <h3>System Status</h3>
            <p>Uptime: ${Math.floor(metrics.uptime / 1000 / 60)} minutes</p>
            <p>Last Activity: ${Math.floor(metrics.timeSinceLastActivity / 1000)} seconds ago</p>
        </div>
        
        <div class="metric">
            <h3>Activity Metrics</h3>
            <p>DMs Sent: ${metrics.totalDMsSent}</p>
            <p>Leads Scraped: ${metrics.totalLeadsScraped}</p>
            <p>Engagements: ${metrics.totalEngagements}</p>
        </div>
        
        <div class="metric ${metrics.errors.length > 0 ? "status-error" : "status-good"}">
            <h3>Recent Errors</h3>
            <p>Error Count: ${metrics.errors.length}</p>
            ${metrics.errors.slice(-5).map(err => 
                `<p><small>${new Date(err.timestamp).toLocaleString()}: ${err.error}</small></p>`
            ).join("")}
        </div>
        
        <div class="metric">
            <h3>Control Panel</h3>
            <button onclick="window.location.href=\"/kill-switch?action=stop\"">STOP SYSTEM</button>
            <button onclick="window.location.href=\"/kill-switch?action=pause\"">PAUSE SYSTEM</button>
            <button onclick="window.location.href=\"/kill-switch?action=run\"">RESUME SYSTEM</button>
        </div>
        
        <script>
            // Auto-refresh every 30 seconds
            setTimeout(() => window.location.reload(), 30000);
        </script>
    </body>
    </html>
    `);
});

app.get("/kill-switch", async (req, res) => {
    const action = req.query.action;
    const sheetsManager = new GoogleSheetsManager(config.googleSheets);
    
    try {
        await sheetsManager.initialize();
        const controlSheet = sheetsManager.doc.sheetsByTitle["Control"];
        await controlSheet.loadCells("A1");
        
        switch(action) {
            case "stop":
                controlSheet.getCell(0, 0).value = "STOP";
                break;
            case "pause":
                controlSheet.getCell(0, 0).value = "PAUSE";
                break;
            case "run":
                controlSheet.getCell(0, 0).value = "RUN";
                break;
        }
        
        await controlSheet.saveUpdatedCells();
        res.redirect("/dashboard");
        
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(3000, () => {
    console.log("Monitor dashboard running on http://localhost:3000/dashboard");
});

