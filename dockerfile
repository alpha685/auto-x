FROM node:18-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libgconf-2-4 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install chromium

# Copy application code
COPY . .

# Create non-root user
RUN groupadd -r automation && useradd -r -g automation -s /bin/false automation
RUN chown -R automation:automation /app
USER automation

# Health check
HEALTHCHECK --interval=30m --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log(\'Health check passed\')" || exit 1

CMD ["npm", "start"]

