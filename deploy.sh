#!/bin/bash

echo "Building backend..."
npm run build

echo "Cleaning up previous build..."
rm -rf /www/homestream/dist
rm -rf /www/homestream/public

echo "Copying files..."
cp -r dist public templates /www/homestream
cp package.json /www/homestream

echo "Installing dependencies..."
cd /www/homestream
npm install --production
