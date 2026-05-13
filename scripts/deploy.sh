#!/bin/bash
# FocusWake Deployment Script
echo "Starting production build for FocusWake..."
pnpm build
echo "Deploying to Vercel Cloud..."
vercel --prod --confirm
echo "Affective Alarm is now LIVE."