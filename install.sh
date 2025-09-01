#!/bin/bash

echo "🚀 Twitter Automation System - Installation Script"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -c2-)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 16 ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Version 16 or higher is required."
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Install npm dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Playwright browsers"
    exit 1
fi

echo "✅ Playwright browsers installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.template .env
    echo "✅ .env file created. Please edit it with your credentials."
else
    echo "ℹ️ .env file already exists"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p data

echo ""
echo "🎉 Installation completed successfully!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your credentials:"
echo "   - Twitter username and password"
echo "   - Google Sheets ID and service account credentials"
echo ""
echo "2. Test the setup:"
echo "   npm run test-sheets"
echo ""
echo "3. Start the system:"
echo "   npm start"
echo ""
echo "For detailed setup instructions, check the README.md file."