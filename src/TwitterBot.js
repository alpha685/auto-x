📸 Screenshot saved as login_error.png
❌ CRITICAL STARTUP FAILURE. The system will shut down.
Error Message: Twitter login failed. The login page did not behave as expected. Check login_error.png for details. Original error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="toast"], [role="alert"]') to be visible

Full Error Stack: Error: Twitter login failed. The login page did not behave as expected. Check login_error.png for details. Original error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="toast"], [role="alert"]') to be visible

    at TwitterBot.login (/app/src/TwitterBot.js:156:19)
    at async TwitterBot.initialize (/app/src/TwitterBot.js:36:13)
    at async TwitterAutomationSystem.start (/app/src/main.js:50:13)
    at async WebSocket. (/app/server.js:87:17)

🛑 Shutting down Twitter Automation System...
==========================================
🔒 Closing Twitter Bot...
🔒 Browser closed
✅ Twitter Bot closed
📊 Closing Google Sheets connection...
📝 Google Sheets connection manager is shutting down.
✅ Google Sheets closed
✅ System shutdown complete
==========================================
