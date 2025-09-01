const express = require("express");
const app = express();

let killSwitchStatus = "RUN"; // RUN, PAUSE, STOP

app.use(express.json());

// Get kill switch status
app.get("/api/kill-switch", (req, res) => {
    res.json({ 
        status: killSwitchStatus,
        timestamp: new Date().toISOString()
    });
});

// Set kill switch status
app.post("/api/kill-switch", (req, res) => {
    const { status, reason } = req.body;
    
    if (["RUN", "PAUSE", "STOP"].includes(status)) {
        killSwitchStatus = status;
        console.log(`Kill switch updated to: ${status} - Reason: ${reason || "Not specified"}`);
        res.json({ success: true, status: killSwitchStatus });
    } else {
        res.status(400).json({ error: "Invalid status" });
    }
});

app.listen(3001, () => {
    console.log("Kill switch server running on port 3001");
});

