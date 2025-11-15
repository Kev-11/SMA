# Vercel Deployment Checklist

## ✅ Pre-Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Test Build Locally
```bash
npm run build
```
This should create a `dist/` folder with your production build.

### 3. Test Locally (Optional)
```bash
npm run preview
```

### 4. Environment Variables
Before deploying, set these environment variables in Vercel:

**Required:**
- `OCR_SPACE_API_KEY` - Your OCR.space API key (currently: K82304850788957)

**How to set in Vercel:**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add `OCR_SPACE_API_KEY` with your key
4. Select environments: Production, Preview (optional), Development (optional)

### 5. Git Setup
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Social Media Content Analyzer"

# Add remote (replace <username> with your GitHub username)
git remote add origin https://github.com/<username>/SMA.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🚀 Deploy to Vercel

### Option 1: Vercel CLI (Recommended)
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# For production deployment
vercel --prod
```

### Option 2: Vercel Dashboard
1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite configuration
5. Add environment variable `OCR_SPACE_API_KEY`
6. Click "Deploy"

## ✅ Post-Deployment Verification

### 1. Check Build Logs
- Ensure build completed successfully
- Look for any warnings or errors

### 2. Test API Health
```bash
curl https://your-deployment-url.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "Social Media Content Analyzer API",
  "timestamp": "2025-11-15T...",
  "env": {
    "hasOcrKey": true,
    "nodeVersion": "v18.x.x"
  }
}
```

### 3. Test OCR Endpoint
Upload a test PDF or image through the UI at your deployment URL.

### 4. Check Function Logs
- Go to Vercel Dashboard → Your Project → Functions
- Click on `ocr` function to view logs
- Verify no errors during requests

## 🔧 Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify Node.js version (should be 18.x)
- Check build logs for specific errors

### API Returns Errors
- Verify `OCR_SPACE_API_KEY` is set correctly in Vercel
- Check function logs for detailed error messages
- Ensure OCR.space API key is valid

### Blank Page After Deployment
- Check browser console for errors
- Verify `dist/` folder was created during build
- Check Vercel deployment logs

### OCR Returns "Demo Key" Warning
- Environment variable `OCR_SPACE_API_KEY` not set
- Go to Settings → Environment Variables and add it
- Redeploy after adding

## 📝 Files Included for Vercel

- ✅ `vercel.json` - Vercel configuration
- ✅ `package.json` - Dependencies and build scripts
- ✅ `.vercelignore` - Files to exclude from deployment
- ✅ `.env.example` - Template for environment variables
- ✅ `api/ocr.js` - Serverless OCR function
- ✅ `api/health.js` - Health check endpoint
- ✅ `vite.config.js` - Vite build configuration
- ✅ `.gitignore` - Git ignore rules

## 🎯 Quick Deploy Commands

```bash
# Full deployment workflow
npm install
npm run build
git add .
git commit -m "Ready for deployment"
git push
vercel --prod
```

## 🔗 Important Links

- Vercel Dashboard: https://vercel.com/dashboard
- OCR.space API: https://ocr.space/ocrapi
- GitHub Repository: https://github.com/<username>/SMA
