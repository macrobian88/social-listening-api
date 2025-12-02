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
    version: '1.0.0',
    endpoints: {
      'GET /api/health': 'Health check',
      'GET /api/platforms': 'List available platforms',
      'POST /api/search': 'Search across platforms',
      'POST /api/search/ranked': 'Search and get ranked results',
      'POST /api/search/:platform': 'Search specific platform'
    }
  });
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * GET /api/platforms
 * List all available platforms
 */
app.get('/api/platforms', (req, res) => {
  res.json({
    success: true,
    platforms: searchService.getPlatforms()
  });
});

/**
 * POST /api/search
 * 
 * Search across multiple platforms
 * 
 * Body:
 * {
 *   "criteria": {
 *     "keywords": ["CRM", "sales tool"],
 *     "intentKeywords": ["looking for", "need a", "recommend"],
 *     "painKeywords": ["frustrated", "spreadsheet"],
 *     "competitors": ["Salesforce", "HubSpot"],
 *     "platformFilters": {
 *       "reddit": { "subreddits": ["SaaS", "startups"], "timeFilter": "week" }
 *     },
 *     "timeRange": { "preset": "week" },
 *     "maxResults": 25
 *   },
 *   "platforms": ["reddit", "hackernews"]  // optional, defaults to all
 * }
 */
app.post('/api/search', async (req, res) => {
  try {
    const { criteria, platforms } = req.body;
    
    // Validate
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
 * Search and return merged, relevance-ranked results
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
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Social Listening Lead Generation API                  ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                 ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /api/health           - Health check              ║
║    GET  /api/platforms        - List platforms            ║
║    POST /api/search           - Multi-platform search     ║
║    POST /api/search/ranked    - Ranked results            ║
║    POST /api/search/:platform - Single platform           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;