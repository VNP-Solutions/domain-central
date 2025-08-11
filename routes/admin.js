const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Domain = require('../models/Domain');
const EmailRequest = require('../models/EmailRequest');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        // Get user statistics
        const userStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    adminUsers: { $sum: { $cond: ['$isAdmin', 1, 0] } },
                    regularUsers: { $sum: { $cond: ['$isAdmin', 0, 1] } }
                }
            }
        ]);

        // Get domain statistics
        const domainStats = await Domain.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get email request statistics
        const emailStats = await EmailRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Format domain stats
        const domainSummary = {
            total: 0,
            active: 0,
            expired: 0,
            pending: 0,
            cancelled: 0
        };

        domainStats.forEach(stat => {
            domainSummary[stat._id] = stat.count;
            domainSummary.total += stat.count;
        });

        // Format email stats
        const emailSummary = {
            total: 0,
            pending: 0,
            created: 0,
            rejected: 0
        };

        emailStats.forEach(stat => {
            emailSummary[stat._id] = stat.count;
            emailSummary.total += stat.count;
        });

        // Get recent activities
        const recentDomains = await Domain.find()
            .populate('purchasedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(5);

        const recentEmailRequests = await EmailRequest.find()
            .populate('domain', 'domainName')
            .populate('requestedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(5);

        const recentUsers = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            stats: {
                users: userStats[0] || { totalUsers: 0, adminUsers: 0, regularUsers: 0 },
                domains: domainSummary,
                emails: emailSummary
            },
            recentActivity: {
                domains: recentDomains,
                emailRequests: recentEmailRequests,
                users: recentUsers
            }
        });

    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (search) {
            query = {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            users,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
                hasNext: skip + users.length < total,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch users',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Create new admin user
router.post('/users', [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('isAdmin')
        .optional()
        .isBoolean()
        .withMessage('isAdmin must be a boolean value')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, email, password, isAdmin = false } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                message: 'User with this email or username already exists' 
            });
        }

        // Create new user
        const user = new User({
            username,
            email,
            password,
            isAdmin
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ 
            message: 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Update user
router.put('/users/:id', [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('isAdmin')
        .optional()
        .isBoolean()
        .withMessage('isAdmin must be a boolean value')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const userId = req.params.id;
        const { username, email, isAdmin } = req.body;

        // Prevent admin from demoting themselves
        if (userId === req.user._id.toString() && isAdmin === false) {
            return res.status(400).json({ 
                message: 'You cannot remove your own admin privileges' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check for duplicate username/email
        if (username || email) {
            const duplicateQuery = {
                _id: { $ne: userId }
            };

            if (username) duplicateQuery.username = username;
            if (email) duplicateQuery.email = email;

            const existingUser = await User.findOne(duplicateQuery);
            if (existingUser) {
                return res.status(400).json({ 
                    message: 'Username or email already exists' 
                });
            }
        }

        // Update user
        if (username) user.username = username;
        if (email) user.email = email;
        if (isAdmin !== undefined) user.isAdmin = isAdmin;

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            message: 'Failed to update user',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ 
                message: 'You cannot delete your own account' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            message: 'Failed to delete user',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Get system settings
router.get('/settings', async (req, res) => {
    try {
        // Return system configuration (you can expand this)
        const settings = {
            namecheapAPI: {
                sandbox: process.env.NAMECHEAP_SANDBOX === 'true',
                configured: !!(process.env.NAMECHEAP_API_USER && process.env.NAMECHEAP_API_KEY)
            },
            database: {
                connected: true // You could check actual connection status
            },
            environment: process.env.NODE_ENV || 'development'
        };

        res.json({
            success: true,
            settings
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch settings',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Get activity logs (simplified version)
router.get('/logs', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // Get recent activities from different collections
        const recentDomains = await Domain.find()
            .populate('purchasedBy', 'username email')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const recentEmailRequests = await EmailRequest.find()
            .populate('domain', 'domainName')
            .populate('requestedBy', 'username email')
            .populate('processedBy', 'username email')
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean();

        const recentUsers = await User.find()
            .select('username email isAdmin createdAt')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Format activities
        const activities = [];

        recentDomains.forEach(domain => {
            activities.push({
                type: 'domain_purchased',
                description: `Domain ${domain.domainName} was purchased`,
                user: domain.purchasedBy,
                timestamp: domain.createdAt,
                data: { domainName: domain.domainName }
            });
        });

        recentEmailRequests.forEach(request => {
            activities.push({
                type: 'email_requested',
                description: `Email ${request.fullEmailAddress} was requested`,
                user: request.requestedBy,
                timestamp: request.createdAt,
                data: { 
                    email: request.fullEmailAddress,
                    status: request.status,
                    processedBy: request.processedBy
                }
            });
        });

        recentUsers.forEach(user => {
            activities.push({
                type: 'user_created',
                description: `User ${user.username} was created`,
                user: { username: 'System', email: 'system@domain.com' },
                timestamp: user.createdAt,
                data: { 
                    username: user.username,
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            });
        });

        // Sort all activities by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply pagination
        const paginatedActivities = activities.slice(skip, skip + parseInt(limit));

        res.json({
            success: true,
            activities: paginatedActivities,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(activities.length / limit),
                totalActivities: activities.length,
                hasNext: skip + paginatedActivities.length < activities.length,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ 
            message: 'Failed to fetch activity logs',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

module.exports = router;
