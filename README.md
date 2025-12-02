# Social Listening Lead Generation API

A flexible, extensible API for monitoring social platforms (Reddit, Hacker News, etc.) to identify potential leads with buying intent.

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/macrobian88/social-listening-api.git
cd social-listening-api

# Install dependencies
npm install

# Start server
npm start

# Or with auto-reload
npm run dev
```

Server runs at `http://localhost:3000`

## 📡 API Endpoints

### List Platforms
```bash
curl http://localhost:3000/api/platforms
```

### Search Reddit Only
```bash
curl -X POST http://localhost:3000/api/search/reddit \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["CRM", "sales tool"],
    "intentKeywords": ["looking for", "need a", "recommend"],
    "platformFilters": {
      "reddit": {
        "subreddits": ["SaaS", "startups", "smallbusiness"],
        "timeFilter": "week",
        "minScore": 3
      }
    },
    "maxResults": 20
  }'
```

### Search All Platforms
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "keywords": ["CRM", "sales automation"],
      "intentKeywords": ["looking for", "need a", "alternative to"],
      "painKeywords": ["frustrated", "expensive", "complex"],
      "competitors": ["Salesforce", "HubSpot"],
      "maxResults": 25
    },
    "platforms": ["reddit", "hackernews"]
  }'
```

### Get Ranked Results
```bash
curl -X POST http://localhost:3000/api/search/ranked \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "keywords": ["project management"],
      "intentKeywords": ["switching from", "looking for"],
      "competitors": ["Asana", "Monday", "Jira"],
      "maxResults": 30
    }
  }'
```

## 📋 Search Criteria

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `keywords` | string[] | ✅ Yes | Main search terms |
| `intentKeywords` | string[] | No | Buying signals |
| `painKeywords` | string[] | No | Pain indicators |
| `competitors` | string[] | No | Competitor names |
| `platformFilters` | object | No | Platform-specific settings |
| `maxResults` | number | No | Max results (default: 25) |

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
    return { id, platform, title, body, url, author, metrics };
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
  myplatform: new MyPlatformAdapter(), // Add this
};
```

Done! New platform is now available at `/api/search/myplatform`

## 📁 Project Structure

```
src/
├── adapters/
│   ├── base.adapter.js      # Base class
│   ├── reddit.adapter.js    # Reddit
│   ├── hackernews.adapter.js # HN
│   └── index.js             # Registry
├── search.service.js        # Orchestration
└── index.js                 # Express API
```

## 🎯 Relevance Scoring

Posts are scored 0-100:
- Keyword matches: up to 40 points
- Intent keywords: up to 25 points
- Pain keywords: up to 20 points
- Competitor mentions: up to 15 points

## 🔮 Roadmap

- [x] Reddit adapter
- [x] Hacker News adapter  
- [ ] Stack Overflow adapter
- [ ] GitHub Discussions adapter
- [ ] AI intent scoring (GPT-4o-mini)
- [ ] Frappe CRM integration
- [ ] Redis caching/dedup
- [ ] Slack/email notifications

## 📝 License

MIT
