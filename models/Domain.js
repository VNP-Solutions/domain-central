const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
    domainName: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    registrar: {
        type: String,
        default: 'namecheap'
    },
    registrationDate: {
        type: Date,
        required: true
    },
    expirationDate: {
        type: Date,
        required: true
    },
    autoRenew: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'pending', 'cancelled'],
        default: 'active'
    },
    nameservers: [{
        type: String
    }],
    emails: [{
        username: String,
        fullEmail: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    purchasePrice: {
        type: Number
    },
    currency: {
        type: String,
        default: 'USD'
    },
    purchasedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    namecheapId: {
        type: String
    }
}, {
    timestamps: true
});

// Index for efficient searching (domainName already has unique index)
domainSchema.index({ status: 1 });
domainSchema.index({ expirationDate: 1 });

module.exports = mongoose.model('Domain', domainSchema);
