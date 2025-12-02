const axios = require('axios');

/**
 * Intent Scoring Service
 * 
 * Uses GPT-4o-mini to analyze posts and score buying intent.
 * Extracts pain points, buying signals, and recommends actions.
 */
class IntentScoringService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.enabled = !!process.env.OPENAI_API_KEY;
  }

  /**
   * Check if AI scoring is available
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Score a single post for buying intent
   */
  async scorePost(post, productContext = {}) {
    if (!this.enabled) {
      return this.getDisabledResult();
    }

    try {
      const prompt = this.buildPrompt(post, productContext);
      
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.data.choices[0].message.content);
      return this.normalizeResult(result);

    } catch (error) {
      console.error(`AI scoring error: ${error.message}`);
      return this.getErrorResult(error.message);
    }
  }

  /**
   * Score multiple posts in batch (more efficient)
   */
  async scoreBatch(posts, productContext = {}, options = {}) {
    if (!this.enabled) {
      return posts.map(post => ({
        ...post,
        intentAnalysis: this.getDisabledResult()
      }));
    }

    const concurrency = options.concurrency || 3;
    const results = [];
    
    // Process in batches to respect rate limits
    for (let i = 0; i < posts.length; i += concurrency) {
      const batch = posts.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (post) => {
        const intentAnalysis = await this.scorePost(post, productContext);
        return {
          ...post,
          intentAnalysis
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limits
      if (i + concurrency < posts.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return results;
  }

  /**
   * Get the system prompt for intent analysis
   */
  getSystemPrompt() {
    return `You are an expert sales intelligence analyst. Your job is to analyze social media posts and determine the likelihood that the author is actively looking to purchase a software product or service.

You must respond with a JSON object containing:
{
  "score": <number 0-100>,
  "level": "<HIGH|MEDIUM|LOW|NONE>",
  "confidence": <number 0.0-1.0>,
  "buyingSignals": ["<signal1>", "<signal2>"],
  "painPoints": ["<pain1>", "<pain2>"],
  "urgency": "<IMMEDIATE|SHORT_TERM|EXPLORING|NONE>",
  "recommendedAction": "<CONTACT_NOW|NURTURE|MONITOR|SKIP>",
  "summary": "<one sentence summary of the opportunity>"
}

Scoring guidelines:
- 80-100 (HIGH): Actively searching, mentions budget/timeline, comparing options
- 50-79 (MEDIUM): Expressing frustration, asking for recommendations, researching
- 20-49 (LOW): General discussion, mild interest, future consideration
- 0-19 (NONE): No buying intent, just sharing info, already solved

Key signals to look for:
- Direct asks: "looking for", "need a", "recommend", "best tool for"
- Comparison shopping: "alternative to", "vs", "switching from"
- Pain indicators: "frustrated", "tired of", "too expensive", "doesn't work"
- Timeline hints: "ASAP", "this quarter", "before launch", "urgently"
- Budget mentions: "budget", "pricing", "cost", "affordable"`;
  }

  /**
   * Build the analysis prompt for a specific post
   */
  buildPrompt(post, productContext) {
    let prompt = `Analyze this social media post for buying intent:

PLATFORM: ${post.platform}
${post.subreddit ? `SUBREDDIT: r/${post.subreddit}` : ''}
${post.storyType ? `TYPE: ${post.storyType}` : ''}

TITLE: ${post.title}

CONTENT:
${post.body || '(no body text)'}

ENGAGEMENT: ${post.metrics?.score || 0} upvotes, ${post.metrics?.comments || 0} comments
`;

    // Add product context if provided
    if (productContext.productName || productContext.productType) {
      prompt += `
CONTEXT - We are looking for leads for:
- Product: ${productContext.productName || 'Not specified'}
- Type: ${productContext.productType || 'Not specified'}
- Solves: ${productContext.problemsSolved?.join(', ') || 'Not specified'}
- Competitors: ${productContext.competitors?.join(', ') || 'Not specified'}
`;
    }

    // Add detected signals from keyword matching
    if (post.signals) {
      prompt += `
PRE-DETECTED SIGNALS:
- Matched keywords: ${post.signals.matchedKeywords?.join(', ') || 'none'}
- Intent keywords: ${post.signals.matchedIntentKeywords?.join(', ') || 'none'}
- Pain keywords: ${post.signals.matchedPainKeywords?.join(', ') || 'none'}
- Competitors mentioned: ${post.signals.matchedCompetitors?.join(', ') || 'none'}
- Keyword relevance score: ${post.signals.relevanceScore || 0}/100
`;
    }

    prompt += `
Analyze this post and return your assessment as JSON.`;

    return prompt;
  }

  /**
   * Normalize and validate the AI response
   */
  normalizeResult(result) {
    return {
      score: Math.min(100, Math.max(0, parseInt(result.score) || 0)),
      level: ['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(result.level) 
        ? result.level 
        : this.scoreToLevel(result.score),
      confidence: Math.min(1, Math.max(0, parseFloat(result.confidence) || 0.5)),
      buyingSignals: Array.isArray(result.buyingSignals) ? result.buyingSignals : [],
      painPoints: Array.isArray(result.painPoints) ? result.painPoints : [],
      urgency: ['IMMEDIATE', 'SHORT_TERM', 'EXPLORING', 'NONE'].includes(result.urgency)
        ? result.urgency
        : 'NONE',
      recommendedAction: ['CONTACT_NOW', 'NURTURE', 'MONITOR', 'SKIP'].includes(result.recommendedAction)
        ? result.recommendedAction
        : 'MONITOR',
      summary: result.summary || 'No summary available',
      scoredAt: new Date().toISOString(),
      model: this.model
    };
  }

  /**
   * Convert numeric score to level
   */
  scoreToLevel(score) {
    if (score >= 80) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'NONE';
  }

  /**
   * Result when AI is disabled
   */
  getDisabledResult() {
    return {
      score: null,
      level: null,
      confidence: null,
      buyingSignals: [],
      painPoints: [],
      urgency: null,
      recommendedAction: null,
      summary: 'AI scoring disabled - set OPENAI_API_KEY to enable',
      error: 'AI_DISABLED'
    };
  }

  /**
   * Result when AI errors
   */
  getErrorResult(errorMessage) {
    return {
      score: null,
      level: null,
      confidence: null,
      buyingSignals: [],
      painPoints: [],
      urgency: null,
      recommendedAction: null,
      summary: `AI scoring failed: ${errorMessage}`,
      error: 'AI_ERROR'
    };
  }
}

// Singleton instance
const intentScoringService = new IntentScoringService();

module.exports = { IntentScoringService, intentScoringService };