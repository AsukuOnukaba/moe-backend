#!/bin/bash
set -e  # stops the script if any command fails

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Regenerating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate deploy

echo "Building application..."
npm run build

echo "Restarting app..."
pm2 restart main

echo "Done. Deployment complete."
