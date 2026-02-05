const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
// Using built-in fetch (Node.js 18+)

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['https://dsa-premium-chat.vercel.app', 'https://dsa-premium-chat.netlify.app', 'http://localhost:3000', 'https://*.netlify.app', 'https://*.vercel.app'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));

// Ray-I DSA Coach personality
const RAY_I_SYSTEM_PROMPT = `You are Ray-I, the premium AI sales coach for Digital Sales Ascension (DSA), created by Rebien Ghazali.

IDENTITY:
- Name: Ray-I (pronounced "Ray")
- Role: Premium DSA sales coach and course assistant
- Expertise: High-ticket sales, customer psychology, course guidance
- Style: Direct, energetic, matches Rebien's no-fluff approach
- Emoji: ⚡ (lightning bolt - represents speed and power)

CORE MISSION:
Help DSA students master high-ticket closing, overcome course obstacles, and achieve breakthrough results through expert coaching.

KNOWLEDGE AREAS:
- The entire DSA course structure and curriculum
- High-ticket sales techniques and psychology  
- Customer psychology and pain point identification
- Closing techniques and objection handling
- Sales mindset and confidence building
- Course-specific exercises and modules

COMMUNICATION STYLE:
- **Language Adaptability**: Respond in the user's language (English/Dutch)
- **Direct & Energetic**: Match Rebien's direct, no-nonsense coaching style
- **Practical Focus**: Give actionable advice and specific steps
- **Encouraging**: Build confidence while being honest about challenges
- **Psychology-Driven**: Explain the "why" behind techniques

RESPONSE FRAMEWORK:
1. Acknowledge the question/challenge
2. Provide specific, actionable guidance
3. Explain the psychology when relevant
4. Give next steps or practice exercises
5. Encourage application and practice

When students ask about:
- **Course content**: Guide them to specific modules and exercises
- **Sales techniques**: Provide frameworks and psychological insights
- **Mindset blocks**: Help identify and overcome limiting beliefs
- **Practice scenarios**: Create realistic role-play situations
- **Results**: Analyze what's working and what needs improvement

Always embody the premium, high-value positioning of DSA's €4,000+ programs.`;

// n8n webhook URL
const N8N_WEBHOOK_URL = 'https://digitalsalesascension.app.n8n.cloud/webhook/98cc7639-8db0-4008-986b-77efc74ce2d4/chat';

// Helper function to detect language
function detectLanguage(text) {
  const dutchWords = ['de', 'het', 'en', 'van', 'op', 'voor', 'met', 'een', 'is', 'zijn', 'dat', 'niet', 'ik', 'je', 'hij', 'zij', 'wij', 'hebben', 'kan', 'moet', 'wordt', 'dsa', 'cursus', 'verkoop'];
  const words = text.toLowerCase().split(/\\s+/).filter(word => word.length > 2);
  const dutchCount = words.filter(word => dutchWords.includes(word)).length;
  return words.length > 3 && (dutchCount / words.length) > 0.25 ? 'nl' : 'en';
}

// Helper function to call Claude
async function callClaude(message, language = 'en') {
  try {
    const languageInstruction = language === 'nl' 
      ? '\\n\\nRespond in Dutch (Nederlands). Use natural Dutch conversation style.'
      : '\\n\\nRespond in English.';

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system: RAY_I_SYSTEM_PROMPT + languageInstruction,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    return {
      success: true,
      response: response.content[0].text,
      source: 'claude'
    };
  } catch (error) {
    console.error('Claude API error:', error);
    return {
      success: false,
      error: error.message,
      source: 'claude'
    };
  }
}

// Helper function to call n8n webhook as fallback
async function callN8nWebhook(data) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DSA-Chat-Backend/1.0'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`n8n webhook error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: true,
      response: result.response || result.message || result.output || 'Response received from n8n',
      source: 'n8n'
    };
  } catch (error) {
    console.error('n8n webhook error:', error);
    return {
      success: false,
      error: error.message,
      source: 'n8n'
    };
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'DSA Ray-I Chat Backend',
    version: '1.0.0'
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    service: 'DSA Ray-I Chat Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    claude_available: !!process.env.ANTHROPIC_API_KEY,
    n8n_available: true,
    timestamp: new Date().toISOString()
  });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, language: providedLanguage } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        error: 'Message is required and must be a string' 
      });
    }

    // Detect language if not provided
    const detectedLanguage = providedLanguage || detectLanguage(message);
    
    // Log the request (but not the full message for privacy)
    console.log(`[${new Date().toISOString()}] Chat request - Session: ${sessionId}, Language: ${detectedLanguage}, Length: ${message.length}`);

    let result = null;

    // Try Claude first (if API key is available)
    if (process.env.ANTHROPIC_API_KEY) {
      result = await callClaude(message, detectedLanguage);
      
      if (!result.success) {
        console.warn('Claude failed, falling back to n8n:', result.error);
      }
    }

    // Fallback to n8n if Claude failed or unavailable
    if (!result || !result.success) {
      result = await callN8nWebhook({
        message,
        sessionId,
        language: detectedLanguage,
        timestamp: new Date().toISOString()
      });
    }

    // If both failed, return error
    if (!result.success) {
      console.error('Both Claude and n8n failed');
      return res.status(500).json({
        error: 'Sorry, I\\'m having trouble connecting right now. Please try again in a moment.',
        details: 'Both primary and fallback systems are unavailable'
      });
    }

    // Return successful response
    res.json({
      response: result.response,
      source: result.source,
      language: detectedLanguage,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error. Please try again.',
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DSA Ray-I Chat Backend',
    message: 'Digital Sales Ascension Chat API is running',
    version: '1.0.0',
    endpoints: {
      chat: 'POST /api/chat',
      health: 'GET /api/health', 
      status: 'GET /api/status'
    },
    documentation: 'https://github.com/your-username/dsa-chat-backend'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'The requested endpoint does not exist',
    available_endpoints: ['/api/chat', '/api/health', '/api/status']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DSA Ray-I Chat Backend running on port ${PORT}`);
  console.log(`⚡ Claude integration: ${process.env.ANTHROPIC_API_KEY ? '✅ Available' : '❌ No API key'}`);
  console.log(`🔗 n8n fallback: ✅ Available`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;