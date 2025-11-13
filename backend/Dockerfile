# Dockerfile
# Stage 1: Build dependencies
# Use a slim Node.js image as a base
FROM node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
# This leverages Docker's build cache, so dependencies are only
# re-installed if package.json or package-lock.json changes.
COPY package.json package-lock.json* ./

# Install production-only dependencies using 'npm ci' for faster, reproducible builds
RUN npm ci --only=production

# Copy the application source code
COPY src/ ./src/


# Stage 2: Create the final production image
# Use the same slim base image
FROM node:18-alpine

WORKDIR /app

# Create and use a non-root user for security
# This user is created by the base node image
USER node

# Copy installed dependencies from the builder stage
# Set correct ownership for the non-root user
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy application source code from the builder stage
COPY --from=builder --chown=node:node /app/src ./src

# Copy package.json (useful for context and running scripts)
COPY --from=builder --chown=node:node /app/package.json ./

# Expose the port the application will run on
# Your index.js uses process.env.PORT || 8080
EXPOSE 8080

# Default environment variables
# This MONGODB_URI assumes you'll run a MongoDB container named 'mongo'
# on the same Docker network. 'localhost' will not work from inside a container.
ENV PORT=8080
ENV MONGODB_URI=mongodb://mongo:27017/collab-chat

# Command to run the application
# We run index.js directly, which works because of "type": "module" in package.json
CMD [ "node", "src/index.js" ]