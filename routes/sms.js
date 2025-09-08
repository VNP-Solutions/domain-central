const express = require('express');
const router = express.Router();
const gmailAPI = require('../services/gmailAPI');
const SmsMessage = require('../models/SmsMessage');
const tokenStore = require('../utils/tokenStore');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get authorization URL
router.get('/auth/url', authenticateToken, (req, res) => {
    try {
        const authUrl = gmailAPI.generateAuthUrl();
        res.json({ success: true, authUrl });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ success: false, message: 'Failed to generate authorization URL' });
    }
});

// Check authentication status
router.get('/auth/status', authenticateToken, (req, res) => {
    try {
        const tokens = tokenStore.getDefaultTokens();
        const isAuthenticated = tokens && tokens.access_token;
        
        if (isAuthenticated) {
            // Set tokens for API calls
            gmailAPI.setTokens(tokens);
        }
        
        res.json({ 
            success: true, 
            authenticated: isAuthenticated,
            hasRefreshToken: tokens && tokens.refresh_token
        });
    } catch (error) {
        console.error('Error checking auth status:', error);
        res.status(500).json({ success: false, message: 'Failed to check authentication status' });
    }
});

// Disconnect Gmail
router.post('/auth/disconnect', authenticateToken, (req, res) => {
    try {
        tokenStore.removeDefaultTokens();
        res.json({ success: true, message: 'Gmail disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting Gmail:', error);
        res.status(500).json({ success: false, message: 'Failed to disconnect Gmail' });
    }
});

// Sync messages from Gmail
router.post('/sync', authenticateToken, async (req, res) => {
    try {
        const tokens = tokenStore.getDefaultTokens();
        if (!tokens || !tokens.access_token) {
            return res.status(401).json({ success: false, message: 'Gmail not authenticated' });
        }
        
        // Set tokens for API calls
        gmailAPI.setTokens(tokens);
        
        // Sync messages
        const result = await gmailAPI.syncSmsMessages();
        
        res.json({ 
            success: true, 
            message: `Synced ${result.newMessages} new messages`,
            ...result
        });
        
    } catch (error) {
        console.error('Error syncing messages:', error);
        
        // Check if it's an authentication error
        if (error.message.includes('invalid_grant') || error.message.includes('unauthorized')) {
            // Try to refresh tokens
            try {
                const currentTokens = tokenStore.getDefaultTokens();
                if (currentTokens && currentTokens.refresh_token) {
                    const newTokens = await gmailAPI.refreshTokens();
                    tokenStore.setDefaultTokens({ ...currentTokens, ...newTokens });
                    
                    // Retry sync
                    const result = await gmailAPI.syncSmsMessages();
                    return res.json({ 
                        success: true, 
                        message: `Synced ${result.newMessages} new messages (after token refresh)`,
                        ...result
                    });
                }
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
            }
            
            return res.status(401).json({ 
                success: false, 
                message: 'Gmail authentication expired. Please re-authorize.',
                requiresReauth: true
            });
        }
        
        res.status(500).json({ success: false, message: 'Failed to sync messages' });
    }
});

// Get SMS messages
router.get('/messages', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = await gmailAPI.getSmsMessages(limit, offset);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error fetching SMS messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SMS messages' });
    }
});

// Get single SMS message
router.get('/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const message = await SmsMessage.findOne({ messageId: req.params.messageId });
        
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        
        res.json({ success: true, message });
        
    } catch (error) {
        console.error('Error fetching SMS message:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SMS message' });
    }
});

// Mark message as read
router.put('/messages/:messageId/read', authenticateToken, async (req, res) => {
    try {
        const success = await gmailAPI.markAsRead(req.params.messageId);
        
        if (success) {
            res.json({ success: true, message: 'Message marked as read' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to mark message as read' });
        }
        
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark message as read' });
    }
});

// Get SMS statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const totalMessages = await SmsMessage.countDocuments();
        const unreadMessages = await SmsMessage.countDocuments({ isRead: false });
        const uniqueSenders = await SmsMessage.distinct('sender');
        
        // Get recent activity (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentMessages = await SmsMessage.countDocuments({ 
            receivedDate: { $gte: weekAgo } 
        });
        
        res.json({
            success: true,
            stats: {
                totalMessages,
                unreadMessages,
                uniqueSenders: uniqueSenders.length,
                recentMessages
            }
        });
        
    } catch (error) {
        console.error('Error fetching SMS stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch SMS statistics' });
    }
});

module.exports = router;
