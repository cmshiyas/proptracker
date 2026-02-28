# PropTracker

Property portfolio analysis with Google Auth, AI-powered extraction (OpenAI), and Firestore.

## Deploy Steps

### 1. Install dependencies
```bash
npm install
cd functions && npm install --legacy-peer-deps && cd ..
```

### 2. Get a free OpenAI API key
- Go to https://platform.openai.com/api-keys
- Sign up (free) and create a new API key
- New accounts get free credits to start

### 3. Set your OpenAI API key as a Firebase secret
```bash
npx firebase-tools functions:secrets:set OPENAI_API_KEY --project proptracker-5408f
# Paste your sk-... key when prompted
```

### 4. Upgrade Firebase to Blaze plan (required for Cloud Functions)
- console.firebase.google.com -> proptracker-5408f -> Upgrade -> Blaze
- Free up to 2M function calls/month, you won't be charged for normal use

### 5. Build and deploy
```bash
npm run build
npx firebase-tools deploy --project proptracker-5408f
```
