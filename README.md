# Social Listening Lead Generation API

A flexible, extensible API for monitoring social platforms (Reddit, Hacker News, etc.) to identify potential leads with buying intent.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Or with auto-reload for development
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

### Get Ranked Results (Merged & Sorted)
```bash
curl -X POST http://localhost:3000/api/search/ranked \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": {
      "keywords": ["project management", "task tracking"],
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
| `intentKeywords` | string[] | No | Buying signals: "looking for", "need a", "recommend" |
| `painKeywords` | string[] | No | Pain indicators: "frustrated", "expensive", "manual" |
| `competitors` | string[] | No | Competitor names to detect |
| `platformFilters` | object | No | Platform-specific settings |
| `timeRange` | object | No | `{ "preset": "week" }` or `{ "from": "...", "to": "..." }` |
| `maxResults` | number | No | Max results per platform (default: 25) |

### Platform Filters

**Reddit:**
```json
{
  "reddit": {
    "subreddits": ["SaaS", "startups"],
    "sortBy": "relevance",
    "timeFilter": "week",
    "minScore": 5
  }
}
```

**Hacker News:**
```json
{
  "hackerNews": {
    "sortBy": "relevance",
    "storyType": "ask_hn",
    "minPoints": 10
  }
}
```

## 📊 Response Format

```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "abc123",
        "platform": "reddit",
        "title": "Looking for a simple CRM for my startup",
        "body": "We've been using spreadsheets but it's getting painful...",
        "url": "https://reddit.com/r/startups/...",
        "author": {
          "username": "founder123",
          "profileUrl": "https://reddit.com/user/founder123"
        },
        "metrics": {
          "score": 42,
          "comments": 28
        },
        "subreddit": "startups",
        "signals": {
          "matchedKeywords": ["CRM"],
          "matchedIntentKeywords": ["looking for"],
          "matchedPainKeywords": ["spreadsheets"],
          "matchedCompetitors": [],
          "relevanceScore": 72
        }
      }
    ],
    "totalFound": 15,
    "byPlatform": {
      "reddit": 10,
      "hackernews": 5
    }
  }
}
```

## 🔌 Adding a New Platform

The architecture makes it trivial to add new platforms. Here's how:

### 1. Create the Adapter

Create `src/adapters/stackoverflow.adapter.js`:

```javascript
const axios = require('axios');
const { BasePlatformAdapter } = require('./base.adapter');

class StackOverflowAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    this.client = axios.create({
      baseURL: 'https://api.stackexchange.com/2.3',
      timeout: 10000
    });
  }

  get platform() { return 'stackoverflow'; }
  get displayName() { return 'Stack Overflow'; }
  get rateLimitPerMinute() { return 30; }

  async search(criteria) {
    try {
      await this.checkRateLimit();
      
      const query = this.buildQuery(criteria);
      const response = await this.client.get('/search', {
        params: {
          intitle: query,
          site: 'stackoverflow',
          sort: 'relevance'
        }
      });

      const posts = response.data.items.map(item => {
        const normalized = this.normalizePost(item);
        normalized.signals = this.detectSignals(normalized, criteria);
        return normalized;
      });

      return this.successResult(criteria, posts);
      
    } catch (error) {
      return this.errorResult(criteria, error);
    }
  }

  buildQuery(criteria) {
    return criteria.keywords.join(' ');
  }

  normalizePost(item) {
    return {
      id: item.question_id.toString(),
      platform: 'stackoverflow',
      title: item.title,
      body: item.body || '',
      url: item.link,
      author: {
        username: item.owner.display_name,
        profileUrl: item.owner.link
      },
      metrics: {
        score: item.score,
        views: item.view_count,
        answers: item.answer_count
      },
      tags: item.tags,
      createdAt: new Date(item.creation_date * 1000).toISOString()
    };
  }
}

module.exports = { StackOverflowAdapter };
```

### 2. Register the Adapter

Edit `src/adapters/index.js`:

```javascript
const { RedditAdapter } = require('./reddit.adapter');
const { HackerNewsAdapter } = require('./hackernews.adapter');
const { StackOverflowAdapter } = require('./stackoverflow.adapter'); // Add this

const adapters = {
  reddit: new RedditAdapter(),
  hackernews: new HackerNewsAdapter(),
  stackoverflow: new StackOverflowAdapter(), // Add this
};
```

**That's it!** The new platform is now available at:
- `POST /api/search/stackoverflow`
- Automatically included in `/api/search` and `/api/search/ranked`

## 📁 Project Structure

```
src/
├── adapters/
│   ├── base.adapter.js      # Base class (extend this)
│   ├── reddit.adapter.js    # Reddit implementation
│   ├── hackernews.adapter.js # HN implementation
│   └── index.js             # Adapter registry
├── search.service.js        # Search orchestration
└── index.js                 # Express API
```

## 🎯 Relevance Scoring

Posts are automatically scored 0-100:

| Signal | Points | Description |
|--------|--------|-------------|
| Keyword matches | Up to 40 | Based on % of keywords found |
| Intent keywords | Up to 25 | "looking for", "need a" = strong signal |
| Pain keywords | Up to 20 | "frustrated", "expensive" = active problem |
| Competitor mentions | Up to 15 | Highest intent signal |

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