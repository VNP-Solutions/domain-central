const express = require('express');
const { body, validationResult } = require('express-validator');
const Domain = require('../models/Domain');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const namecheapAPI = require('../services/namecheapAPI');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all domains
router.get('/', async (req, res) => {
    try {
        const domains = await Domain.find()
            .populate('purchasedBy', 'username email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            domains
        });
    } catch (error) {
        console.error('Get domains error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch domains',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Get domain by ID
router.get('/:id', async (req, res) => {
    try {
        const domain = await Domain.findById(req.params.id)
            .populate('purchasedBy', 'username email');

        if (!domain) {
            return res.status(404).json({ message: 'Domain not found' });
        }

        res.json({
            success: true,
            domain
        });
    } catch (error) {
        console.error('Get domain error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch domain',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Check domain availability
router.post('/check-availability', [
    body('domain')
        .notEmpty()
        .isLength({ min: 3 })
        .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/)
        .withMessage('Please provide a valid domain name')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { domain } = req.body;

        // Check if domain already exists in our database
        const existingDomain = await Domain.findOne({ 
            domainName: domain.toLowerCase() 
        });

        if (existingDomain) {
            return res.json({
                success: true,
                available: false,
                reason: 'Domain already purchased through this system',
                domain
            });
        }

        // Check availability through Namecheap API
        const availabilityResult = await namecheapAPI.checkDomainAvailability(domain);
        
        let pricing = null;
        
        if (availabilityResult.available) {
            // If it's a premium domain, use the premium price
            if (availabilityResult.premiumPrice) {
                pricing = availabilityResult.premiumPrice;
            } else {
                // For regular domains, get pricing via separate API call
                try {
                    pricing = await namecheapAPI.getDomainPricing(domain);
                } catch (pricingError) {
                    console.warn('Could not fetch pricing via API:', pricingError.message);
                    // Set pricing to null so frontend knows pricing is unavailable
                    pricing = null;
                }
            }
        }
        
        res.json({
            success: true,
            available: availabilityResult.available,
            domain,
            pricing
        });

    } catch (error) {
        console.error('Domain availability check error:', error);
        res.status(500).json({ 
            message: 'Failed to check domain availability',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Purchase domain
router.post('/purchase', [
    body('domain')
        .notEmpty()
        .isLength({ min: 3 })
        .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/)
        .withMessage('Please provide a valid domain name'),
    body('years')
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage('Years must be between 1 and 10')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { domain, years = 1 } = req.body;

        // Check if domain already exists in our database
        const existingDomain = await Domain.findOne({ 
            domainName: domain.toLowerCase() 
        });

        if (existingDomain) {
            return res.status(400).json({
                message: 'Domain already purchased through this system'
            });
        }

        // Check availability first
        const available = await namecheapAPI.checkDomainAvailability(domain);
        if (!available) {
            return res.status(400).json({
                message: 'Domain is not available for purchase'
            });
        }

        // Get pricing
        let pricing = 0;
        try {
            pricing = await namecheapAPI.getDomainPricing(domain);
        } catch (pricingError) {
            console.warn('Could not fetch pricing:', pricingError.message);
        }

        // Purchase domain through Namecheap API
        const purchaseResult = await namecheapAPI.purchaseDomain(domain, years);

        if (!purchaseResult.success) {
            return res.status(400).json({
                message: 'Failed to purchase domain through Namecheap'
            });
        }

        // Save domain to database
        const newDomain = new Domain({
            domainName: domain.toLowerCase(),
            registrationDate: new Date(),
            expirationDate: new Date(Date.now() + (years * 365 * 24 * 60 * 60 * 1000)), // Approximate
            purchasePrice: pricing,
            purchasedBy: req.user._id,
            namecheapId: purchaseResult.domainId,
            status: 'active'
        });

        await newDomain.save();

        // Populate the purchasedBy field for response
        await newDomain.populate('purchasedBy', 'username email');

        res.status(201).json({
            success: true,
            message: 'Domain purchased successfully',
            domain: newDomain
        });

    } catch (error) {
        console.error('Domain purchase error:', error);
        res.status(500).json({ 
            message: 'Failed to purchase domain',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Sync domains from Namecheap (admin only)
router.post('/sync', requireAdmin, async (req, res) => {
    try {
        // Get domains from Namecheap API
        const namecheapDomains = await namecheapAPI.getDomainList();
        
        let syncedCount = 0;
        let errors = [];

        for (const ncDomain of namecheapDomains) {
            try {
                // Check if domain already exists in our database
                const existingDomain = await Domain.findOne({ 
                    domainName: ncDomain.name.toLowerCase() 
                });

                if (!existingDomain) {
                    // Create new domain record
                    const newDomain = new Domain({
                        domainName: ncDomain.name.toLowerCase(),
                        registrationDate: new Date(ncDomain.created),
                        expirationDate: new Date(ncDomain.expires),
                        autoRenew: ncDomain.autoRenew,
                        purchasedBy: req.user._id, // Assign to admin who synced
                        status: 'active'
                    });

                    await newDomain.save();
                    syncedCount++;
                } else {
                    // Update existing domain
                    existingDomain.expirationDate = new Date(ncDomain.expires);
                    existingDomain.autoRenew = ncDomain.autoRenew;
                    await existingDomain.save();
                }
            } catch (domainError) {
                errors.push(`Failed to sync ${ncDomain.name}: ${domainError.message}`);
            }
        }

        res.json({
            success: true,
            message: `Synced ${syncedCount} domains`,
            syncedCount,
            totalDomains: namecheapDomains.length,
            errors
        });

    } catch (error) {
        console.error('Domain sync error:', error);
        res.status(500).json({ 
            message: 'Failed to sync domains',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Update domain (admin only)
router.put('/:id', requireAdmin, [
    body('autoRenew').optional().isBoolean(),
    body('status').optional().isIn(['active', 'expired', 'pending', 'cancelled'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const domain = await Domain.findById(req.params.id);
        if (!domain) {
            return res.status(404).json({ message: 'Domain not found' });
        }

        // Update allowed fields
        const allowedUpdates = ['autoRenew', 'status', 'nameservers'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                domain[field] = req.body[field];
            }
        });

        await domain.save();
        await domain.populate('purchasedBy', 'username email');

        res.json({
            success: true,
            message: 'Domain updated successfully',
            domain
        });

    } catch (error) {
        console.error('Domain update error:', error);
        res.status(500).json({ 
            message: 'Failed to update domain',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Delete domain (users can delete their own domains, admins can delete any)
router.delete('/:id', async (req, res) => {
    try {
        const domain = await Domain.findById(req.params.id);
        if (!domain) {
            return res.status(404).json({ message: 'Domain not found' });
        }

        // Check if user can delete this domain
        const canDelete = req.user.isAdmin || domain.purchasedBy.toString() === req.user._id.toString();
        
        if (!canDelete) {
            return res.status(403).json({ 
                message: 'You can only delete domains you purchased' 
            });
        }

        // Also delete any associated email requests
        const EmailRequest = require('../models/EmailRequest');
        await EmailRequest.deleteMany({ domain: req.params.id });

        await Domain.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Domain deleted successfully from database'
        });

    } catch (error) {
        console.error('Domain delete error:', error);
        res.status(500).json({ 
            message: 'Failed to delete domain',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

module.exports = router;
