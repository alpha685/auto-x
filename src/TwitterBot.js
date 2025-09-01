const { chromium } = require("playwright");
const fs = require('fs');
const path = require('path');

class TwitterBot {
    constructor(config) {
        this.config = config;
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
    }

    async initialize() {
        try {
            console.log("🚀 Launching browser...");
            
            // Launch browser with stealth mode
            this.browser = await chromium.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-features=VizDisplayCompositor"
                ]
            });

            console.log("📄 Creating new page...");
            this.page = await this.browser.newPage({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            });
            console.log("🔧 User agent set");
            
            // Set viewport
            console.log("📐 Setting viewport...");
            await this.page.setViewportSize({ width: 1366, height: 768 });
            
            console.log("🔐 Starting login process...");
            await this.login();
            
            console.log("✅ TwitterBot initialized successfully");
        } catch (error) {
            console.error("❌ Error initializing TwitterBot:", error.message);
            if (this.browser) {
                await this.browser.close();
            }
            throw error;
        }
    }

    async login() {
        try {
            console.log("🌐 Navigating to Twitter login page...");
            await this.page.goto("https://x.com/login", { waitUntil: 'domcontentloaded' });

            console.log("📝 Entering username...");
            // Use a more robust selector for the username/email/phone input.
            // getByLabel is less likely to break with UI changes than specific attributes.
            // Increase timeout to 30s to handle slow loading on platforms like Render.
            const usernameInput = this.page.getByLabel(/phone, email, or username/i);
            await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
            await usernameInput.fill(this.config.username);
            
            // Click Next button
            await this.page.click('button[role="button"]:has-text("Next")');

            // After clicking Next, Twitter may ask for a password, or it may ask for a phone/username to resolve ambiguity.
            console.log("🔍 Checking for password or disambiguation screen...");
            const passwordInput = this.page.locator('input[name="password"]');
            const disambiguationInput = this.page.getByLabel(/phone number or username/i);
            const alertError = this.page.locator('[role="alert"]');

            try {
                // Wait for the next screen to be either the password input, the disambiguation input, or an error.
                await Promise.race([
                    passwordInput.waitFor({ state: 'visible', timeout: 25000 }),
                    disambiguationInput.waitFor({ state: 'visible', timeout: 25000 }),
                    alertError.waitFor({ state: 'visible', timeout: 10000 }),
                ]);
            } catch (e) {
                throw new Error('Timed out waiting for password, disambiguation, or error screen after entering username. The login flow may have changed.');
            }

            // Handle error alert
            if (await alertError.isVisible()) {
                const errorText = await alertError.innerText();
                throw new Error(`Twitter displayed an error after username: "${errorText}"`);
            }

            // This handles the case where Twitter asks for a username or phone number to disambiguate an email login.
            if (await disambiguationInput.isVisible()) {
                console.log("📱 Additional verification required (username/phone).");
                if (!this.config.phoneOrEmail) {
                    throw new Error('Twitter is asking for username/phone for verification, but none is provided in .env file. Please set TWITTER_PHONE or TWITTER_EMAIL.');
                }
                console.log("➡️ Entering username/phone for verification...");
                await disambiguationInput.fill(this.config.phoneOrEmail);
                await this.page.click('button[role="button"]:has-text("Next")');
            }

            console.log("🔑 Entering password...");
            await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
            await passwordInput.fill(this.config.password);
            
            // Click login button
            await this.page.click('[data-testid="LoginForm_Login_Button"]');
            
            // Wait for login success OR a known failure condition
            console.log("⏳ Waiting for login to complete...");

            const successLocator = this.page.locator(
                '[data-testid="SideNav_AccountSwitcher_Button"], [aria-label="Home timeline"], [data-testid="AppTabBar_Home_Link"]'
            );
            // FIX: The :has-text-matches pseudo-class is not standard and causes a SyntaxError.
            // We will use a simpler selector and check for specific error text if the element appears.
            const errorLocator = this.page.locator('[data-testid="toast"], [role="alert"]');
            const captchaLocator = this.page.locator('iframe[title*="CAPTCHA"], iframe[src*="recaptcha"]');
            const unusualActivityLocator = this.page.locator('*:text-matches("unusual activity", "i")');
            // NEW: Add a locator for the OTP/verification code screen.
            const verificationInputLocator = this.page.locator('input[data-testid="ocf-challenge-input"], input[name="challenge_response"]');

            // Wait for ANY of the key outcomes to appear. This is more robust than racing different timeouts.
            try {
                await Promise.race([
                    this.page.waitForURL('**/home', { timeout: 60000 }),
                    successLocator.first().waitFor({ state: 'visible', timeout: 60000 }),
                    errorLocator.first().waitFor({ state: 'visible', timeout: 60000 }),
                    captchaLocator.first().waitFor({ state: 'visible', timeout: 60000 }),
                    unusualActivityLocator.first().waitFor({ state: 'visible', timeout: 60000 }),
                    verificationInputLocator.first().waitFor({ state: 'visible', timeout: 60000 }),
                ]);
            } catch (e) {
                // This will now only throw if ALL locators fail to appear within 60 seconds.
                throw new Error(`Timed out waiting for any post-login element (success, error, captcha, etc.). The login process is stuck. Original error: ${e.message.split('\n')[0]}`);
            }

            // Now that we know *something* has appeared, check which one it was in order of severity.
            if (await verificationInputLocator.first().isVisible({ timeout: 1000 })) {
                throw new Error('Login failed: Twitter is asking for an OTP or verification code. This happens when logging in from a new location (like a server). Please disable 2FA on the bot account or log in from a browser on the server to approve the location.');
            }
            if (await captchaLocator.first().isVisible({ timeout: 1000 })) {
                throw new Error('Login failed: CAPTCHA detected. Please log in manually in a headed browser to solve it.');
            }
            if (await unusualActivityLocator.first().isVisible({ timeout: 1000 })) {
                throw new Error('Login failed: "Unusual activity" detected. Please log in manually in a browser to resolve.');
            }
            if (await errorLocator.first().isVisible({ timeout: 1000 })) {
                const errorText = await errorLocator.first().innerText();
                throw new Error(`Login failed with an error message: "${errorText}"`);
            }

            this.isLoggedIn = true;
            console.log("✅ Successfully logged into Twitter");
            
        } catch (error) {
            console.error("❌ Login failed:", error.message);
            await this.takeScreenshot('login_error');
            
            // Re-throw a more specific error to the caller
            if (error.message.includes('CAPTCHA') || error.message.includes('Unusual activity') || error.message.includes('Twitter displayed an error')) {
                throw new Error(`Login failed due to a security check or error from Twitter: ${error.message.split('\n')[0]}`);
            }
            
            throw new Error(`Twitter login failed. The login page did not behave as expected. Check login_error.png for details. Original error: ${error.message.split('\n')[0]}`);
        }
    }

    async checkDMButtonExists(username) {
        try {
            const profileUrl = `https://x.com/${username}`;
            console.log(`  -> [Pre-flight] Checking DM status for @${username}`);
            await this.page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

            const dmButton = this.page.locator('[data-testid="sendDMFromProfile"]');
            // Use a short timeout as we expect the button to be present on load.
            await dmButton.waitFor({ state: 'visible', timeout: 7000 });
            return true;
        } catch (error) {
            // It's expected that this will fail often for users with closed DMs.
            console.log(`  -> [Pre-flight] DM button not found for @${username}.`);
            return false;
        }
    }

    async sendDM(username, message) {
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📨 Attempting to send DM to @${username}` + (attempt > 1 ? ` (Attempt ${attempt}/${maxRetries})` : ''));
    
                const profileUrl = `https://x.com/${username}`;
                if (attempt === 1) console.log(`...navigating to profile: ${profileUrl}`);
                await this.page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    
                const dmButton = this.page.locator('[data-testid="sendDMFromProfile"]');
                await dmButton.waitFor({ state: 'visible', timeout: 15000 });
                await dmButton.click();
    
                const dmDrawer = this.page.locator('[data-testid="DMDrawer"]');
                const verificationPopup = this.page.locator('[role="dialog"]:has-text("Get Verified")');
    
                await Promise.race([
                    dmDrawer.waitFor({ state: 'visible', timeout: 15000 }),
                    this.page.waitForURL('**/messages/compose', { timeout: 15000 }),
                    verificationPopup.waitFor({ state: 'visible', timeout: 15000 }),
                ]);
    
                if (await verificationPopup.isVisible()) {
                    throw new Error('Cannot send DM. Twitter requires account verification.');
                }
    
                const dmScope = (await dmDrawer.isVisible()) ? dmDrawer : this.page;
    
                const startMessageButton = dmScope.locator('[data-testid="conversation-compose-box-header"] button:has-text("Next")');
                if (await startMessageButton.isVisible({ timeout: 3000 })) {
                    console.log('...clicking "Next" on the start message screen.');
                    await startMessageButton.click();
                }
    
                const messageInput = dmScope.locator('[data-testid="dmComposerTextInput"]');
                const cannotMessageText = dmScope.locator(':text-matches("can only send Direct Messages to people who follow you", "i")');
                const cannotMessageGeneric = dmScope.locator(':text-matches("You can.?t message this account", "i")');
                const subscribeToMessageText = dmScope.locator(':text-matches("Subscribe to message", "i")');
                const getVerifiedText = dmScope.locator(':text-matches("Get Verified to message", "i")');
    
                await Promise.race([
                    messageInput.waitFor({ state: 'visible', timeout: 15000 }),
                    cannotMessageText.waitFor({ state: 'visible', timeout: 15000 }),
                    cannotMessageGeneric.waitFor({ state: 'visible', timeout: 15000 }),
                    subscribeToMessageText.waitFor({ state: 'visible', timeout: 15000 }),
                    getVerifiedText.waitFor({ state: 'visible', timeout: 15000 }),
                ]);
    
                if (await cannotMessageText.isVisible() || await cannotMessageGeneric.isVisible()) {
                    throw new Error("Cannot send DM. User only accepts messages from followers or has DMs disabled.");
                }
                if (await subscribeToMessageText.isVisible()) {
                    throw new Error('Cannot send DM. User requires a subscription to message.');
                }
                if (await getVerifiedText.isVisible()) {
                    throw new Error('Cannot send DM. Twitter requires your account to be verified.');
                }
    
                await this.humanType(messageInput, message);
                const sendButton = dmScope.locator('[data-testid="dmComposerSendButton"]');
                await sendButton.click();
    
                const snippet = message.length > 50 ? message.substring(0, 50) : message;
                const sentMessageLocator = dmScope.locator('[data-testid="messageEntry"]').filter({ hasText: new RegExp(snippet, 'i') });
                await sentMessageLocator.last().waitFor({ timeout: 10000 });
    
                console.log(`✅ DM sent to @${username}`);
                return true; // Success, exit the loop
    
            } catch (error) {
                const isTransientError = error.message.includes('DM UI (drawer, page, or popup) did not appear') || 
                                         error.message.includes('Could not determine DM state');

                if (isTransientError && attempt < maxRetries) {
                    console.log(`⚠️  DM attempt ${attempt} failed for @${username} with a transient error. Retrying...`);
                    await this.page.waitForTimeout(5000); // Wait 5 seconds before next attempt
                } else {
                    // This is a final or non-recoverable error
                    console.error(`❌ Failed to send DM to @${username}:`, error.message);
                    await this.takeScreenshot(`dm_error_${username}`);
                    throw error; // Re-throw the error to be caught by the main loop
                }
            }
        }
    }

    async _checkPostStatus(url) {
        // This function is critical for ensuring a post page is valid before we try to interact with it.
        // It uses a sequential check, which is more reliable than a race condition.
        try {
            // 1. Wait for either the main tweet content or a known error state to be visible.
            const mainTweet = this.page.locator('article[data-testid="tweet"]').first();
            const errorState = this.page.locator('body:has-text("This account is suspended"), body:has-text("this page doesn’t exist"), body:has-text("This post is unavailable"), body:has-text("These posts are protected")');
            
            await Promise.race([
                mainTweet.waitFor({ state: 'visible', timeout: 15000 }),
                errorState.first().waitFor({ state: 'visible', timeout: 15000 }),
            ]);
        } catch (e) {
            await this.takeScreenshot(`page_status_error_${this.page.url().split('/').pop()}`);
            throw new Error(`Failed to determine post status for ${url}. The page might be loading slowly, or it's a new error type. Original error: ${e.message}`);
        }

        // 2. Now that we know the page has loaded one of our expected states, check for the errors first.
        if (await this.page.locator('body:has-text("This account is suspended")').isVisible()) {
            throw new Error(`Account is suspended.`);
        }
        if (await this.page.locator('body:has-text("this page doesn’t exist")').isVisible()) {
            throw new Error(`Post does not exist or has been deleted.`);
        }
        if (await this.page.locator('body:has-text("This post is unavailable")').isVisible()) {
            throw new Error(`Post is unavailable (e.g., from a suspended account).`);
        }
        if (await this.page.locator('body:has-text("These posts are protected")').isVisible()) {
            throw new Error(`Account's posts are protected.`);
        }

        // 3. If no errors were found, the main tweet must be visible. Return it.
        return this.page.locator('article[data-testid="tweet"]').first();
    }

    async getLatestTweetUrl(username) {
        try {
            console.log(`...finding latest tweet for @${username}`);
            await this.page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 25000 });

            // Wait for the timeline to be visible, then find the first tweet that is NOT a pinned tweet.
            // This ensures we interact with the user's actual latest content.
            await this.page.locator('[aria-label*="Timeline:"]').waitFor({ state: 'visible', timeout: 25000 });
            const firstNonPinnedTweet = this.page.locator('article[data-testid="tweet"]:not(:has-text("Pinned"))').first();
            await firstNonPinnedTweet.waitFor({ state: 'visible', timeout: 15000 });

            // Find the first link within that tweet that points to a status.
            const tweetLinkLocator = firstNonPinnedTweet.locator('a[href*="/status/"]').first();
            const tweetUrl = await tweetLinkLocator.getAttribute('href');

            if (!tweetUrl) {
                throw new Error("Could not extract href attribute from tweet link.");
            }
            
            const fullUrl = `https://x.com${tweetUrl}`;
            console.log(`...found tweet: ${fullUrl}`);
            return fullUrl;

        } catch (error) {
            console.error(`❌ Could not find latest tweet for @${username}:`, error.message);
            return null; // Return null if no tweet is found
        }
    }

    async likePost(postUrl) {
        try {
            console.log(`...navigating to post: ${postUrl}`);
            await this.page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

            const mainTweet = await this._checkPostStatus(postUrl);
            // The action bar is a group of buttons at the bottom of the tweet.
            const actionBar = mainTweet.locator('div[role="group"]').last();
            await actionBar.waitFor({ state: 'visible', timeout: 5000 });

            // Check if the post is already liked to avoid errors
            const unlikeButton = actionBar.locator('[data-testid="unlike"]');
            if (await unlikeButton.isVisible({ timeout: 1000 })) {
                console.log(`ℹ️ Post already liked: ${postUrl}`);
                return; // Exit gracefully
            }

            const likeButton = actionBar.locator('[data-testid="like"]');
            await likeButton.click();

            // Wait for the button to change to 'Unlike' to confirm the action
            await unlikeButton.waitFor({ state: 'visible', timeout: 10000 });

            console.log(`✅ Liked post: ${postUrl}`);
        } catch (error) {
            console.error(`❌ Failed to like post ${postUrl}:`, error.message);
            throw error;
        }
    }

    async retweetPost(postUrl) {
        try {
            console.log(`...navigating to post: ${postUrl}`);
            await this.page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

            const mainTweet = await this._checkPostStatus(postUrl);
            const actionBar = mainTweet.locator('div[role="group"]').last();
            await actionBar.waitFor({ state: 'visible', timeout: 5000 });

            // Check if the post is already retweeted
            const unretweetButton = actionBar.locator('[data-testid="unretweet"]');
            if (await unretweetButton.isVisible({ timeout: 1000 })) {
                console.log(`ℹ️ Post already retweeted: ${postUrl}`);
                return; // Exit gracefully
            }

            const retweetButton = actionBar.locator('[data-testid="retweet"]');
            await retweetButton.click();
 
            const confirmButton = this.page.locator('[data-testid="retweetConfirm"]');
            await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
            await confirmButton.click();

            // Confirm by waiting for the button to change to 'unretweet' state.
            // This is more reliable than waiting for a toast message.
            await unretweetButton.waitFor({ state: 'visible', timeout: 10000 });

            console.log(`✅ Retweeted post: ${postUrl}`);
        } catch (error) {
            console.error(`❌ Failed to retweet post ${postUrl}:`, error.message);
            throw error;
        }
    }

    async commentOnPost(postUrl, comment) {
        try {
            console.log(`...navigating to post: ${postUrl}`);
            await this.page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

            const mainTweet = await this._checkPostStatus(postUrl);
            const actionBar = mainTweet.locator('div[role="group"]').last();
            await actionBar.waitFor({ state: 'visible', timeout: 5000 });
            const replyButton = actionBar.locator('[data-testid="reply"]');
            await replyButton.click();
 
            // Wait for the composer to be ready by looking for the "Reply" button.
            const postCommentButton = this.page.locator('[data-testid="tweetButton"]');
            // Target the visible text area. Using getByRole is more semantic and robust.
            const textInput = this.page.getByRole('textbox', { name: 'Post text' });
            await textInput.waitFor({ state: 'visible', timeout: 10000 });
 
            await this.humanType(textInput, comment);
            await postCommentButton.click();

            // The confirmation toast is unreliable. A successful click is a good enough indicator.
            // We can add a small, static wait to ensure the action completes before moving on.
            await this.page.waitForTimeout(2000);
            console.log(`✅ Commented on post: ${postUrl}`);
        } catch (error) {
            console.error(`❌ Failed to comment on post ${postUrl}:`, error.message);
            throw error;
        }
    }

    async humanType(locator, text) {
        try {
            await locator.click({ timeout: 5000 });
            await locator.fill('');
            await locator.pressSequentially(text, { delay: Math.random() * 80 + 70 }); // 70-150ms delay
        } catch (error) {
            console.error("❌ Error in humanType:", error.message);
            throw error;
        }
    }

    async takeScreenshot(name) {
        try {
            const screenshotsDir = path.join(__dirname, '..', 'screenshots');
            if (!fs.existsSync(screenshotsDir)){
                fs.mkdirSync(screenshotsDir, { recursive: true });
            }
            const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
            const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            // The server is running from the root, so the URL is relative to that.
            console.log(`📸 Screenshot saved. View it at: /screenshots/${safeName}.png`);
        } catch (screenshotError) {
            console.error("❌ Could not take screenshot:", screenshotError.message);
        }    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log("🔒 Browser closed");
            }
        } catch (error) {
            console.error("❌ Error closing browser:", error.message);
        }
    }
}

module.exports = { TwitterBot };
