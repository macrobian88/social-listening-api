require('dotenv').config();
const express = require('express');
const { SearchService } = require('./search.service');
const { getPlatformNames } = require('./adapters');

const app = express();
const searchService = new SearchService();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Request logging
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ============================================
// API ROUTES
// ============================================

/**
 * GET /
 * API info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Social Listening Lead Generation API',
    version: '1.1.0',
    features: {
      platforms: ['reddit', 'hackernews'],
      aiScoring: searchService.isAIEnabled() ? 'enabled' : 'disabled (set OPENAI_API_KEY)'
    },
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/platforms': 'List available platforms',
      'POST /api/search': 'Search across platforms',
      'POST /api/search/ranked': 'Search and get ranked results',
      'POST /api/search/ai': '🤖 Search with AI intent scoring',
      'POST /api/search/:platform': 'Search specific platform'
    }
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    aiScoring: searchService.isAIEnabled()
  });
});

/**
 * GET /api/platforms
 * List all available platforms
 */
app.get('/api/platforms', (req, res) => {
  res.json({
    success: true,
    platforms: searchService.getPlatforms(),
    aiScoring: {
      enabled: searchService.isAIEnabled(),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    }
  });
});

/**
 * POST /api/search
 * 
 * Search across multiple platforms (no AI scoring)
 */
app.post('/api/search', async (req, res) => {
  try {
    const { criteria, platforms } = req.body;
    
    if (!criteria?.keywords?.length) {
      return res.status(400).json({
        success: false,
        error: 'criteria.keywords is required and must not be empty'
      });
    }

    const result = await searchService.search(criteria, platforms);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search/ranked
 * 
 * Search and return merged, relevance-ranked results (no AI)
 */
app.post('/api/search/ranked', async (req, res) => {
  try {
    const { criteria, platforms } = req.body;
    
    if (!criteria?.keywords?.length) {
      return res.status(400).json({
        success: false,
        error: 'criteria.keywords is required'
      });
    }

    const result = await searchService.searchRanked(criteria, platforms);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search/ai
 * 
 * 🤖 Search with AI intent scoring using GPT-4o-mini
 * 
 * Body:
 * {
 *   "criteria": {
 *     "keywords": ["CRM", "sales tool"],
 *     "intentKeywords": ["looking for", "alternative to"],
 *     "painKeywords": ["frustrated", "expensive"],
 *     "competitors": ["HubSpot", "Salesforce"],
 *     "maxResults": 30
 *   },
 *   "platforms": ["reddit", "hackernews"],
 *   "aiOptions": {
 *     "productContext": {
 *       "productName": "MyCRM",
 *       "productType": "CRM Software",
 *       "problemsSolved": ["lead management", "sales tracking"],
 *       "competitors": ["HubSpot", "Salesforce"]
 *     },
 *     "minRelevanceScore": 30,
 *     "maxToScore": 20
 *   }
 * }
 */
app.post('/api/search/ai', async (req, res) => {
  try {
    const { criteria, platforms, aiOptions = {} } = req.body;
    
    if (!criteria?.keywords?.length) {
      return res.status(400).json({
        success: false,
        error: 'criteria.keywords is required'
      });
    }

    // Check if AI is enabled
    if (!searchService.isAIEnabled()) {
      return res.status(400).json({
        success: false,
        error: 'AI scoring is not enabled. Set OPENAI_API_KEY environment variable.',
        hint: 'Add OPENAI_API_KEY=sk-your-key to your .env file'
      });
    }

    const result = await searchService.searchWithAI(criteria, platforms, aiOptions);
    
    res.json({ 
      success: true, 
      data: result,
      tip: 'Check "hotLeads" array for HIGH intent leads ready to contact!'
    });
    
  } catch (error) {
    console.error('AI Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/search/:platform
 * 
 * Search a specific platform
 */
app.post('/api/search/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const criteria = req.body;
    
    // Validate platform
    const validPlatforms = getPlatformNames();
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Invalid platform: ${platform}`,
        validPlatforms
      });
    }
    
    if (!criteria?.keywords?.length) {
      return res.status(400).json({
        success: false,
        error: 'keywords is required'
      });
    }

    const result = await searchService.searchPlatform(criteria, platform);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  const aiStatus = searchService.isAIEnabled() 
    ? '✅ AI Scoring ENABLED (GPT-4o-mini)' 
    : '⚠️  AI Scoring DISABLED (set OPENAI_API_KEY)';
    
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Social Listening Lead Generation API v1.1             ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                            ║
║  ${aiStatus}       
║                                                           ║
║  Endpoints:                                               ║
║    GET  /api/health           - Health check              ║
║    GET  /api/platforms        - List platforms            ║
║    POST /api/search           - Multi-platform search     ║
║    POST /api/search/ranked    - Ranked results            ║
║    POST /api/search/ai        - 🤖 AI intent scoring      ║
║    POST /api/search/:platform - Single platform           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;