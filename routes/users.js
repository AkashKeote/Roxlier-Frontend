const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(`
      SELECT id, name, email, address, role, created_at, updated_at
      FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, address } = req.body;

    // Validate name length
    if (name && (name.length < 20 || name.length > 60)) {
      return res.status(400).json({ 
        message: 'Name must be between 20 and 60 characters' 
      });
    }

    // Validate address length
    if (address && address.length > 400) {
      return res.status(400).json({ 
        message: 'Address must not exceed 400 characters' 
      });
    }

    // Build update query dynamically
    let updateFields = [];
    let params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (address) {
      paramCount++;
      updateFields.push(`address = $${paramCount}`);
      params.push(address);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Add updated_at and user ID to params
    paramCount++;
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, address, role, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, params);

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's store (if store owner)
router.get('/store', async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== 'store_owner') {
      return res.status(403).json({ message: 'Access denied. Store owner role required.' });
    }

    const result = await pool.query(`
      SELECT s.id, s.name, s.email, s.address, s.created_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as total_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.owner_id = $1
      GROUP BY s.id, s.name, s.email, s.address, s.created_at
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No store found for this user' });
    }

    res.json({ store: result.rows[0] });

  } catch (error) {
    console.error('Store fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's rating history
router.get('/ratings', async (req, res) => {
  try {
    const userId = req.user.id;
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
      SELECT r.rating, r.created_at, r.updated_at,
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

// Get user statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get basic user info
    const userResult = await pool.query(`
      SELECT name, role, created_at FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get rating statistics
    const ratingStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_ratings,
        COALESCE(AVG(rating), 0) as average_rating,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM ratings 
      WHERE user_id = $1
    `, [userId]);

    const ratingStats = ratingStatsResult.rows[0];

    // Get store statistics (if store owner)
    let storeStats = null;
    if (user.role === 'store_owner') {
      const storeStatsResult = await pool.query(`
        SELECT 
          s.name as store_name,
          COALESCE(AVG(r.rating), 0) as average_rating,
          COUNT(r.id) as total_ratings
        FROM stores s
        LEFT JOIN ratings r ON s.id = r.store_id
        WHERE s.owner_id = $1
        GROUP BY s.id, s.name
      `, [userId]);

      if (storeStatsResult.rows.length > 0) {
        storeStats = storeStatsResult.rows[0];
      }
    }

    // Get recent activity
    const recentActivityResult = await pool.query(`
      SELECT 
        'rating' as type,
        r.created_at,
        r.rating,
        s.name as store_name
      FROM ratings r
      JOIN stores s ON r.store_id = s.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [userId]);

    res.json({
      user: {
        name: user.name,
        role: user.role,
        memberSince: user.created_at
      },
      ratingStats: {
        totalRatings: parseInt(ratingStats.total_ratings),
        averageRating: parseFloat(ratingStats.average_rating),
        minRating: ratingStats.min_rating,
        maxRating: ratingStats.max_rating
      },
      storeStats,
      recentActivity: recentActivityResult.rows
    });

  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
