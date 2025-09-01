class LeadScraper {
    constructor() {
        // The browser and page are now managed externally.
    }

    async scrapeByKeyword(page, keyword, limit = 50) {
        const leads = [];
        
        try {
            console.log(`🔍 Starting scrape for keyword: "${keyword}" (limit: ${limit})`);
            
            // Refine the search query to exclude verified accounts from the start.
            const filteredKeyword = `${keyword} -is:verified`;
            
            // Navigate to Twitter search
            const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(filteredKeyword)}&src=typed_query&f=user`;
            console.log(`🌐 Navigating to: ${searchUrl}`);
            
            try {
                await page.goto(searchUrl, { 
                    waitUntil: 'domcontentloaded', // Use 'domcontentloaded' for faster, more reliable loads on dynamic pages
                    timeout: 60000 // Increase timeout to handle slow networks or complex pages
                });
                console.log("✅ Page loaded successfully");
            } catch (navigationError) {
                console.error("❌ Navigation failed:", navigationError.message);
                
                try {
                    const screenshotPath = `navigation_error_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    console.log(`📸 Screenshot saved: ${screenshotPath}`);
                } catch (screenshotError) {
                    console.log("❌ Could not take screenshot:", screenshotError.message);
                }
                
                // Instead of throwing, we'll return empty leads to allow the system to continue with other keywords.
                return leads;
            }
            
            // Wait for search results to appear, which is more reliable than a fixed timeout.
            await page.waitForSelector('[data-testid="UserCell"]', { timeout: 15000 }).catch(() => {
                console.log("⚠️ Timed out waiting for user cells. The page might be showing a login wall or no results.");
            });

            // Check if we're on the right page
            const currentUrl = page.url();
            console.log(`📍 Current URL: ${currentUrl}`);
            
            // Check if Twitter is showing a login page or blocking us
            const pageTitle = await page.title();
            console.log(`📄 Page title: ${pageTitle}`);
            
            if (currentUrl.includes('login') || pageTitle.includes('Login')) {
                throw new Error('Twitter is requiring login - scraping blocked');
            }

            let scrapedCount = 0;
            let previousCount = 0;
            let noNewResultsCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = 5; // Reduced for faster testing

            console.log(`📊 Starting data extraction for "${keyword}"`);

            // Look for user cards with multiple possible selectors
            const possibleSelectors = [
                '[data-testid="UserCell"]',
                '[data-testid="user-cell"]',
                'div[data-testid*="user"]',
                'article[data-testid*="tweet"]', // Sometimes user info is in tweet cards
                'div[data-testid="cellInnerDiv"]' // Alternative selector
            ];

            while (scrapedCount < limit && noNewResultsCount < 3 && scrollAttempts < maxScrollAttempts) {
                await page.waitForTimeout(3000);
                
                let userCards = [];
                
                for (const selector of possibleSelectors) {
                    try {
                        const cards = await page.locator(selector).all();
                        if (cards.length > 0) {
                            console.log(`📋 Found ${cards.length} elements with selector: ${selector}`);
                            userCards = cards;
                            break;
                        }
                    } catch (selectorError) {
                        // Try next selector
                        continue;
                    }
                }
                
                if (userCards.length === 0) {
                    console.log("⚠️ No user cards found with any selector");
                    
                    try {
                        const screenshotPath = `no_cards_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}_attempt_${scrollAttempts + 1}.png`;
                        await page.screenshot({ path: screenshotPath, fullPage: true });
                        console.log(`📸 Debug screenshot saved: ${screenshotPath}`);
                    } catch (screenshotError) {
                        console.log("❌ Could not take debug screenshot");
                    }
                    
                    await page.evaluate(() => {
                        window.scrollBy(0, 1000);
                    });
                    await page.waitForTimeout(3000);
                    scrollAttempts++;
                    continue;
                }
                
                console.log(`📋 Processing ${userCards.length} user cards`);
                
                for (const card of userCards) {
                    if (scrapedCount >= limit) break;
                    
                    try {
                        const lead = await this.extractLeadData(card, keyword);
                        if (lead && !leads.find(l => l.username === lead.username)) {
                            leads.push(lead);
                            scrapedCount++;
                            console.log(`✅ Extracted lead ${scrapedCount}/${limit}: @${lead.username}`);
                        }
                    } catch (error) {
                        console.error("❌ Error extracting lead:", error.message);
                    }
                }
                
                // Check if we got new results
                if (scrapedCount === previousCount) {
                    noNewResultsCount++;
                    console.log(`⚠️ No new results found (attempt ${noNewResultsCount}/3)`);
                } else {
                    noNewResultsCount = 0;
                }
                previousCount = scrapedCount;
                
                // Scroll to load more results
                if (scrapedCount < limit) {
                    console.log("📜 Scrolling to load more results...");
                    await page.evaluate(() => {
                        window.scrollBy(0, 1000);
                    });
                    await page.waitForTimeout(3000);
                    scrollAttempts++;
                }
            }
            
            console.log(`✅ Completed scraping for "${keyword}": ${scrapedCount} leads found`);
            
        } catch (error) {
            console.error(`❌ Scraping error for "${keyword}":`, error.message);
            
            if (page) {
                try {
                    const screenshotPath = `scraping_error_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    console.log(`📸 Error screenshot saved: ${screenshotPath}`);
                } catch (screenshotError) {
                    console.log("❌ Could not take error screenshot");
                }
            }
        }
        
        return leads;
    }

    async extractLeadData(userCard, keyword) {
        try {
            // Extract username
            let username = "";
            try {
                const usernameElements = await userCard.locator('[data-testid="UserName"] span').all();
                for (const element of usernameElements) {
                    const text = await element.textContent();
                    if (text && text.startsWith('@')) {
                        username = text.replace('@', '');
                        break;
                    }
                }
                
                // Fallback method
                if (!username) {
                    const linkElement = await userCard.locator('a[role="link"]').first();
                    const href = await linkElement.getAttribute('href');
                    if (href) {
                        const match = href.match(/\/([^\/]+)$/);
                        if (match) {
                            username = match[1];
                        }
                    }
                }
            } catch (error) {
                console.error("Error extracting username:", error.message);
            }
            
            // Extract profile URL
            let profileUrl = "";
            try {
                const profileLinkElement = await userCard.locator('a[role="link"]').first();
                const profilePath = await profileLinkElement.getAttribute('href');
                if (profilePath) {
                    profileUrl = `https://twitter.com${profilePath}`;
                }
            } catch (error) {
                console.error("Error extracting profile URL:", error.message);
            }
            
            // Extract verification status
            let isVerified = false;
            try {
                // Twitter uses different ways to show the verified badge. We check for the most common ones.
                const verifiedIcon = userCard.locator('[data-testid="verified-icon"]');
                const verifiedSvg = userCard.locator('svg[aria-label*="Verified"]');
                
                // Use Promise.race to see which one becomes visible first within a short timeout.
                await Promise.race([
                    verifiedIcon.waitFor({ state: 'visible', timeout: 250 }),
                    verifiedSvg.waitFor({ state: 'visible', timeout: 250 })
                ]);
                isVerified = true;

            } catch (e) {
                // It's okay if it's not found, it just means the user is not verified.
            }
            
            // Extract bio
            let bio = "";
            try {
                const bioElement = await userCard.locator('[data-testid="UserDescription"]').first();
                bio = await bioElement.textContent() || "";
            } catch (error) {
                // Bio might not exist, that's okay
            }
            
            // Extract follower count (this is tricky with current Twitter structure)
            let followersCount = 0;
            try {
                const followersElements = await userCard.locator('span').all();
                for (const element of followersElements) {
                    const text = await element.textContent();
                    if (text && (text.includes('follower') || text.includes('Follower'))) {
                        // Try to extract number before the word
                        const match = text.match(/([\d,]+\.?\d*[KMB]?)\s*[Ff]ollower/);
                        if (match) {
                            followersCount = this.parseFollowerCount(match[1]);
                        }
                        break;
                    }
                }
            } catch (error) {
                // It's okay if follower count is not found. It will be 0.
                // This is better than inventing a random number.
                console.log(`⚠️ Could not extract follower count for @${username}. Defaulting to 0.`);
            }
            
            // Validate that we have at least username
            if (!username) {
                console.log("⚠️ Skipping lead: no username found");
                return null;
            }
            
            return {
                id: `${username}_${Date.now()}`,
                username: username,
                profileUrl: profileUrl || `https://twitter.com/${username}`,
                bio: bio.trim(),
                followersCount,
                isVerified,
                scrapedAt: new Date().toISOString(),
                keyword
            };
            
        } catch (error) {
            console.error("❌ Error extracting user data:", error.message);
            return null;
        }
    }

    parseFollowerCount(text) {
        if (!text) return 0;
        
        // Remove commas and convert to lowercase
        const cleanText = text.replace(/,/g, '').toLowerCase();
        
        // Handle K, M, B multipliers
        const multipliers = { 
            k: 1000, 
            m: 1000000, 
            b: 1000000000 
        };
        
        const match = cleanText.match(/^([\d.]+)([kmb])?$/);
        
        if (!match) return 0;
        
        const number = parseFloat(match[1]);
        const multiplier = multipliers[match[2]] || 1;
        
        return Math.floor(number * multiplier);
    }
}

module.exports = { LeadScraper };