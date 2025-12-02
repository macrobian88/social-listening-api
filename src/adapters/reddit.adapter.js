const axios = require('axios');
const { BasePlatformAdapter } = require('./base.adapter');

/**
 * Reddit Platform Adapter
 * 
 * Uses Reddit's free public JSON API (no auth required)
 * Just append .json to any Reddit URL!
 * 
 * Rate limit: ~30 requests/minute without OAuth
 */
class RedditAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    this.client = axios.create({
      baseURL: 'https://www.reddit.com',
      timeout: 10000,
      headers: {
        'User-Agent': process.env.REDDIT_USER_AGENT || 'SocialListening/1.0'
      }
    });
  }

  get platform() { return 'reddit'; }
  get displayName() { return 'Reddit'; }
  get rateLimitPerMinute() { return 30; }

  /**
   * Search Reddit for posts matching criteria
   */
  async search(criteria) {
    try {
      await this.checkRateLimit();
      
      const filters = criteria.platformFilters?.reddit || {};
      const maxResults = criteria.maxResults || 25;
      
      // If subreddits specified, search within them
      if (filters.subreddits?.length > 0) {
        return this.searchSubreddits(criteria, filters, maxResults);
      }
      
      // Otherwise, search all of Reddit
      return this.searchGlobal(criteria, filters, maxResults);
      
    } catch (error) {
      console.error(`Reddit search error: ${error.message}`);
      return this.errorResult(criteria, error);
    }
  }

  /**
   * Search all of Reddit
   */
  async searchGlobal(criteria, filters, maxResults) {
    const query = this.buildQuery(criteria);
    const timeFilter = filters.timeFilter || 'week';
    const sortBy = filters.sortBy || 'relevance';

    console.log(`[Reddit] Global search: "${query}" (${timeFilter}, ${sortBy})`);

    const response = await this.client.get('/search.json', {
      params: {
        q: query,
        sort: sortBy,
        t: timeFilter,
        limit: Math.min(maxResults, 100),
        type: 'link'
      }
    });

    const posts = this.processResponse(response.data, criteria, filters);
    return this.successResult(criteria, posts, response.data.data.dist);
  }

  /**
   * Search within specific subreddits
   */
  async searchSubreddits(criteria, filters, maxResults) {
    const query = this.buildQuery(criteria);
    const timeFilter = filters.timeFilter || 'week';
    const sortBy = filters.sortBy || 'relevance';
    const subreddits = filters.subreddits;
    const perSubreddit = Math.ceil(maxResults / subreddits.length);

    console.log(`[Reddit] Subreddit search: "${query}" in r/${subreddits.join(', r/')}`);

    const allPosts = [];

    for (const subreddit of subreddits) {
      try {
        await this.checkRateLimit();
        
        const response = await this.client.get(`/r/${subreddit}/search.json`, {
          params: {
            q: query,
            sort: sortBy,
            t: timeFilter,
            limit: perSubreddit,
            restrict_sr: true
          }
        });

        const posts = this.processResponse(response.data, criteria, filters);
        allPosts.push(...posts);
        
      } catch (error) {
        console.warn(`[Reddit] Failed to search r/${subreddit}: ${error.message}`);
      }
    }

    // Sort by relevance and limit
    const sortedPosts = allPosts
      .sort((a, b) => (b.signals?.relevanceScore || 0) - (a.signals?.relevanceScore || 0))
      .slice(0, maxResults);

    return this.successResult(criteria, sortedPosts, allPosts.length);
  }

  /**
   * Build search query from criteria
   */
  buildQuery(criteria) {
    const parts = [];
    
    // Main keywords (OR for wider net)
    if (criteria.keywords?.length) {
      parts.push(criteria.keywords.join(' OR '));
    }
    
    // Add a few intent keywords
    if (criteria.intentKeywords?.length) {
      parts.push(`(${criteria.intentKeywords.slice(0, 3).join(' OR ')})`);
    }
    
    // Add competitor names
    if (criteria.competitors?.length) {
      parts.push(`(${criteria.competitors.join(' OR ')})`);
    }
    
    return parts.join(' ') || '*';
  }

  /**
   * Process Reddit API response
   */
  processResponse(response, criteria, filters) {
    const minScore = filters.minScore || 0;
    
    return response.data.children
      .filter(item => {
        const post = item.data;
        if (post.score < minScore) return false;
        if (post.stickied || post.distinguished) return false;
        if (post.over_18) return false;
        return true;
      })
      .map(item => {
        const normalized = this.normalizePost(item.data);
        normalized.signals = this.detectSignals(normalized, criteria);
        return normalized;
      })
      .filter(post => post.signals.relevanceScore > 0);
  }

  /**
   * Normalize Reddit post to standard format
   */
  normalizePost(post) {
    return {
      id: post.id,
      platform: 'reddit',
      title: post.title,
      body: post.selftext || '',
      url: `https://www.reddit.com${post.permalink}`,
      author: {
        username: post.author,
        profileUrl: `https://www.reddit.com/user/${post.author}`
      },
      metrics: {
        score: post.score,
        upvoteRatio: post.upvote_ratio,
        comments: post.num_comments
      },
      createdAt: new Date(post.created_utc * 1000).toISOString(),
      subreddit: post.subreddit,
      flair: post.link_flair_text
    };
  }
}

module.exports = { RedditAdapter };
