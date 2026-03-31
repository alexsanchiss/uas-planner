# Use specific Node.js version with slim image
FROM node:22-slim

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Install git (needed for git pull in docker-compose commands) and clean up apt cache
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Define working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies and clean npm cache
RUN npm ci && npm cache clean --force

# Copy application code with proper ownership
COPY --chown=nodejs:nodejs . .

# Build the Next.js application
RUN npm run build

# Change ownership of the app directory to non-root user
RUN chown -R nodejs:nodejs /app

# Expose necessary ports
EXPOSE 3000
EXPOSE 5555

# Switch to non-root user
USER nodejs

# Default command
CMD ["npm", "start"]
