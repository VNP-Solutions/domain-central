const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const emailRoutes = require('./routes/emails');
const adminRoutes = require('./routes/admin');
const smsRoutes = require('./routes/sms');
const { createDefaultAdmin } = require('./utils/createAdmin');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "https://www.vnpsolutions.com"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sms', smsRoutes);

// OAuth callback route (needs to be at root level)
app.get('/oauth2callback', async (req, res) => {
    const gmailAPI = require('./services/gmailAPI');
    const tokenStore = require('./utils/tokenStore');
    
    try {
        const { code } = req.query;
        
        if (!code) {
            return res.redirect('/?auth=error&message=no_code');
        }

        // Exchange code for tokens
        const tokens = await gmailAPI.getTokens(code);
        
        // Store tokens in token store
        tokenStore.setDefaultTokens(tokens);
        
        // Set tokens in Gmail API for immediate use
        gmailAPI.setTokens(tokens);
        
        console.log('Gmail OAuth successful, tokens stored');
        
        // Redirect back to the SMS Central page with success message
        res.redirect('/?section=sms-central&auth=success');
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/?section=sms-central&auth=error');
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection
const connectDB = async () => {
    try {
        const DATABASE_URI = process.env.DATABASE_URI || "mongodb+srv://itsupport:fender92@vnpparser.muim3c.mongodb.net/domain-dashboard?retryWrites=true&w=majority&appName=VnpParser";
        
        await mongoose.connect(DATABASE_URI);
        
        console.log('MongoDB connected successfully');
        
        // Create default admin user
        await createDefaultAdmin();
        
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
});

module.exports = app;
