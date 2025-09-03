# Store Rating System

A full-stack web application for rating and reviewing stores, built with modern web technologies.

## 🌐 **Live URLs**

- **Frontend**: [https://roxlier.web.app/](https://roxlier.web.app/)
- **Backend**: [https://roxlier-backend.up.railway.app/](https://roxlier-backend.up.railway.app/)
- **Database**: PostgreSQL on Render

## 🏗️ **Project Structure**

```
store-ratings-system/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React contexts (Auth, etc.)
│   │   ├── pages/         # Page components
│   │   ├── utils/         # Utility functions
│   │   └── index.js       # App entry point
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
├── server/                 # Node.js Backend
│   ├── routes/            # API route handlers
│   ├── middleware/        # Express middleware
│   ├── database/          # Database schema & scripts
│   ├── config/            # Configuration files
│   └── index.js           # Server entry point
└── README.md              # This file
```

## 🛠️ **Tech Stack**

### **Frontend**
- **React.js** - UI framework
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Router** - Navigation
- **React Hot Toast** - Notifications

### **Backend**
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin support

### **Deployment**
- **Firebase Hosting** - Frontend hosting
- **Railway** - Backend hosting
- **Render** - PostgreSQL database

## 🚀 **Local Development Setup**

### **Prerequisites**
- Node.js (v18+)
- PostgreSQL
- npm or yarn

### **Backend Setup**
```bash
cd server
npm install
cp env.example .env
# Update .env with your database credentials
npm run dev
```

### **Frontend Setup**
```bash
cd client
npm install
npm start
```

### **Build Commands**
```bash
# Frontend build
cd client
npm run build

# Backend (no build needed for Node.js)
cd server
npm start
```

## 📊 **Database Schema**

- **Users**: Authentication, roles, profiles
- **Stores**: Store information, ratings, owner details
- **Ratings**: User ratings, comments, timestamps
- **Admin**: User management, store oversight

## 🎨 **UI Inspiration**

UI design inspired by [EcoBazaarX project](https://akashkeote.github.io/EcoBazaarX/) from Infosys internship, featuring:
- Clean, modern interface
- Responsive design
- Intuitive navigation
- Professional color scheme

## 🔧 **Development Notes**

- **Error Resolution**: Most development issues resolved with ChatGPT 5.0 assistance
- **CORS**: Configured for multiple frontend domains
- **Authentication**: JWT-based with role-based access control
- **Responsive**: Mobile-first design approach

## 📝 **Environment Variables**

```env
# Database
DB_HOST=your_host
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_username
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 **License**

MIT License - see LICENSE file for details

---

**Built with ❤️ by Akash Keote**
