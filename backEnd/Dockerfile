# Use the official Node.js 18 image as the base
FROM node:18.17.0-alpine

# Accept environment variables passed as build arguments
ARG X_RAPIDAPI_KEY
ARG X_RAPIDAPI_HOST
ARG URL
ARG DB
ARG APIKEY
ARG MODEL_NAME
ARG BUCKET_NAME

# Set environment variables
ENV X_RAPIDAPI_KEY=$X_RAPIDAPI_KEY
ENV X_RAPIDAPI_HOST=$X_RAPIDAPI_HOST
ENV URL=$URL
ENV DB=$DB
ENV APIKEY=$APIKEY
ENV MODEL_NAME=$MODEL_NAME
ENV BUCKET_NAME=$BUCKET_NAME

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Install PM2 globally
RUN npm install -g pm2

# Copy the rest of the application files
COPY . .

# Expose the application's port
EXPOSE 8080

# Start the application using PM2
CMD ["pm2-runtime", "start", "index.js"]