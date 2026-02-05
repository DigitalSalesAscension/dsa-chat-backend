const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 DSA Ray-I Backend Starting...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  hasKey: !!process.env.ANTHROPIC_API_KEY,
  keyLength: process.env.ANTHROPIC_API_KEY?.length
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['https://rayi-modern.netlify.app', 'https://dsa-premium-chat.vercel.app', 'https://dsa-premium-chat.netlify.app', 'http://localhost:3000', 'https://*.netlify.app', 'https://*.vercel.app'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DSA Ray-I Backend is running',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  });
});

// Initialize Anthropic client
let anthropic = null;

function initializeAnthropic() {
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('✅ Anthropic client initialized');
      return true;
    } catch (error) {
      console.error('❌ Anthropic initialization failed:', error);
      return false;
    }
  }
  return !!anthropic;
}

// Simple language detection
function detectLanguage(text) {
  const dutchWords = ['het', 'van', 'een', 'de', 'en', 'is', 'dat', 'ik', 'niet', 'hij', 'zijn', 'op', 'aan', 'met', 'voor', 'maar', 'om', 'dan', 'zou', 'of', 'wat', 'mijn', 'dit', 'zo', 'door', 'over', 'ze', 'zich', 'bij', 'ook', 'tot', 'je', 'mij', 'uit', 'daar', 'naar', 'heb', 'hoe', 'heeft', 'kunnen', 'worden', 'nu', 'zal', 'me', 'nog', 'tegen', 'na', 'wil', 'kon', 'niets'];
  const words = text.toLowerCase().split(/\s+/);
  const dutchCount = words.filter(word => dutchWords.includes(word)).length;
  return dutchCount / words.length > 0.15 ? 'dutch' : 'english';
}

// Ray-I system prompt
const SYSTEM_PROMPT = `You are Ray-I, the premium AI sales coach for Digital Sales Ascension (DSA), created by Rebien Ghazali.

IDENTITY:
- Name: Ray-I (pronounced "Ray")  
- Role: Premium DSA sales coach and course assistant
- Style: Direct, energetic, no-fluff approach like Rebien
- Emoji signature: ⚡

MISSION:
Help DSA students master high-ticket closing and achieve breakthrough results.

EXPERTISE:
- High-ticket sales psychology and techniques
- DSA course curriculum guidance  
- Objection handling frameworks
- Closing strategies for €4K+ offers
- Student motivation and mindset coaching

STYLE:
- Direct and actionable - no corporate fluff
- Use bullet points for clarity
- Provide specific examples and next steps  
- Match the user's energy level
- Push for implementation over theory

DUTCH SUPPORT:
Automatically detect Dutch and respond naturally in Dutch when appropriate.

Remember: You're coaching champions toward their first €10K month. Every response should move them forward.

End motivational responses with ⚡`;

// Debug endpoint
app.post('/debug', async (req, res) => {
  try {
    console.log('🔍 Debug test starting...');
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.json({ error: 'No API key found' });
    }
    
    console.log('API Key length:', apiKey.length);
    console.log('API Key starts with:', apiKey.substring(0, 15) + '...');
    
    const Anthropic = require('@anthropic-ai/sdk');
    console.log('SDK imported successfully');
    
    const client = new Anthropic({ apiKey });
    console.log('Client created successfully');
    
    console.log('Making API call...');
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say hello briefly' }]
    });
    
    console.log('API call successful!');
    
    res.json({
      success: true,
      response: response.content[0].text,
      usage: response.usage
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.json({
      success: false,
      errorMessage: error.message,
      errorType: error.type,
      errorStatus: error.status,
      errorCode: error.code
    });
  }
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    console.log('📨 Chat request received');
    
    const { message, conversationHistory = [] } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ 
        error: 'Message required',
        message: 'Please provide a message to chat with Ray-I'
      });
    }

    // Initialize Anthropic
    if (!initializeAnthropic()) {
      return res.status(500).json({
        error: 'Service Unavailable',
        message: 'Ray-I is temporarily offline. Please try again later.'
      });
    }

    const language = detectLanguage(message);
    
    // Build messages array
    const messages = [
      ...conversationHistory.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    console.log(`🧠 Processing ${language} message with ${messages.length} context messages`);
    
    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    const reply = response.content[0].text;
    console.log(`✅ Generated ${reply.length} char response`);
    
    res.json({
      reply,
      language,
      timestamp: new Date().toISOString(),
      tokens: response.usage?.output_tokens || 0
    });

  } catch (error) {
    console.error('💥 Chat error:', error);
    
    // Specific error handling
    if (error.status === 401) {
      return res.status(500).json({
        error: 'Authentication Error',
        message: 'Ray-I authentication failed. Please contact support.'
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate Limit',
        message: 'Too many requests. Please wait a moment and try again.'
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Request Error',
        message: 'Invalid message format. Please try rephrasing your question.'
      });
    }
    
    res.status(500).json({
      error: 'Service Error', 
      message: 'Ray-I is experiencing technical difficulties. Please try again in a moment.',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handlers
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Unexpected Error',
    message: 'Something unexpected happened'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found',
    available: ['GET /', 'POST /chat']
  });
});

// Export for Vercel
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎯 DSA Ray-I Backend running on port ${PORT}`);
  });
}