const { RedditAdapter } = require('./reddit.adapter');
const { HackerNewsAdapter } = require('./hackernews.adapter');

/**
 * Platform Registry
 * 
 * TO ADD A NEW PLATFORM:
 * 1. Create your adapter file (e.g., stackoverflow.adapter.js)
 * 2. Import it here
 * 3. Add to the adapters object below
 * 
 * That's it! The API will automatically include the new platform.
 */

const adapters = {
  reddit: new RedditAdapter(),
  hackernews: new HackerNewsAdapter(),
  
  // Future platforms - uncomment when implemented:
  // stackoverflow: new StackOverflowAdapter(),
  // github: new GitHubAdapter(),
  // devto: new DevToAdapter(),
  // producthunt: new ProductHuntAdapter(),
};

function getAdapter(platform) {
  return adapters[platform];
}

function getAllAdapters() {
  return Object.values(adapters);
}

function getPlatformNames() {
  return Object.keys(adapters);
}

function getPlatformInfo() {
  return Object.entries(adapters).map(([name, adapter]) => ({
    platform: name,
    displayName: adapter.displayName,
    available: true
  }));
}

module.exports = {
  adapters,
  getAdapter,
  getAllAdapters,
  getPlatformNames,
  getPlatformInfo
};
