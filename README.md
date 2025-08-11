# VNP Domain Dashboard

A comprehensive web application for managing domains and email accounts through the Namecheap API. Built with Node.js, MongoDB, and a modern HTML/CSS/JavaScript frontend.

## Features

### Domain Management
- Purchase new domains from Namecheap
- View list of purchased domains
- Sync domains from Namecheap account
- Check domain availability and pricing
- View domain details and email addresses

### Email Request System
- Request new email addresses for domains
- Admin approval workflow for email requests
- Track request status (pending, created, rejected)
- Secure password storage for email accounts

### User Management
- Secure authentication with JWT
- Admin and regular user roles
- User registration and login
- Admin panel for managing users

### Dashboard & Analytics
- Overview statistics for domains and emails
- Recent activity tracking
- Admin dashboard with system metrics
- Activity logs and system status

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with secure cookies
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **API Integration**: Namecheap API
- **Security**: Helmet, Rate limiting, Input validation

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- Namecheap API credentials

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URI="mongodb+srv://itsupport:fender92@vnpparser.muim3c.mongodb.net/domain-dashboard?retryWrites=true&w=majority&appName=VnpParser"

# JWT Secret (change this in production)
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server Configuration
NODE_ENV="development"
PORT=3000

# Namecheap API Configuration
NAMECHEAP_API_USER="your-namecheap-username"
NAMECHEAP_API_KEY="your-namecheap-api-key"
NAMECHEAP_CLIENT_IP="your-whitelisted-ip"
NAMECHEAP_SANDBOX="true"
```

### 3. Namecheap API Setup
1. Log in to your Namecheap account
2. Go to Profile > Tools > Namecheap API access
3. Enable API access and get your API key
4. Whitelist your server's IP address
5. For testing, enable sandbox mode

### 4. Start the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Default Admin Account

A default admin user is automatically created on first startup:
- **Email**: `abrar@rebelforce.tech`
- **Password**: `RebelForce92!`

⚠️ **Important**: Change the default admin password after first login!

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/verify` - Verify JWT token

### Domains
- `GET /api/domains` - Get all domains
- `GET /api/domains/:id` - Get domain by ID
- `POST /api/domains/check-availability` - Check domain availability
- `POST /api/domains/purchase` - Purchase domain
- `POST /api/domains/sync` - Sync domains from Namecheap (Admin)
- `PUT /api/domains/:id` - Update domain (Admin)
- `DELETE /api/domains/:id` - Delete domain (Admin)

### Email Requests
- `GET /api/emails` - Get email requests
- `GET /api/emails/:id` - Get email request by ID
- `POST /api/emails` - Create email request
- `PUT /api/emails/:id/status` - Update request status (Admin)
- `DELETE /api/emails/:id` - Delete email request
- `GET /api/emails/stats/summary` - Get email statistics

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics (Admin)
- `GET /api/admin/users` - Get all users (Admin)
- `POST /api/admin/users` - Create new user (Admin)
- `PUT /api/admin/users/:id` - Update user (Admin)
- `DELETE /api/admin/users/:id` - Delete user (Admin)
- `GET /api/admin/settings` - Get system settings (Admin)
- `GET /api/admin/logs` - Get activity logs (Admin)

## Security Features

- JWT-based authentication with secure HTTP-only cookies
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting to prevent abuse
- CORS protection
- Helmet security headers
- Admin-only route protection

## Database Schema

### User Model
- username, email, password (hashed)
- isAdmin flag for role-based access
- timestamps for creation and last login

### Domain Model
- domainName, status, registration/expiration dates
- nameservers, email addresses array
- purchase information and Namecheap ID

### EmailRequest Model
- domain reference, requested username/email
- password, status (pending/created/rejected)
- requester and processor references
- timestamps and notes

## Development

### Project Structure
```
vnp-domain-2/
├── models/           # Database models
├── routes/           # API route handlers
├── middleware/       # Authentication & validation
├── services/         # External API services
├── utils/           # Utility functions
├── public/          # Frontend assets
├── server.js        # Main server file
└── package.json     # Dependencies
```

### Adding New Features
1. Create/update database models in `models/`
2. Add API routes in `routes/`
3. Update frontend in `public/`
4. Test thoroughly before deployment

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong JWT secret
3. Enable HTTPS
4. Set up proper MongoDB security
5. Configure rate limiting appropriately
6. Set up monitoring and logging
7. Use a process manager like PM2

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MongoDB Atlas connection string
   - Verify network access in Atlas settings
   - Ensure IP is whitelisted

2. **Namecheap API Errors**
   - Verify API credentials are correct
   - Check IP is whitelisted in Namecheap
   - Ensure sandbox mode setting matches environment

3. **Authentication Issues**
   - Check JWT secret is set
   - Verify cookies are enabled in browser
   - Clear browser cache and cookies

### Support

For issues and questions:
1. Check the console logs for error details
2. Verify environment variables are set correctly
3. Test API endpoints with tools like Postman
4. Check MongoDB connection and data

## License

MIT License - feel free to use this project for your own domain management needs.
