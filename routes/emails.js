const express = require('express');
const { body, validationResult } = require('express-validator');
const EmailRequest = require('../models/EmailRequest');
const Domain = require('../models/Domain');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all email requests
router.get('/', async (req, res) => {
    try {
        const { status, domain } = req.query;
        let query = {};

        // Filter by status if provided
        if (status) {
            query.status = status;
        }

        // Filter by domain if provided
        if (domain) {
            query.domainName = domain;
        }

        // Non-admin users can only see their own requests
        if (!req.user.isAdmin) {
            query.requestedBy = req.user._id;
        }

        const emailRequests = await EmailRequest.find(query)
            .populate('domain', 'domainName')
            .populate('requestedBy', 'username email')
            .populate('processedBy', 'username email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            emailRequests
        });
    } catch (error) {
        console.error('Get email requests error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch email requests',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Get email request by ID
router.get('/:id', async (req, res) => {
    try {
        const emailRequest = await EmailRequest.findById(req.params.id)
            .populate('domain', 'domainName')
            .populate('requestedBy', 'username email')
            .populate('processedBy', 'username email');

        if (!emailRequest) {
            return res.status(404).json({ message: 'Email request not found' });
        }

        // Non-admin users can only see their own requests
        if (!req.user.isAdmin && emailRequest.requestedBy._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({
            success: true,
            emailRequest
        });
    } catch (error) {
        console.error('Get email request error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch email request',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Create new email request
router.post('/', async (req, res) => {
    try {
        const { domainId, username, password, notes } = req.body;
        
        // Basic validation
        if (!domainId || !username || !password) {
            return res.status(400).json({ 
                message: 'Domain ID, username, and password are required'
            });
        }

        // Check if domain exists
        const domain = await Domain.findById(domainId);
        if (!domain) {
            return res.status(404).json({ message: 'Domain not found' });
        }

        // Create full email address
        const fullEmailAddress = `${username.toLowerCase()}@${domain.domainName}`;

        // Check if email request already exists for this domain and username
        const existingRequest = await EmailRequest.findOne({
            domain: domainId,
            requestedUsername: username.toLowerCase()
        });

        if (existingRequest) {
            return res.status(400).json({ 
                message: 'Email request already exists for this username on this domain' 
            });
        }

        // Check if email already exists on the domain
        const emailExists = domain.emails.some(email => 
            email.username.toLowerCase() === username.toLowerCase()
        );

        if (emailExists) {
            return res.status(400).json({ 
                message: 'Email already exists on this domain' 
            });
        }

        // Create new email request
        const emailRequest = new EmailRequest({
            domain: domainId,
            domainName: domain.domainName,
            requestedUsername: username.toLowerCase(),
            fullEmailAddress,
            password,
            requestedBy: req.user._id,
            notes: notes || ''
        });

        await emailRequest.save();

        // Populate fields for response
        await emailRequest.populate([
            { path: 'domain', select: 'domainName' },
            { path: 'requestedBy', select: 'username email' }
        ]);

        res.status(201).json({
            success: true,
            message: 'Email request created successfully',
            emailRequest
        });

    } catch (error) {
        console.error('Create email request error:', error);
        res.status(500).json({ 
            message: 'Failed to create email request',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Update email request status (admin only)
router.put('/:id/status', requireAdmin, [
    body('status')
        .isIn(['pending', 'created', 'rejected'])
        .withMessage('Status must be pending, created, or rejected'),
    body('notes')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Notes must be less than 500 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { status, notes, password, smtpSettings, imapSettings } = req.body;
        
        console.log('Received update request:', {
            status,
            notes,
            password,
            smtpSettings,
            imapSettings
        });

        const emailRequest = await EmailRequest.findById(req.params.id);
        if (!emailRequest) {
            return res.status(404).json({ message: 'Email request not found' });
        }

        // Update status
        emailRequest.status = status;
        emailRequest.processedBy = req.user._id;
        emailRequest.processedAt = new Date();
        
        if (notes) {
            emailRequest.notes = notes;
        }
        
        // Update main password if provided
        if (password) {
            emailRequest.password = password;
        }

        // Update SMTP/IMAP settings if provided (usually when approving)
        if (smtpSettings) {
            // If we have existing settings, merge them with the new ones
            if (emailRequest.smtpSettings) {
                emailRequest.smtpSettings = { ...emailRequest.smtpSettings, ...smtpSettings };
            } else {
                emailRequest.smtpSettings = smtpSettings;
            }
        }
        
        if (imapSettings) {
            // If we have existing settings, merge them with the new ones
            if (emailRequest.imapSettings) {
                emailRequest.imapSettings = { ...emailRequest.imapSettings, ...imapSettings };
            } else {
                emailRequest.imapSettings = imapSettings;
            }
        }

        await emailRequest.save();
        
        console.log('Saved email request with settings:', {
            smtpSettings: emailRequest.smtpSettings,
            imapSettings: emailRequest.imapSettings
        });

        // If status is 'created', add email to domain
        if (status === 'created') {
            const domain = await Domain.findById(emailRequest.domain);
            if (domain) {
                domain.emails.push({
                    username: emailRequest.requestedUsername,
                    fullEmail: emailRequest.fullEmailAddress,
                    createdAt: new Date()
                });
                await domain.save();
            }
        }

        // Populate fields for response
        await emailRequest.populate([
            { path: 'domain', select: 'domainName' },
            { path: 'requestedBy', select: 'username email' },
            { path: 'processedBy', select: 'username email' }
        ]);
        
        console.log('Final populated email request settings:', {
            smtpSettings: emailRequest.smtpSettings,
            imapSettings: emailRequest.imapSettings
        });

        res.json({
            success: true,
            message: 'Email request status updated successfully',
            emailRequest
        });

    } catch (error) {
        console.error('Update email request status error:', error);
        res.status(500).json({ 
            message: 'Failed to update email request status',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Delete email request
router.delete('/:id', async (req, res) => {
    try {
        const emailRequest = await EmailRequest.findById(req.params.id);
        if (!emailRequest) {
            return res.status(404).json({ message: 'Email request not found' });
        }

        // Non-admin users can only delete their own pending requests
        if (!req.user.isAdmin) {
            if (emailRequest.requestedBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }
            if (emailRequest.status !== 'pending') {
                return res.status(400).json({ message: 'Can only delete pending requests' });
            }
        }

        await EmailRequest.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Email request deleted successfully'
        });

    } catch (error) {
        console.error('Delete email request error:', error);
        res.status(500).json({ 
            message: 'Failed to delete email request',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Get email requests statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await EmailRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const summary = {
            total: 0,
            pending: 0,
            created: 0,
            rejected: 0
        };

        stats.forEach(stat => {
            summary[stat._id] = stat.count;
            summary.total += stat.count;
        });

        // Get recent requests
        const recentRequests = await EmailRequest.find()
            .populate('domain', 'domainName')
            .populate('requestedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            stats: summary,
            recentRequests
        });

    } catch (error) {
        console.error('Get email stats error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch email statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

module.exports = router;
