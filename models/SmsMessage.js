const mongoose = require('mongoose');

const smsMessageSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        unique: true // Gmail message ID to prevent duplicates
    },
    threadId: {
        type: String,
        required: true // Gmail thread ID for grouping
    },
    subject: {
        type: String,
        required: true
    },
    sender: {
        type: String,
        required: true // Parsed phone number from email body
    },
    smsContent: {
        type: String,
        required: true // The actual SMS message content
    },
    receivedDate: {
        type: Date,
        required: true, // Date from the email body
        default: Date.now
    },
    gmailDate: {
        type: Date,
        required: true, // Date from Gmail
        default: Date.now
    },
    receivedDateString: {
        type: String,
        required: false // Fallback string representation of the date
    },
    rawEmailBody: {
        type: String,
        required: true // Full email body for reference
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
smsMessageSchema.index({ receivedDate: -1 });
smsMessageSchema.index({ sender: 1 });
smsMessageSchema.index({ isRead: 1 });

// Update the updatedAt field before saving
smsMessageSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('SmsMessage', smsMessageSchema);
