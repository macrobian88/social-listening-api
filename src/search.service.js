const { getAdapter, getAllAdapters, getPlatformNames, getPlatformInfo } = require('./adapters');
const { intentScoringService } = require('./services/intent.service');

/**
 * Search Service
 * 
 * Orchestrates searches across multiple platforms.
 * Handles parallel execution, result aggregation, and AI scoring.
 */
class SearchService {
  
  /**
   * Search across specified platforms (or all if not specified)
   */
  async search(criteria, platforms = null, options = {}) {
    const targetPlatforms = platforms || getPlatformNames();
    
    console.log(`\n🔍 Starting search across: ${targetPlatforms.join(', ')}`);
    console.log(`   Keywords: ${criteria.keywords?.join(', ')}`);
    
    const results = [];
    const errors = [];

    // Search each platform in parallel
    const searchPromises = targetPlatforms.map(async (platform) => {
      const adapter = getAdapter(platform);
      
      if (!adapter) {
        errors.push({ platform, error: `Unknown platform: ${platform}` });
        return null;
      }

      try {
        const result = await adapter.search(criteria);
        return result;
      } catch (error) {
        errors.push({ platform, error: error.message });
        return null;
      }
    });

    const searchResults = await Promise.all(searchPromises);
    
    // Collect successful results
    for (const result of searchResults) {
      if (result) results.push(result);
    }

    const totalPosts = results.reduce((sum, r) => sum + r.posts.length, 0);
    
    console.log(`✅ Search complete: ${totalPosts} posts from ${results.length} platforms\n`);

    return {
      success: errors.length === 0,
      platforms: targetPlatforms,
      results,
      totalPosts,
      searchedAt: new Date().toISOString(),
      errors
    };
  }

  /**
   * Search and return merged, ranked results
   */
  async searchRanked(criteria, platforms = null) {
    const result = await this.search(criteria, platforms);
    
    // Merge all posts
    const allPosts = [];
    const byPlatform = {};
    
    for (const platformResult of result.results) {
      allPosts.push(...platformResult.posts);
      byPlatform[platformResult.platform] = platformResult.posts.length;
    }

    // Sort by relevance score (highest first)
    allPosts.sort((a, b) => {
      const scoreA = a.signals?.relevanceScore || 0;
      const scoreB = b.signals?.relevanceScore || 0;
      return scoreB - scoreA;
    });

    // Apply maxResults limit
    const limitedPosts = criteria.maxResults 
      ? allPosts.slice(0, criteria.maxResults)
      : allPosts;

    return {
      success: result.success,
      posts: limitedPosts,
      totalFound: allPosts.length,
      byPlatform,
      errors: result.errors
    };
  }

  /**
   * Search with AI intent scoring
   * 
   * @param {Object} criteria - Search criteria
   * @param {Array} platforms - Platforms to search
   * @param {Object} options - AI scoring options
   * @param {Object} options.productContext - Context about your product
   * @param {number} options.minRelevanceScore - Min keyword score to AI-score (default: 30)
   * @param {number} options.maxToScore - Max posts to AI-score (default: 20)
   */
  async searchWithAI(criteria, platforms = null, options = {}) {
    const {
      productContext = {},
      minRelevanceScore = 30,
      maxToScore = 20
    } = options;

    // First, do regular search
    const searchResult = await this.searchRanked(criteria, platforms);
    
    if (!searchResult.success || searchResult.posts.length === 0) {
      return {
        ...searchResult,
        aiScoring: {
          enabled: intentScoringService.isEnabled(),
          scored: 0,
          skipped: 0
        }
      };
    }

    // Filter posts worth AI-scoring (above min relevance threshold)
    const postsToScore = searchResult.posts
      .filter(p => (p.signals?.relevanceScore || 0) >= minRelevanceScore)
      .slice(0, maxToScore);

    const postsToSkip = searchResult.posts
      .filter(p => !postsToScore.includes(p));

    console.log(`🤖 AI Scoring: ${postsToScore.length} posts (skipping ${postsToSkip.length} below threshold)`);

    // Score with AI
    let scoredPosts = [];
    if (postsToScore.length > 0 && intentScoringService.isEnabled()) {
      scoredPosts = await intentScoringService.scoreBatch(postsToScore, productContext);
    } else {
      scoredPosts = postsToScore;
    }

    // Combine scored and unscored posts
    const allPosts = [...scoredPosts, ...postsToSkip];

    // Sort by AI score (if available) then by keyword relevance
    allPosts.sort((a, b) => {
      const aiScoreA = a.intentAnalysis?.score ?? -1;
      const aiScoreB = b.intentAnalysis?.score ?? -1;
      
      // AI-scored posts first, sorted by AI score
      if (aiScoreA >= 0 && aiScoreB >= 0) {
        return aiScoreB - aiScoreA;
      }
      if (aiScoreA >= 0) return -1;
      if (aiScoreB >= 0) return 1;
      
      // Then by keyword relevance
      return (b.signals?.relevanceScore || 0) - (a.signals?.relevanceScore || 0);
    });

    // Group by intent level for easy filtering
    const byIntentLevel = {
      HIGH: allPosts.filter(p => p.intentAnalysis?.level === 'HIGH'),
      MEDIUM: allPosts.filter(p => p.intentAnalysis?.level === 'MEDIUM'),
      LOW: allPosts.filter(p => p.intentAnalysis?.level === 'LOW'),
      NONE: allPosts.filter(p => p.intentAnalysis?.level === 'NONE'),
      UNSCORED: allPosts.filter(p => !p.intentAnalysis?.level)
    };

    return {
      success: true,
      posts: allPosts,
      totalFound: searchResult.totalFound,
      byPlatform: searchResult.byPlatform,
      byIntentLevel: {
        HIGH: byIntentLevel.HIGH.length,
        MEDIUM: byIntentLevel.MEDIUM.length,
        LOW: byIntentLevel.LOW.length,
        NONE: byIntentLevel.NONE.length,
        UNSCORED: byIntentLevel.UNSCORED.length
      },
      hotLeads: byIntentLevel.HIGH,
      aiScoring: {
        enabled: intentScoringService.isEnabled(),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        scored: scoredPosts.filter(p => p.intentAnalysis?.score !== null).length,
        skipped: postsToSkip.length,
        minRelevanceThreshold: minRelevanceScore
      },
      errors: searchResult.errors
    };
  }

  /**
   * Search a single platform
   */
  async searchPlatform(criteria, platform) {
    const adapter = getAdapter(platform);
    
    if (!adapter) {
      return {
        success: false,
        platform,
        posts: [],
        error: `Unknown platform: ${platform}`
      };
    }

    return adapter.search(criteria);
  }

  /**
   * Get available platforms
   */
  getPlatforms() {
    return getPlatformInfo();
  }

  /**
   * Check if AI scoring is available
   */
  isAIEnabled() {
    return intentScoringService.isEnabled();
  }
}

module.exports = { SearchService };