FROM node:22-slim

# Install system dependencies (git, etc. if needed by agents)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Install dependencies for runner
RUN npm install -g tsx typescript dotenv convex

# Set working directory
WORKDIR /app

# Copy package files first
COPY package.json .
RUN npm install

# Copy application code
COPY . .

# Default command
CMD ["tail", "-f", "/dev/null"]
