# Store Rating System - Backend API

A robust Express.js backend API for managing store ratings and user authentication.

## 🚀 Features

- **User Authentication** - JWT-based login/registration with role-based access
- **Store Management** - CRUD operations for stores
- **Rating System** - Store rating and review management
- **Role-Based Access** - System Admin, Store Owner, and Normal User roles
- **PostgreSQL Database** - Robust data storage with proper relationships

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT + bcryptjs
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express validation middleware

## 📋 Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd store-ratings-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.template .env
   # Edit .env with your database credentials
   ```

4. **Database Setup**
   ```bash
   npm run db:init
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🌍 Environment Variables

Create a `.env` file with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=store_ratings
DB_USER=your_username
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CLIENT_URL=http://localhost:3000
```

## 📊 Database Schema

The application includes the following main tables:
- `users` - User accounts and authentication
- `stores` - Store information and details
- `ratings` - Store ratings and reviews

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Stores
- `GET /api/stores` - List all stores
- `GET /api/stores/:id` - Get store details
- `POST /api/stores` - Create new store (Admin only)
- `PUT /api/stores/:id` - Update store (Admin only)
- `DELETE /api/stores/:id` - Delete store (Admin only)

### Ratings
- `GET /api/stores/:id/ratings` - Get store ratings
- `POST /api/ratings/:storeId` - Create rating
- `PUT /api/ratings/:id` - Update rating
- `DELETE /api/ratings/:id` - Delete rating

### Admin (System Admin only)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stores` - List all stores with admin controls

## 🚀 Deployment

### Railway
1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main branch

### Heroku
1. Create Heroku app
2. Add PostgreSQL addon
3. Set environment variables
4. Deploy using Heroku CLI or GitHub integration

### Vercel
1. Import repository to Vercel
2. Set environment variables
3. Deploy as Node.js function

## 📝 API Documentation

### Request Format
All requests should include:
- `Content-Type: application/json` header
- JWT token in `Authorization: Bearer <token>` header (for protected routes)

### Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcryptjs for secure password storage
- **CORS Protection** - Configurable cross-origin resource sharing
- **Rate Limiting** - Protection against brute force attacks
- **Helmet Security** - Security headers and protection
- **Input Validation** - Request data validation and sanitization

## 🧪 Testing

```bash
# Run database initialization
npm run db:init

# Test API endpoints using tools like:
# - Postman
# - Insomnia
# - curl commands
```

## 📞 Support

For issues and questions:
1. Check existing issues in the repository
2. Create a new issue with detailed description
3. Include error logs and environment details

## 📄 License

This project is licensed under the MIT License.
