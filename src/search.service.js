const { getAdapter, getPlatformNames, getPlatformInfo } = require('./adapters');

/**
 * Search Service
 * 
 * Orchestrates searches across multiple platforms.
 * Handles parallel execution and result aggregation.
 */
class SearchService {
  
  async search(criteria, platforms = null) {
    const targetPlatforms = platforms || getPlatformNames();
    
    console.log(`\n🔍 Starting search across: ${targetPlatforms.join(', ')}`);
    console.log(`   Keywords: ${criteria.keywords?.join(', ')}`);
    
    const results = [];
    const errors = [];

    const searchPromises = targetPlatforms.map(async (platform) => {
      const adapter = getAdapter(platform);
      
      if (!adapter) {
        errors.push({ platform, error: `Unknown platform: ${platform}` });
        return null;
      }

      try {
        return await adapter.search(criteria);
      } catch (error) {
        errors.push({ platform, error: error.message });
        return null;
      }
    });

    const searchResults = await Promise.all(searchPromises);
    
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

  async searchRanked(criteria, platforms = null) {
    const result = await this.search(criteria, platforms);
    
    const allPosts = [];
    const byPlatform = {};
    
    for (const platformResult of result.results) {
      allPosts.push(...platformResult.posts);
      byPlatform[platformResult.platform] = platformResult.posts.length;
    }

    allPosts.sort((a, b) => (b.signals?.relevanceScore || 0) - (a.signals?.relevanceScore || 0));

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

  async searchPlatform(criteria, platform) {
    const adapter = getAdapter(platform);
    
    if (!adapter) {
      return { success: false, platform, posts: [], error: `Unknown platform: ${platform}` };
    }

    return adapter.search(criteria);
  }

  getPlatforms() {
    return getPlatformInfo();
  }
}

module.exports = { SearchService };
