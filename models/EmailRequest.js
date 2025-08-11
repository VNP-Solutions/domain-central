const mongoose = require('mongoose');

const emailRequestSchema = new mongoose.Schema({
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain',
        required: true
    },
    domainName: {
        type: String,
        required: true
    },
    requestedUsername: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    fullEmailAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'created', 'rejected'],
        default: 'pending'
    },
    notes: {
        type: String,
        maxlength: 500
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: {
        type: Date
    },
    smtpSettings: {
        server: { type: String },
        port: { type: Number },
        security: { type: String, enum: ['SSL/TLS', 'STARTTLS', 'None'] },
        username: { type: String },
        password: { type: String }
    },
    imapSettings: {
        server: { type: String },
        port: { type: Number },
        security: { type: String, enum: ['SSL/TLS', 'STARTTLS', 'None'] },
        username: { type: String },
        password: { type: String }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient querying
emailRequestSchema.index({ domain: 1 });
emailRequestSchema.index({ status: 1 });
emailRequestSchema.index({ requestedBy: 1 });
emailRequestSchema.index({ createdAt: -1 });

// Compound index for domain and username uniqueness
emailRequestSchema.index({ domain: 1, requestedUsername: 1 }, { unique: true });

module.exports = mongoose.model('EmailRequest', emailRequestSchema);
