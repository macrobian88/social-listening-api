/**
 * Base Platform Adapter
 * 
 * All platform adapters extend this class. To add a new platform:
 * 1. Create a new file (e.g., stackoverflow.adapter.js)
 * 2. Extend BasePlatformAdapter
 * 3. Implement: search(), normalizePost(), buildQuery()
 * 4. Register in adapters/index.js
 */
class BasePlatformAdapter {
  constructor() {
    if (this.constructor === BasePlatformAdapter) {
      throw new Error('BasePlatformAdapter is abstract');
    }
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }

  // Override these in subclasses
  get platform() { throw new Error('Not implemented'); }
  get displayName() { throw new Error('Not implemented'); }
  get rateLimitPerMinute() { return 30; }

  /**
   * Main search method - must be implemented by each platform
   * @param {SearchCriteria} criteria 
   * @returns {Promise<SearchResult>}
   */
  async search(criteria) {
    throw new Error('search() must be implemented');
  }

  /**
   * Detect keyword/intent/pain/competitor signals in a post
   */
  detectSignals(post, criteria) {
    const text = `${post.title} ${post.body}`.toLowerCase();
    
    const matchedKeywords = (criteria.keywords || [])
      .filter(kw => text.includes(kw.toLowerCase()));
    
    const matchedIntentKeywords = (criteria.intentKeywords || [])
      .filter(kw => text.includes(kw.toLowerCase()));
    
    const matchedPainKeywords = (criteria.painKeywords || [])
      .filter(kw => text.includes(kw.toLowerCase()));
    
    const matchedCompetitors = (criteria.competitors || [])
      .filter(comp => text.includes(comp.toLowerCase()));

    // Calculate relevance score (0-100)
    let score = 0;
    const totalKeywords = criteria.keywords?.length || 1;
    
    // Keyword matches: up to 40 points
    score += (matchedKeywords.length / totalKeywords) * 40;
    
    // Intent keywords: up to 25 points (strong buying signals)
    score += Math.min(matchedIntentKeywords.length * 12.5, 25);
    
    // Pain keywords: up to 20 points (active problem)
    score += Math.min(matchedPainKeywords.length * 10, 20);
    
    // Competitor mentions: up to 15 points (very strong signal)
    score += Math.min(matchedCompetitors.length * 15, 15);

    return {
      matchedKeywords,
      matchedIntentKeywords,
      matchedPainKeywords,
      matchedCompetitors,
      relevanceScore: Math.round(Math.min(score, 100))
    };
  }

  /**
   * Simple rate limiting
   */
  async checkRateLimit() {
    const now = Date.now();
    if (this.lastResetTime < now - 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    if (this.requestCount >= this.rateLimitPerMinute) {
      const waitTime = 60000 - (now - this.lastResetTime);
      await new Promise(r => setTimeout(r, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }
    
    this.requestCount++;
  }

  /**
   * Helper to create error result
   */
  errorResult(criteria, error) {
    return {
      success: false,
      platform: this.platform,
      posts: [],
      totalFound: 0,
      searchedAt: new Date().toISOString(),
      error: error.message || error
    };
  }

  /**
   * Helper to create success result
   */
  successResult(criteria, posts, totalFound) {
    return {
      success: true,
      platform: this.platform,
      posts,
      totalFound: totalFound ?? posts.length,
      searchedAt: new Date().toISOString()
    };
  }
}

module.exports = { BasePlatformAdapter };