# Deployment Guide - Render

This guide walks you through deploying the SLO Dashboard to Render with a custom subdomain.

## Prerequisites

- GitHub repository pushed (✅ Done)
- Render account
- Custom domain: `seanmdalton.me`
- Desired subdomain: `slo-poc.seanmdalton.me`

## Step 1: Create New Web Service on Render

1. **Log into Render Dashboard**
   - Go to https://dashboard.render.com

2. **Create New Web Service**
   - Click "New +" button → "Web Service"
   - Connect your GitHub account if not already connected
   - Select the `slo-dashboard-poc` repository

3. **Configure Service Settings**
   ```
   Name: slo-dashboard-poc
   Region: Oregon (US West) or your preferred region
   Branch: main
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npx serve -s dist -l $PORT
   Instance Type: Free (or upgrade for better performance)
   ```

4. **Environment Variables**
   - Add: `NODE_VERSION` = `18`

5. **Click "Create Web Service"**
   - Render will automatically detect `render.yaml` and use those settings
   - First deployment will take 5-10 minutes

## Step 2: Configure Custom Domain

### A. Add Custom Domain in Render

1. **Navigate to your service** in Render dashboard
2. **Go to "Settings"** tab
3. **Scroll to "Custom Domains"** section
4. **Click "Add Custom Domain"**
5. **Enter**: `slo-poc.seanmdalton.me`
6. **Click "Save"**

Render will provide you with DNS records to configure.

### B. Configure DNS Records

You'll need to add a CNAME record to your domain's DNS settings. Render will show you the exact values, but it typically looks like:

**If using DNS provider (Cloudflare, Namecheap, etc.):**

```
Type: CNAME
Name: slo-poc
Value: slo-dashboard-poc.onrender.com (or the value Render provides)
TTL: Auto or 3600
```

**Common DNS Providers:**

- **Cloudflare**: DNS → Records → Add Record
- **Namecheap**: Domain List → Manage → Advanced DNS → Add New Record
- **Google Domains**: DNS → Custom records → Manage custom records
- **AWS Route 53**: Hosted zones → Create record

### C. Enable HTTPS (Automatic)

- Render automatically provisions SSL certificates via Let's Encrypt
- Once DNS propagates (5-60 minutes), HTTPS will be automatically enabled
- The certificate auto-renews

## Step 3: Verify Deployment

1. **Check Render URL** (temporary)
   - Visit: `https://slo-dashboard-poc.onrender.com`
   - Should load the dashboard immediately after deployment

2. **Wait for DNS Propagation**
   - Can take 5-60 minutes depending on TTL settings
   - Check status: `dig slo-poc.seanmdalton.me` or use https://dnschecker.org

3. **Visit Custom Domain**
   - Once DNS propagates: `https://slo-poc.seanmdalton.me`
   - Should show your SLO Dashboard with valid SSL

## Step 4: Post-Deployment Configuration

### Automatic Deployments

Render will automatically redeploy when you push to `main` branch:
```bash
git push origin main
```

### Manual Deployments

In Render dashboard → Your service → "Manual Deploy" → "Deploy latest commit"

### View Logs

Render dashboard → Your service → "Logs" tab
- Real-time application logs
- Build logs
- Error tracking

## Performance Considerations

### Free Tier Limitations

- **Spin-down**: Service sleeps after 15 minutes of inactivity
- **First load**: May take 30-60 seconds to wake up
- **RAM**: 512 MB
- **Bandwidth**: 100 GB/month

### Upgrade Options (if needed)

- **Starter Plan**: $7/month
  - No spin-down
  - Always responsive
  - 512 MB RAM
  
- **Standard Plan**: $25/month
  - 2 GB RAM
  - Better performance for large datasets

### Optimize Build Size (Optional)

The `series.json` file is 87 MB. For production, consider:

1. **Reduce data points** in `scripts/generate.ts`:
   ```typescript
   const stepMin = 15; // Change from 5 to 15 minutes (reduces file size by 66%)
   ```

2. **Lazy load series data**:
   - Split series.json by journey
   - Load only when user selects a journey

3. **Use external API**:
   - Store time-series data in cloud storage
   - Fetch on demand

## Monitoring

### Render Metrics (Built-in)

- CPU usage
- Memory usage
- Request count
- Response times

### Custom Monitoring

Add monitoring tools in Render environment variables:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for usage tracking

## Troubleshooting

### Build Failures

**Check logs** in Render dashboard → Logs tab

Common issues:
```bash
# Node version mismatch
Solution: Ensure NODE_VERSION=18 in environment variables

# Out of memory during build
Solution: Upgrade to Starter plan or reduce series.json size

# Missing dependencies
Solution: npm install locally and push updated package-lock.json
```

### Custom Domain Not Working

1. **Verify DNS records**: Use `dig slo-poc.seanmdalton.me`
2. **Check TTL**: May need to wait for cache expiration
3. **Clear browser cache**: Try incognito mode
4. **Check Render status**: Render dashboard → Custom Domains → Status

### Slow Performance

1. **Check Render plan**: Free tier has spin-down
2. **Monitor logs**: Look for errors or warnings
3. **Optimize bundle**: Check build output for large chunks
4. **Enable compression**: Render handles this automatically

## Security

### HTTPS

- ✅ Automatically enabled via Let's Encrypt
- ✅ Auto-renewing certificates
- ✅ Force HTTPS redirect (enabled by default)

### Environment Variables

For production secrets:
```
Render Dashboard → Service → Environment → Add Environment Variable
```

Never commit secrets to git!

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Test locally
npm run build && npm run preview

# Push to deploy
git add -A
git commit -m "Update dependencies"
git push origin main
```

### Regenerate Data

```bash
npm run gen
git add src/data/series.json
git commit -m "Regenerate time series data"
git push origin main
```

## Support

- **Render Docs**: https://render.com/docs
- **Render Status**: https://status.render.com
- **Community**: https://community.render.com

---

## Quick Reference

### Essential URLs

- **Render Dashboard**: https://dashboard.render.com
- **Your Service**: https://slo-dashboard-poc.onrender.com
- **Custom Domain**: https://slo-poc.seanmdalton.me

### Essential Commands

```bash
# Local development
npm run dev

# Generate data
npm run gen

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Render
git push origin main
```

### DNS Record

```
Type: CNAME
Name: slo-poc
Value: [Provided by Render]
TTL: 3600
```

---

**Estimated Total Setup Time**: 15-30 minutes (including DNS propagation)

