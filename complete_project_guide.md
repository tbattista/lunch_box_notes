# Lunch Box Notes - Complete Project Guide

## 1. Updated Technical Architecture

### Core Stack
- Framework: T3 Stack (Next.js, TypeScript, Tailwind)
- Backend & Hosting: Firebase
  - Authentication
  - Firestore
  - Hosting
  - Cloud Functions (for API routes)
- UI Components: shadcn/ui
- AI: Google Gemini Pro
- Payments: Stripe

### Firebase Configuration
```
lunch-box-notes/
├── firebase/
│   ├── hosting/         # Firebase hosting config
│   ├── functions/       # Cloud Functions
│   └── firestore.rules  # Database rules
├── .firebaserc          # Firebase project config
└── firebase.json        # Firebase setup
```

## 2. Deployment Guide

### Initial Firebase Hosting Setup
```bash
# Install Firebase CLI globally if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init

# Select these options:
- Hosting: Configure files for Firebase Hosting
- Functions: Configure Cloud Functions
- Firestore: Configure security rules
```

### Firebase Configuration Files

```json
// firebase.json
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

```json
// .firebaserc
{
  "projects": {
    "default": "lunch-box-notes"
  }
}
```

### Build Configuration
```json
// package.json
{
  "scripts": {
    "build": "next build && next export",
    "deploy": "npm run build && firebase deploy"
  }
}
```

## 3. GitHub Actions Workflow

```yaml
# .github/workflows/firebase-deploy.yml
name: Deploy to Firebase
on:
  push:
    branches:
      - main
      - staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_CONFIG: ${{ secrets.FIREBASE_CONFIG }}
          NEXT_PUBLIC_GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: ${{ secrets.FIREBASE_PROJECT_ID }}
        env:
          FIREBASE_CLI_EXPERIMENTS: webframeworks

## 4. Environment Setup

### Development Environment
```env
# .env.local
NEXT_PUBLIC_FIREBASE_CONFIG={}
NEXT_PUBLIC_GEMINI_API_KEY=
STRIPE_SECRET_KEY=
FIREBASE_SERVICE_ACCOUNT={}
```

### GitHub Secrets Required
- FIREBASE_CONFIG
- GEMINI_API_KEY
- FIREBASE_SERVICE_ACCOUNT
- FIREBASE_PROJECT_ID
- STRIPE_SECRET_KEY

## 5. Deployment Strategy

### Preview Channels
```bash
# Create preview channel for feature testing
firebase hosting:channel:create feature-test
firebase hosting:channel:deploy feature-test

# Deploy to preview URL
firebase hosting:channel:deploy preview-name
```

### Production Deployment
```bash
# Manual deployment
npm run deploy

# Via GitHub Actions
git push origin main  # Automatic deployment
```

## 6. Monitoring and Maintenance

### Firebase Console Monitoring
- Hosting analytics
- Performance monitoring
- Error tracking
- Usage statistics

### Health Checks
```yaml
# firebase.json
{
  "hosting": {
    "headers": [
      {
        "source": "/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=3600"
          }
        ]
      }
    ]
  }
}
```
