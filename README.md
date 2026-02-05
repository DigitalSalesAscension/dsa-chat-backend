# DSA Ray-I Chat Backend

Professional Node.js backend for Digital Sales Ascension's Ray-I chat interface with Claude integration and n8n fallback.

## 🚀 Features

- **Claude Integration**: Primary AI using Claude-3.5-Sonnet with DSA coaching personality
- **n8n Fallback**: Automatic fallback to existing n8n webhook if Claude fails
- **CORS Support**: Proper CORS handling for Netlify/Vercel frontends
- **Rate Limiting**: Protection against abuse (30 requests/minute)
- **Language Detection**: Auto-detects Dutch/English
- **Security**: Helmet, rate limiting, input validation
- **Health Checks**: Monitoring endpoints for production

## 🛠️ Quick Deploy

### Vercel (Recommended)

1. **Clone & Deploy**:
```bash
git clone <your-repo>
cd dsa-chat-backend-quick
vercel
```

2. **Add Environment Variables**:
```bash
vercel env add ANTHROPIC_API_KEY
# Paste your Claude API key from https://console.anthropic.com/
```

3. **Deploy**:
```bash
vercel --prod
```

### Railway Alternative

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

## 🔧 Environment Variables

Create `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
PORT=3000
NODE_ENV=production
```

## 📡 API Endpoints

### `POST /api/chat`
Main chat endpoint for Ray-I interactions.

**Request**:
```json
{
  "message": "How do I handle price objections?",
  "sessionId": "user-session-123",
  "language": "en"
}
```

**Response**:
```json
{
  "response": "Here's how to handle price objections...",
  "source": "claude",
  "language": "en",
  "sessionId": "user-session-123",
  "timestamp": "2026-02-05T17:52:00.000Z"
}
```

### `GET /api/health`
Health check endpoint.

### `GET /api/status`
System status and configuration.

## 🔄 How It Works

1. **Request comes in** to `/api/chat`
2. **Language detection** runs on the message
3. **Claude API called** first with DSA coaching personality
4. **If Claude fails**: Automatic fallback to n8n webhook
5. **Response returned** with source indicator

## 🎯 Ray-I Personality

The backend includes a comprehensive Ray-I personality system:

- **Identity**: Premium DSA sales coach created by Rebien Ghazali
- **Expertise**: High-ticket sales, customer psychology, course guidance
- **Style**: Direct, energetic, matches Rebien's no-fluff approach
- **Languages**: English/Dutch with automatic detection
- **Focus**: Practical, actionable coaching for DSA students

## 🔒 Security Features

- **Rate Limiting**: 30 requests per minute per IP
- **CORS Protection**: Configured for legitimate frontends only
- **Helmet**: Security headers for production
- **Input Validation**: Sanitized inputs and error handling
- **No Data Logging**: Messages not stored for privacy

## 🌍 Frontend Integration

Update your frontend to use the new backend:

```javascript
// Replace direct n8n webhook URL with:
const BACKEND_URL = 'https://your-backend.vercel.app/api/chat';

// In your chat function:
const response = await fetch(BACKEND_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: message,
    sessionId: sessionId,
    language: detectedLanguage
  })
});
```

## 📊 Monitoring

Check backend status:
- `https://your-backend.vercel.app/api/health` - Simple health check
- `https://your-backend.vercel.app/api/status` - Detailed system status

## 🐛 Troubleshooting

### Claude Not Working
1. Check `ANTHROPIC_API_KEY` environment variable
2. Verify API key at https://console.anthropic.com/
3. Check Vercel function logs

### CORS Issues
1. Verify frontend domain in CORS origins
2. Check browser network tab for preflight requests
3. Ensure proper headers in frontend requests

### n8n Fallback
- Backend automatically falls back to n8n if Claude fails
- Check logs to see which service responded
- n8n webhook URL is hardcoded but can be made configurable

## 📈 Performance

- **Cold Start**: ~2-3 seconds (Vercel)
- **Warm Response**: ~200-500ms (Claude API)
- **Fallback Response**: ~800-1200ms (n8n webhook)
- **Rate Limit**: 30 requests/minute/IP

## 🚀 Deployment URLs

After deployment, your backend will be available at:
- **Vercel**: `https://dsa-chat-backend.vercel.app`
- **Railway**: `https://dsa-chat-backend.up.railway.app`

Update your frontend to use the new backend URL instead of calling n8n directly!

## 💡 Next Steps

1. Deploy the backend to Vercel/Railway
2. Get your Claude API key from Anthropic Console
3. Update frontend to use new backend URL
4. Test the chat interface
5. Monitor with health check endpoints

Your DSA chat interface will now work perfectly on Netlify! 🎉