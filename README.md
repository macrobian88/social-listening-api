# Social Listening Lead Generation API

A flexible, extensible API for monitoring social platforms (Reddit, Hacker News, etc.) to identify potential leads with buying intent. **Now with AI-powered intent scoring using GPT-4o-mini!**

## ✨ Features

- 🔍 **Multi-Platform Search**: Reddit, Hacker News (more coming)
- 🤖 **AI Intent Scoring**: GPT-4o-mini analyzes posts for buying signals
- 🎯 **Smart Relevance**: Keyword, intent, pain point, and competitor detection
- 🔌 **Extensible**: Easy adapter pattern to add new platforms
- 💰 **Cost-Effective**: Uses GPT-4o-mini (~$0.15/1M input tokens)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure (required for AI scoring)
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start server
npm start
```

Server runs at `http://localhost:3000`

## 🤖 AI Intent Scoring

The killer feature! GPT-4o-mini analyzes each post and returns:

| Field | Description |
|-------|-------------|
| `score` | 0-100 buying intent score |
| `level` | HIGH, MEDIUM, LOW, NONE |
| `confidence` | 0.0-1.0 confidence in assessment |
| `buyingSignals` | Detected buying indicators |
| `painPoints` | Extracted pain points |
| `urgency` | IMMEDIATE, SHORT_TERM, EXPLORING, NONE |
| `recommendedAction` | CONTACT_NOW, NURTURE, MONITOR, SKIP |
| `summary` | One-sentence opportunity summary |

### Example: Find HubSpot Alternative Seekers

```bash
curl -X POST http://localhost:3000/api/search/ai \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "keywords": ["CRM", "marketing automation", "sales software"],
      "intentKeywords": ["alternative to", "switching from", "replacing", "looking for"],
      "painKeywords": ["too expensive", "complex", "frustrated", "overkill"],
      "competitors": ["HubSpot", "Hubspot"],
      "platformFilters": {
        "reddit": {
          "subreddits": ["SaaS", "startups", "Entrepreneur", "smallbusiness"],
          "timeFilter": "month",
          "minScore": 3
        }
      },
      "maxResults": 30
    },
    "platforms": ["reddit", "hackernews"],
    "aiOptions": {
      "productContext": {
        "productName": "MyCRM",
        "productType": "Simple CRM for SMBs",
        "problemsSolved": ["lead management", "sales pipeline", "contact tracking"],
        "competitors": ["HubSpot", "Salesforce", "Pipedrive"]
      },
      "minRelevanceScore": 30,
      "maxToScore": 20
    }
  }'
```

### AI Response Example

```json
{
  "success": true,
  "data": {
    "posts": [...],
    "hotLeads": [
      {
        "id": "abc123",
        "platform": "reddit",
        "title": "HubSpot is way too expensive for my 5-person startup. What else?",
        "subreddit": "startups",
        "intentAnalysis": {
          "score": 92,
          "level": "HIGH",
          "confidence": 0.95,
          "buyingSignals": [
            "Actively seeking alternatives",
            "Mentions team size (budget context)",
            "Asking for recommendations"
          ],
          "painPoints": [
            "Cost/pricing concerns",
            "Feature bloat for small team"
          ],
          "urgency": "SHORT_TERM",
          "recommendedAction": "CONTACT_NOW",
          "summary": "Small startup founder actively looking for affordable HubSpot alternative - high conversion potential"
        }
      }
    ],
    "byIntentLevel": {
      "HIGH": 3,
      "MEDIUM": 8,
      "LOW": 5,
      "NONE": 2,
      "UNSCORED": 12
    },
    "aiScoring": {
      "enabled": true,
      "model": "gpt-4o-mini",
      "scored": 18,
      "skipped": 12
    }
  }
}
```

## 📡 API Endpoints

### GET /api/platforms
List available platforms and AI status.

### POST /api/search
Basic multi-platform search (no AI scoring).

