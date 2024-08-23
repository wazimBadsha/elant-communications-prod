FROM node:16-alpine AS builder
WORKDIR /usr/src/app

# Set environment to development (or production depending on use case)
ENV NODE_ENV=development

# Install dependencies
COPY package*.json ./
RUN npm install

# Final stage
FROM node:16-alpine

WORKDIR /usr/src/app

# Copy node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy application files
COPY . .

# Ensure .env file is copied
COPY .env .env

# Install additional tools and nodemon globally
RUN apk add --no-cache ffmpeg redis && npm install -g nodemon

# Expose the application port
EXPOSE 3000

# Start the application with nodemon
CMD ["nodemon", "server.js"]

# Optional health check
HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:3000/health || exit 1