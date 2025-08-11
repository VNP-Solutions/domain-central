const User = require('../models/User');

const createDefaultAdmin = async () => {
    try {
        // Check if admin user already exists
        const existingAdmin = await User.findOne({ email: 'abrar@rebelforce.tech' });
        
        if (existingAdmin) {
            console.log('Default admin user already exists');
            return;
        }

        // Create default admin user
        const adminUser = new User({
            username: 'admin',
            email: 'abrar@rebelforce.tech',
            password: 'RebelForce92!',
            isAdmin: true
        });

        await adminUser.save();
        console.log('Default admin user created successfully');
        console.log('Email: abrar@rebelforce.tech');
        console.log('Password: RebelForce92!');
        
    } catch (error) {
        console.error('Error creating default admin user:', error);
    }
};

module.exports = { createDefaultAdmin };
