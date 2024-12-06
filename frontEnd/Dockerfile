# Use the latest version of Node.js Alpine
FROM node:21-alpine3.18

# Accept environment variables passed as build arguments
ARG VITE_APP_BASE_URL

# Use ARG values as environment variables for the build stage
ENV VITE_APP_BASE_URL=$VITE_APP_BASE_URL

# Create a directory for our application in the container 
RUN mkdir -p /usr/src/app

# Set this new directory as our working directory for subsequent instructions
WORKDIR /usr/src/app

# Copy only the package files first for better Docker caching
COPY package*.json ./

# Install only the required dependencies
RUN npm install

# Copy the remaining application files
COPY . .

# Build the Vite app for production
RUN npm run build

# Use a lightweight web server for serving static files
RUN npm install -g serve

# Expose the desired port (default for Vite builds is often 5173)
ENV PORT 5173

# Serve the Vite build directory
CMD ["serve", "-s", "dist", "-l", "5173"]
