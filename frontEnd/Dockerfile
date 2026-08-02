# Use the latest version of Node.js Alpine
FROM node:21-alpine3.18

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

# Served by server.js rather than a static file server: /:username needs its
# Open Graph tags rewritten per roast, because link-preview crawlers don't run
# the JavaScript that would otherwise set them.
ENV PORT 5173

CMD ["node", "server.js"]
