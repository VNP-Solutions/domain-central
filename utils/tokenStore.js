// Simple in-memory token store (in production, use database)
class TokenStore {
    constructor() {
        this.tokens = new Map();
    }
    
    // Store tokens for a user (using userId as key)
    setTokens(userId, tokens) {
        this.tokens.set(userId, tokens);
        console.log(`Tokens stored for user: ${userId}`);
    }
    
    // Get tokens for a user
    getTokens(userId) {
        return this.tokens.get(userId);
    }
    
    // Remove tokens for a user
    removeTokens(userId) {
        this.tokens.delete(userId);
        console.log(`Tokens removed for user: ${userId}`);
    }
    
    // For now, we'll use a default user since we don't have user-specific OAuth
    setDefaultTokens(tokens) {
        this.setTokens('default', tokens);
    }
    
    getDefaultTokens() {
        return this.getTokens('default');
    }
    
    removeDefaultTokens() {
        this.removeTokens('default');
    }
}

module.exports = new TokenStore();