### POST /api/search/ranked
Search with keyword-based relevance ranking.

### POST /api/search/ai 🤖
**Search with AI intent scoring** - the main endpoint!

### POST /api/search/:platform
Search a specific platform.

## 📋 Search Criteria

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keywords` | string[] | ✅ Yes | Main search terms |
| `intentKeywords` | string[] | No | Buying signals |
| `painKeywords` | string[] | No | Pain indicators |
| `competitors` | string[] | No | Competitor names |
| `platformFilters` | object | No | Platform-specific settings |
| `maxResults` | number | No | Max results (default: 25) |

## 🎯 AI Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `productContext.productName` | string | - | Your product name |
| `productContext.productType` | string | - | What your product is |
| `productContext.problemsSolved` | string[] | - | Problems you solve |
| `productContext.competitors` | string[] | - | Your competitors |
| `minRelevanceScore` | number | 30 | Min keyword score to AI-score |
| `maxToScore` | number | 20 | Max posts to send to AI |

## 💡 Search Strategy Tips

### For finding competitor churners:

```json
{
  "intentKeywords": [
    "alternative to", "switching from", "leaving", 
    "canceling", "replacing", "migrating from"
  ],
  "painKeywords": [
    "too expensive", "overpriced", "complex", "bloated",
    "frustrating", "hate", "terrible support"
  ]
}
```

### For finding active buyers:

```json
{
  "intentKeywords": [
    "looking for", "need a", "recommend", "best tool",
    "what do you use", "suggestions for"
  ]
}
```

### For finding urgency:

```json
{
  "intentKeywords": [
    "ASAP", "urgent", "this week", "before launch",
    "immediately", "right now"
  ]
}
```

## 📁 Project Structure

```
src/
├── adapters/
│   ├── base.adapter.js         # Base class (extend this)
│   ├── reddit.adapter.js       # Reddit implementation
│   ├── hackernews.adapter.js   # HN implementation
│   └── index.js                # Adapter registry
├── services/
│   └── intent.service.js       # 🤖 GPT-4o-mini scoring
├── search.service.js           # Search orchestration
└── index.js                    # Express API
```

## 🔌 Adding a New Platform

1. Create `src/adapters/myplatform.adapter.js`:

```javascript
const { BasePlatformAdapter } = require('./base.adapter');

class MyPlatformAdapter extends BasePlatformAdapter {
  get platform() { return 'myplatform'; }
  get displayName() { return 'My Platform'; }
  
  async search(criteria) {
    // Your implementation
  }
  
  normalizePost(item) {
    // Normalize to standard format
  }
}

module.exports = { MyPlatformAdapter };
```

2. Register in `src/adapters/index.js`:

```javascript
const { MyPlatformAdapter } = require('./myplatform.adapter');

const adapters = {
  reddit: new RedditAdapter(),
  hackernews: new HackerNewsAdapter(),
  myplatform: new MyPlatformAdapter(), // Add here
};
```

Done! The new platform is automatically available.

## 💰 Cost Estimation

Using GPT-4o-mini:
- Input: ~$0.15 per 1M tokens
- Output: ~$0.60 per 1M tokens

**Typical usage:**
- ~500 tokens per post analysis
- 20 posts scored = ~10K tokens = ~$0.002

Very cost-effective for lead generation!

## 🔮 Roadmap

- [x] Reddit adapter
- [x] Hacker News adapter
- [x] AI intent scoring (GPT-4o-mini)
- [ ] Stack Overflow adapter
- [ ] Frappe CRM integration
- [ ] Slack/email notifications
- [ ] Redis caching/dedup
- [ ] Scheduled monitoring jobs

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `OPENAI_API_KEY` | For AI | OpenAI API key |
| `OPENAI_MODEL` | No | Model to use (default: gpt-4o-mini) |
| `REDDIT_USER_AGENT` | No | Reddit API user agent |

## 📝 License

MIT