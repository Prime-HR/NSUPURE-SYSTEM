# NSUPURE BUSINESS MANAGEMENT SYSTEM
## 0-Cost ($0.00/mo) Permanent 24/7 Cloud Deployment Guide

This guide walks you through deploying the **NSUPURE BUSINESS MANAGEMENT SYSTEM** online with **$0.00 cost forever**, **24/7 permanent uptime**, and access from any mobile phone, tablet, or laptop worldwide.

---

## Architecture Overview (Free Forever Tier)

| Component | Provider | Free Tier Specification | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Database** | **Neon Serverless PostgreSQL** | 0.5 GB Managed PostgreSQL 16, automated SSL, continuous backups | **$0.00** |
| **Web Service & API** | **Render.com** | 750 free hours/month (runs 1 full service 24/7 for 31 days) | **$0.00** |
| **24/7 Uptime Keep-Alive** | **UptimeRobot** | Free HTTP ping monitor every 10 minutes to eliminate free-tier sleep | **$0.00** |
| **Domain & SSL** | **Render Subdomain** | Free `https://<your-app>.onrender.com` with free automated HTTPS | **$0.00** |

---

## Step 1: Create Free Neon PostgreSQL Database (1 Minute)

1. Go to [https://neon.tech](https://neon.tech) and click **"Sign Up"** (Free, no credit card required).
2. Click **"Create Project"**:
   - **Project Name:** `nsupure-db`
   - **Region:** Choose Europe (Frankfurt) or US East.
   - Click **"Create Project"**.
3. Copy your connection string from the dashboard. It looks like this:
   ```text
   postgresql://neondb_owner:npg_xxxxxx@ep-cool-pond-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this string copied — you will paste it into Render in Step 3).*

---

## Step 2: Push Your Code to GitHub (2 Minutes)

Open PowerShell on your computer and run:

```powershell
cd "c:\Users\rauf2\Downloads\NSUPURE SYSTEM"

# Initialize Git
git init

# Add all files
git add .

# Make the initial commit
git commit -m "Initial pristine release of Nsupure Business Management System"

# Create a private repository on GitHub (https://github.com/new), then link and push:
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/nsupure-system.git
git push -u origin main
```

---

## Step 3: Deploy to Render.com (2 Minutes)

1. Go to [https://render.com](https://render.com) and log in with your GitHub account.
2. Click **"New +"** in the top navigation and select **"Web Service"**.
3. Select **"Build and deploy from a Git repository"** and connect your `nsupure-system` repository.
4. Configure the Web Service:
   - **Name:** `nsupure-water` (or any name you prefer)
   - **Region:** Frankfurt (or same region as Neon)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install --prefix backend && npm install --prefix frontend && npm run build --prefix backend && npm run build --prefix frontend && npm run prisma:deploy --prefix backend && npm run prisma:seed --prefix backend
     ```
   - **Start Command:**
     ```bash
     node backend/dist/server.js
     ```
   - **Instance Type:** `Free` ($0.00/month)
5. Scroll down to **"Environment Variables"** and click **"Add Environment Variable"**:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = *(Paste your Neon PostgreSQL connection string from Step 1)*
   - `JWT_SECRET` = *(Click Generate or enter a secret key)*
   - `INITIAL_OWNER_PASSWORD` = `Nsupure2025!`
6. Click **"Deploy Web Service"**.
7. Render will build and launch your application. Once finished, it will display your live URL (e.g., `https://nsupure-water.onrender.com`).

---

## Step 4: Keep It Awake 24/7 with UptimeRobot (1 Minute)

Render's free tier spins down if no request is received for 15 minutes. To eliminate sleep mode and keep it running 24 hours a day, 7 days a week:

1. Go to [https://uptimerobot.com](https://uptimerobot.com) and create a free account (100% free, 50 monitors).
2. Click **"+ Add New Monitor"**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Nsupure 24/7 Keep-Alive`
   - **URL (or IP):** `https://nsupure-water.onrender.com/health`
   - **Monitoring Interval:** `10 minutes`
3. Click **"Create Monitor"**.

> [!TIP]
> UptimeRobot will ping the `/health` endpoint every 10 minutes. This prevents Render from ever sleeping, ensuring instant loading for your factory operators, drivers, and salespeople day and night!

---

## Step 5: Install App on Staff Phones & Tricycle

Once deployed to your URL (`https://nsupure-water.onrender.com`):

1. Open the URL in Google Chrome or Safari on any Android or iPhone.
2. Tap the browser menu (or Share icon) and select **"Add to Home screen"** or **"Install app"**.
3. An **NSUPURE** icon will appear on the phone's home screen just like a native mobile app!
4. Log in:
   - **Default Owner:** `owner` / `Nsupure2025!`
   - Create staff logins for sales and drivers inside **Staff & Payroll** (`/staff`).
