const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateUserRegistration, validateStoreCreation } = require('../middleware/validation');

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(requireRole(['system_admin']));

// Get dashboard statistics and analytics
router.get('/dashboard', async (req, res) => {
  try {
    // Get total counts
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const storeCount = await pool.query('SELECT COUNT(*) FROM stores');
    const ratingCount = await pool.query('SELECT COUNT(*) FROM ratings');

    // Get user growth (last 30 days)
    const userGrowth = await pool.query(`
      SELECT COUNT(*) FROM users 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Get store growth (last 30 days)
    const storeGrowth = await pool.query(`
      SELECT COUNT(*) FROM stores 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Get rating distribution
    const ratingDistribution = await pool.query(`
      SELECT rating, COUNT(*) as count 
      FROM ratings 
      GROUP BY rating 
      ORDER BY rating
    `);

    // Get top performing stores
    const topStores = await pool.query(`
      SELECT s.id, s.name, s.address, 
             AVG(r.rating) as avg_rating, 
             COUNT(r.id) as total_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      GROUP BY s.id, s.name, s.address
      HAVING COUNT(r.id) > 0
      ORDER BY avg_rating DESC, total_ratings DESC
      LIMIT 5
    `);

    // Get recent system activity
    const recentActivity = await pool.query(`
      SELECT 
        'user_registered' as type,
        u.name as description,
        u.created_at as timestamp
      FROM users u
      WHERE u.created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT 
        'store_created' as type,
        s.name as description,
        s.created_at as timestamp
      FROM stores s
      WHERE s.created_at >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT 
        'rating_submitted' as type,
        CONCAT('Rating ', r.rating, ' for store ', s.name) as description,
        r.created_at as timestamp
      FROM ratings r
      JOIN stores s ON r.store_id = s.id
      WHERE r.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    // Get system health metrics
    const systemHealth = await pool.query(`
      SELECT 
        CASE 
          WHEN COUNT(DISTINCT u.id) > 100 THEN 'good'
          WHEN COUNT(DISTINCT u.id) > 50 THEN 'warning'
          ELSE 'critical'
        END as user_health,
        CASE 
          WHEN COUNT(DISTINCT s.id) > 20 THEN 'good'
          WHEN COUNT(DISTINCT s.id) > 10 THEN 'warning'
          ELSE 'critical'
        END as store_health,
        CASE 
          WHEN COUNT(DISTINCT r.id) > 200 THEN 'good'
          WHEN COUNT(DISTINCT r.id) > 100 THEN 'warning'
          ELSE 'critical'
        END as rating_health
      FROM users u, stores s, ratings r
    `);

    res.json({
      statistics: {
        totalUsers: parseInt(userCount.rows[0].count),
        totalStores: parseInt(storeCount.rows[0].count),
        totalRatings: parseInt(ratingCount.rows[0].count),
        userGrowth: parseInt(userGrowth.rows[0].count),
        storeGrowth: parseInt(storeGrowth.rows[0].count)
      },
      analytics: {
        ratingDistribution: ratingDistribution.rows,
        topStores: topStores.rows,
        systemHealth: systemHealth.rows[0]
      },
      recentActivity: recentActivity.rows
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new user
router.post('/users', validateUserRegistration, async (req, res) => {
  try {
    const { name, email, password, address, role = 'normal_user' } = req.body;

    // Validate role
    if (!['normal_user', 'store_owner', 'system_admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(`
      INSERT INTO users (name, email, password_hash, address, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, address, role, created_at
    `, [name, email, passwordHash, address, role]);

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get analytics data
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    
    // Get rating trends over time
    const ratingTrends = await pool.query(`
      SELECT 
        DATE(r.created_at) as date,
        AVG(r.rating) as avg_rating,
        COUNT(r.id) as total_ratings
      FROM ratings r
      WHERE r.created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE(r.created_at)
      ORDER BY date
    `);

    // Get user engagement metrics
    const userEngagement = await pool.query(`
      SELECT 
        u.role,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT r.id) as total_ratings,
        AVG(r.rating) as avg_rating
      FROM users u
      LEFT JOIN ratings r ON u.id = r.user_id
      GROUP BY u.role
    `);

    // Get store performance metrics
    const storePerformance = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.address,
        COUNT(r.id) as total_ratings,
        AVG(r.rating) as avg_rating,
        MIN(r.rating) as min_rating,
        MAX(r.rating) as max_rating,
        COUNT(CASE WHEN r.rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN r.rating <= 2 THEN 1 END) as negative_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      GROUP BY s.id, s.name, s.address
      ORDER BY avg_rating DESC NULLS LAST
    `);

    // Get geographic distribution
    const geoDistribution = await pool.query(`
      SELECT 
        SUBSTRING(s.address FROM 1 FOR 50) as location,
        COUNT(s.id) as store_count,
        AVG(r.rating) as avg_rating
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      GROUP BY SUBSTRING(s.address FROM 1 FOR 50)
      HAVING COUNT(s.id) > 1
      ORDER BY store_count DESC
      LIMIT 10
    `);

    res.json({
      ratingTrends: ratingTrends.rows,
      userEngagement: userEngagement.rows,
      storePerformance: storePerformance.rows,
      geoDistribution: geoDistribution.rows
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users with filtering and sorting
router.get('/users', async (req, res) => {
  try {
    const { 
      search, 
      role, 
      sortBy = 'name', 
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR address ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Add role filter
    if (role) {
      paramCount++;
      whereClause += ` AND role = $${paramCount}`;
      params.push(role);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'email', 'address', 'role', 'created_at'];
    const allowedSortOrders = ['asc', 'desc'];
    
    if (!allowedSortFields.includes(sortBy)) sortBy = 'name';
    if (!allowedSortOrders.includes(sortOrder.toLowerCase())) sortOrder = 'asc';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalUsers = parseInt(countResult.rows[0].count);

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalUsers / limit);

    // Get users with pagination
    const usersQuery = `
      SELECT id, name, email, address, role, created_at, updated_at
      FROM users 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(parseInt(limit), offset);
    const usersResult = await pool.query(usersQuery, params);

    res.json({
      users: usersResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT id, name, email, address, role, created_at, updated_at
      FROM users WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    // If user is a store owner, get their store details
    if (user.role === 'store_owner') {
      const storeResult = await pool.query(`
        SELECT s.id, s.name, s.email, s.address, 
               COALESCE(AVG(r.rating), 0) as average_rating,
               COUNT(r.id) as total_ratings
        FROM stores s
        LEFT JOIN ratings r ON s.id = r.store_id
        WHERE s.owner_id = $1
        GROUP BY s.id, s.name, s.email, s.address
      `, [id]);

      user.store = storeResult.rows[0] || null;
    }

    res.json({ user });

  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add new store
router.post('/stores', validateStoreCreation, async (req, res) => {
  try {
    const { name, email, address, ownerId } = req.body;

    // Check if store already exists
    const existingStore = await pool.query('SELECT id FROM stores WHERE email = $1', [email]);
    if (existingStore.rows.length > 0) {
      return res.status(400).json({ message: 'Store with this email already exists' });
    }

    // Verify owner exists and is a store owner
    if (ownerId) {
      const ownerResult = await pool.query('SELECT role FROM users WHERE id = $1', [ownerId]);
      if (ownerResult.rows.length === 0) {
        return res.status(400).json({ message: 'Owner not found' });
      }
      if (ownerResult.rows[0].role !== 'store_owner') {
        return res.status(400).json({ message: 'Owner must have store_owner role' });
      }
    }

    // Create store
    const result = await pool.query(`
      INSERT INTO stores (name, email, address, owner_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, address, owner_id, created_at
    `, [name, email, address, ownerId || null]);

    res.status(201).json({
      message: 'Store created successfully',
      store: result.rows[0]
    });

  } catch (error) {
    console.error('Store creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all stores with filtering and sorting
router.get('/stores', async (req, res) => {
  try {
    const { 
      search, 
      sortBy = 'name', 
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (s.name ILIKE $${paramCount} OR s.email ILIKE $${paramCount} OR s.address ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'email', 'address', 'average_rating', 'total_ratings', 'created_at'];
    const allowedSortOrders = ['asc', 'desc'];
    
    if (!allowedSortFields.includes(sortBy)) sortBy = 'name';
    if (!allowedSortOrders.includes(sortOrder.toLowerCase())) sortOrder = 'asc';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM stores s ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalStores = parseInt(countResult.rows[0].count);

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalStores / limit);

    // Get stores with ratings and pagination
    const storesQuery = `
      SELECT s.id, s.name, s.email, s.address, s.created_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as total_ratings,
             u.name as owner_name
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      LEFT JOIN users u ON s.owner_id = u.id
      ${whereClause}
      GROUP BY s.id, s.name, s.email, s.address, s.created_at, u.name
      ORDER BY ${sortBy === 'average_rating' ? 'average_rating' : sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(parseInt(limit), offset);
    const storesResult = await pool.query(storesQuery, params);

    res.json({
      stores: storesResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalStores,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Stores fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's ratings (admin endpoint)
router.get('/users/:userId/ratings', async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      sortBy = 'created_at', 
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Validate sort parameters
    const allowedSortFields = ['rating', 'created_at', 'store_name'];
    const allowedSortOrders = ['asc', 'desc'];
    
    if (!allowedSortFields.includes(sortBy)) sortBy = 'created_at';
    if (!allowedSortOrders.includes(sortOrder.toLowerCase())) sortOrder = 'desc';

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM ratings WHERE user_id = $1
    `, [userId]);
    const totalRatings = parseInt(countResult.rows[0].count);

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalRatings / limit);

    // Get ratings with store details and pagination
    const ratingsQuery = `
      SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
             s.id as store_id, s.name as store_name, s.address as store_address
      FROM ratings r
      JOIN stores s ON r.store_id = s.id
      WHERE r.user_id = $1
      ORDER BY ${sortBy === 'store_name' ? 's.name' : sortBy} ${sortOrder.toUpperCase()}
      LIMIT $2 OFFSET $3
    `;
    
    const ratingsResult = await pool.query(ratingsQuery, [userId, parseInt(limit), offset]);

    res.json({
      ratings: ratingsResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRatings,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('User ratings fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
