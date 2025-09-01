FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if it exists) to leverage Docker's layer caching.
COPY package.json ./
COPY package-lock.json* ./

# Install your application's dependencies
RUN npm install

# Copy the rest of your application's source code into the container
COPY . .

# Your server listens on port 3000, so we expose it to the network.
EXPOSE 3000

# The command to run your application when the container starts.
CMD ["node", "--openssl-legacy-provider", "server.js"]
