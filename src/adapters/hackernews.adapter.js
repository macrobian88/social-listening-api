const axios = require('axios');
const { BasePlatformAdapter } = require('./base.adapter');

/**
 * Hacker News Platform Adapter
 * 
 * Uses the FREE Algolia-powered HN Search API
 * No authentication required!
 * 
 * API Docs: https://hn.algolia.com/api
 */
class HackerNewsAdapter extends BasePlatformAdapter {
  constructor() {
    super();
    this.client = axios.create({
      baseURL: 'https://hn.algolia.com/api/v1',
      timeout: 10000
    });
  }

  get platform() { return 'hackernews'; }
  get displayName() { return 'Hacker News'; }
  get rateLimitPerMinute() { return 100; } // Algolia is generous

  /**
   * Search Hacker News
   */
  async search(criteria) {
    try {
      await this.checkRateLimit();
      
      const filters = criteria.platformFilters?.hackerNews || {};
      const maxResults = criteria.maxResults || 25;
      const query = this.buildQuery(criteria);

      // Choose endpoint: search (relevance) or search_by_date
      const endpoint = filters.sortBy === 'date' ? '/search_by_date' : '/search';
      
      // Build filters
      const tags = this.buildTags(filters);
      const numericFilters = this.buildNumericFilters(filters, criteria.timeRange);

      console.log(`[HN] Search: "${query}" (${filters.storyType || 'all'})`);

      const response = await this.client.get(endpoint, {
        params: {
          query,
          tags,
          numericFilters,
          hitsPerPage: Math.min(maxResults, 100)
        }
      });

      const posts = response.data.hits
        .map(hit => {
          const normalized = this.normalizePost(hit);
          normalized.signals = this.detectSignals(normalized, criteria);
          return normalized;
        })
        .filter(post => post.signals.relevanceScore > 0);

      return this.successResult(criteria, posts, response.data.nbHits);

    } catch (error) {
      console.error(`HN search error: ${error.message}`);
      return this.errorResult(criteria, error);
    }
  }

  /**
   * Build search query
   */
  buildQuery(criteria) {
    const parts = [];
    
    if (criteria.keywords?.length) {
      parts.push(...criteria.keywords);
    }
    
    if (criteria.intentKeywords?.length) {
      parts.push(...criteria.intentKeywords.slice(0, 2));
    }
    
    if (criteria.competitors?.length) {
      parts.push(...criteria.competitors.slice(0, 2));
    }
    
    return parts.join(' ');
  }

  /**
   * Build tags filter for story type
   */
  buildTags(filters) {
    switch (filters.storyType) {
      case 'story': return 'story';
      case 'comment': return 'comment';
      case 'ask_hn': return 'ask_hn';
      case 'show_hn': return 'show_hn';
      default: return '(story,ask_hn,show_hn)'; // Best for finding leads
    }
  }

  /**
   * Build numeric filters
   */
  buildNumericFilters(filters, timeRange) {
    const parts = [];
    
    // Minimum points
    if (filters.minPoints > 0) {
      parts.push(`points>=${filters.minPoints}`);
    }
    
    // Time range
    if (timeRange) {
      const now = Math.floor(Date.now() / 1000);
      const presets = {
        hour: 3600,
        day: 86400,
        week: 604800,
        month: 2592000,
        year: 31536000
      };
      
      let fromTs;
      if (timeRange.preset) {
        fromTs = now - (presets[timeRange.preset] || presets.week);
      } else if (timeRange.from) {
        fromTs = Math.floor(new Date(timeRange.from).getTime() / 1000);
      } else {
        fromTs = now - presets.week;
      }
      
      parts.push(`created_at_i>${fromTs}`);
    }
    
    return parts.join(',');
  }

  /**
   * Normalize HN post to standard format
   */
  normalizePost(hit) {
    const isComment = hit._tags?.includes('comment');
    
    return {
      id: hit.objectID,
      platform: 'hackernews',
      title: hit.title || hit.story_title || 'Comment',
      body: hit.story_text || hit.comment_text || '',
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: {
        username: hit.author,
        profileUrl: `https://news.ycombinator.com/user?id=${hit.author}`
      },
      metrics: {
        score: hit.points || 0,
        comments: hit.num_comments || 0
      },
      createdAt: hit.created_at,
      storyType: this.getStoryType(hit._tags)
    };
  }

  getStoryType(tags) {
    if (tags?.includes('ask_hn')) return 'Ask HN';
    if (tags?.includes('show_hn')) return 'Show HN';
    if (tags?.includes('comment')) return 'Comment';
    return 'Story';
  }
}

module.exports = { HackerNewsAdapter };