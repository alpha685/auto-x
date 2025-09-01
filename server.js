const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { TwitterAutomationSystem } = require('./src/main.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// --- Improved State Management ---
let isDemoRunning = false;
let demoTimeout = null;
let activeAutomationSystem = null;
let activeWebSocket = null;

// Serve the frontend HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Centralized Cleanup Function ---
async function cleanupDemo(reason) {
    console.log(`🧹 Cleaning up demo. Reason: ${reason}`);
    if (demoTimeout) {
        clearTimeout(demoTimeout);
        demoTimeout = null;
    }
    if (activeAutomationSystem) {
        await activeAutomationSystem.shutdown();
        activeAutomationSystem = null;
    }
    isDemoRunning = false;
    activeWebSocket = null;
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Override console.log for this connection's duration
    const originalLog = console.log;

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data.type === 'start-automation') {
            if (isDemoRunning) {
                ws.send(JSON.stringify({ type: 'status', status: 'busy' }));
                return;
            }
            isDemoRunning = true;
            activeWebSocket = ws;

            // Hard-coded configuration for the public demo
            const demoConfig = {
                // These will be pulled from your server's environment variables
                twitterUsername: process.env.DEMO_TWITTER_USERNAME,
                twitterPassword: process.env.DEMO_TWITTER_PASSWORD,
                // Limited and safe keywords for the demo
                keywords: ['looking for startup advice', 'need marketing tips'],
                // Safe, generic message templates
                messageTemplates: ["Hi {username}! Saw your tweet and thought I'd connect."],
            };

            // Start streaming logs to the client
            console.log = (...args) => {
                const logMessage = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
                originalLog(logMessage); // Keep logging on the server
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'log', message: logMessage }));
                }
            };

            try {
                activeAutomationSystem = new TwitterAutomationSystem(demoConfig);

                // Automatically stop the demo after a set time (e.g., 5 minutes)
                demoTimeout = setTimeout(async () => {
                    console.log('⏰ Demo time limit reached. Automatically stopping.');
                    await cleanupDemo('Timeout');
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'status', status: 'stopped' }));
                    }
                }, 5 * 60 * 1000); // 5 minutes

                await activeAutomationSystem.start();

                // If start() finishes without error before timeout (e.g., 1 cycle completes)
                console.log('✅ Demo cycle completed successfully.');
                await cleanupDemo('Cycle Finished');
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'status', status: 'stopped' }));
                }

            } catch (error) {
                ws.send(JSON.stringify({ type: 'log', message: `❌ CRITICAL ERROR: ${error.message}` }));
                await cleanupDemo('Critical Error');
            }
        } else if (data.type === 'stop-automation') {
            if (activeAutomationSystem) {
                console.log('Automation stopped by client.');
                await cleanupDemo('Client Stop Request');
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'status', status: 'stopped' }));
                }
            }
        }
    });

    ws.on('close', async () => {
        console.log('Client disconnected');
        // Restore the original console.log when this specific client disconnects
        console.log = originalLog;
        // If this was the active connection, clean up its demo
        if (ws === activeWebSocket) {
            await cleanupDemo('Client Disconnected');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});
