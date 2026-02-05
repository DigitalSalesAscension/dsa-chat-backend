const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging
console.log('Starting server...');
console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  port: PORT
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
  max: 30,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'ok', 
    message: 'DSA Ray-I Backend is running',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  });
});

// Initialize Anthropic client only when needed
let anthropic = null;

function getAnthropicClient() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      console.log('Anthropic client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
      throw error;
    }
  }
  return anthropic;
}

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
- Objection handling frameworks
- Closing strategies for high-ticket offers
- Student motivation and mindset coaching
- Practical implementation guidance

RESPONSE STYLE:
- Direct and actionable - no fluff or corporate speak
- Use bullet points and clear structure
- Include specific examples and tactics
- Match the user's energy level
- Provide immediate next steps
- Reference DSA methods and frameworks

DUTCH SUPPORT:
- Detect Dutch language automatically
- Respond naturally in Dutch when user speaks Dutch
- Use appropriate Dutch sales terminology
- Maintain same coaching energy in both languages

COACHING APPROACH:
1. Listen for the real challenge behind the question
2. Provide specific, actionable solutions
3. Reference relevant course materials
4. Give practical homework/next steps
5. Maintain high energy and confidence
6. Push for implementation, not just understanding

Remember: You're not just answering questions - you're coaching champions. Every interaction should move them closer to their first €10K month.

Signature style: End responses with ⚡ when providing high-energy motivation or breakthrough insights.`;

// Enhanced language detection
function detectLanguage(text) {
  const dutchWords = ['het', 'van', 'een', 'de', 'en', 'is', 'dat', 'ik', 'niet', 'hij', 'zijn', 'op', 'aan', 'met', 'als', 'voor', 'had', 'er', 'maar', 'om', 'hem', 'dan', 'zou', 'of', 'wat', 'mijn', 'men', 'dit', 'zo', 'door', 'over', 'ze', 'zich', 'bij', 'ook', 'tot', 'je', 'mij', 'uit', 'der', 'daar', 'haar', 'naar', 'heb', 'hoe', 'heeft', 'kunnen', 'ons', 'worden', 'nu', 'zal', 'me', 'nog', 'tegen', 'na', 'reeds', 'wil', 'kon', 'niets', 'uw', 'iemand', 'geweest', 'andere'];
  const words = text.toLowerCase().split(/\\s+/);
  const dutchCount = words.filter(word => dutchWords.includes(word)).length;
  const dutchRatio = dutchCount / words.length;
  
  console.log(`Language detection - Dutch words: ${dutchCount}/${words.length} (${(dutchRatio * 100).toFixed(1)}%)`);
  return dutchRatio > 0.15 ? 'dutch' : 'english';
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    console.log('Chat request received:', req.body);
    
    const { message, conversationHistory = [] } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ 
        error: 'Message is required',
        details: 'Please provide a message to chat with Ray-I'
      });
    }

    // Get Anthropic client (this will throw if API key is missing)
    const client = getAnthropicClient();
    
    // Detect language
    const language = detectLanguage(message);
    console.log(`Detected language: ${language}`);
    
    // Build conversation context
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    console.log('Sending request to Anthropic with messages:', messages.length);
    
    // Call Claude with updated model
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.7,
      system: RAY_I_SYSTEM_PROMPT,
      messages: messages
    });

    const reply = response.content[0].text;
    console.log('Received response from Anthropic, length:', reply.length);
    
    res.json({
      reply,
      language,
      timestamp: new Date().toISOString(),
      tokens: response.usage?.output_tokens || 0
    });

  } catch (error) {
    console.error('Chat error details:', {
      message: error.message,
      status: error.status,
      type: error.type,
      stack: error.stack
    });
    
    // Enhanced error handling
    if (error.message?.includes('ANTHROPIC_API_KEY')) {
      return res.status(500).json({
        error: 'Configuration Error',
        message: 'API key not configured properly. Please contact support.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.status === 401) {
      return res.status(500).json({
        error: 'Authentication Error',
        message: 'Invalid API key. Please contact support.',
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate Limit',
        message: 'Too many requests. Please try again in a moment.',
      });
    }
    
    if (error.status === 400) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request format. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Ray-I is temporarily unavailable. Please try again in a moment.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Unexpected Error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'Endpoint not found',
    availableEndpoints: ['GET /', 'POST /chat']
  });
});

// For Vercel
module.exports = app;

// For local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DSA Ray-I Backend running on port ${PORT}`);
  });
}