const axios = require("axios");

class ProxyManager {
    constructor(proxies) {
        this.proxies = proxies.filter(p => p); // Remove empty proxies
        this.currentIndex = 0;
        this.failedProxies = new Set();
        this.lastRotation = Date.now();
        this.rotationInterval = 10 * 60 * 1000; // Rotate every 10 minutes
    }

    getCurrentProxy() {
        if (this.shouldRotate()) {
            this.rotateProxy();
        }
        
        return this.proxies[this.currentIndex];
    }

    shouldRotate() {
        return Date.now() - this.lastRotation > this.rotationInterval;
    }

    rotateProxy() {
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        this.lastRotation = Date.now();
        
        // Skip failed proxies
        let attempts = 0;
        while (this.failedProxies.has(this.currentIndex) && attempts < this.proxies.length) {
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
            attempts++;
        }
    }

    async testProxy(proxyIndex) {
        const proxy = this.proxies[proxyIndex];
        if (!proxy) return false;

        try {
            const response = await axios.get("http://httpbin.org/ip", {
                proxy: this.parseProxy(proxy),
                timeout: 10000
            });
            
            console.log(`✅ Proxy ${proxyIndex} working: ${response.data.origin}`);
            this.failedProxies.delete(proxyIndex);
            return true;
            
        } catch (error) {
            console.log(`❌ Proxy ${proxyIndex} failed: ${error.message}`);
            this.failedProxies.add(proxyIndex);
            return false;
        }
    }

    parseProxy(proxyString) {
        // Parse proxy string: http://username:password@host:port
        const url = new URL(proxyString);
        return {
            protocol: url.protocol.slice(0, -1), // Remove trailing ":"
            host: url.hostname,
            port: parseInt(url.port),
            auth: url.username && url.password ? {
                username: url.username,
                password: url.password
            } : undefined
        };
    }

    async testAllProxies() {
        console.log("🔍 Testing all proxies...");
        const results = await Promise.allSettled(
            this.proxies.map((_, index) => this.testProxy(index))
        );
        
        const workingProxies = results.filter(r => r.status === "fulfilled" && r.value).length;
        console.log(`✅ ${workingProxies}/${this.proxies.length} proxies are working`);
        
        return workingProxies > 0;
    }
}

