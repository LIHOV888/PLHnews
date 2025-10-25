# TODO: Fix Database Connection for Deployment

## Issue
- Local development: DB connection works
- Deployment: DB connection fails, falls back to mock data

## Root Cause
- DB connection was only initialized when `require.main === module` (local development)
- In serverless deployment, the connection code wasn't executed

## Solution Implemented
- Moved DB connection initialization to module load time
- Wrapped in immediately invoked async function to handle both local and deployment environments
- DB connection now attempts at startup in both cases

## Testing
- [x] Test local development: `npm run dev` - Server starts successfully
- [x] Verify DB connection status in logs - Confirmed "MongoDB connected to live server"
- [ ] Test deployment: Deploy to hosting platform
- [ ] Verify articles load from DB when connected, fallback to mock when not

## Files Modified
- server.js: Restructured DB initialization and server startup logic
