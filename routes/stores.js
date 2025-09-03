const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all stores with basic functionality (public route - no auth required)
router.get('/', async (req, res) => {
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
      whereClause += ` AND (s.name ILIKE $${paramCount} OR s.address ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'address', 'created_at'];
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

    // Get stores with ratings info
    const storesQuery = `
      SELECT 
        s.id, 
        s.name, 
        s.address, 
        s.created_at,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      ${whereClause}
      GROUP BY s.id, s.name, s.address, s.created_at
      ORDER BY s.${sortBy} ${sortOrder.toUpperCase()}
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

// Get public store details (no authentication required)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get store details with average rating
    const storeResult = await pool.query(`
      SELECT s.id, s.name, s.address, s.created_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as total_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.address, s.created_at
    `, [id]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const store = storeResult.rows[0];

    res.json({ store });

  } catch (error) {
    console.error('Store details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get store ratings (no authentication required)
router.get('/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;

    // Get store ratings with user names (if any exist)
    const ratingsResult = await pool.query(`
      SELECT r.rating, r.comment, r.created_at, u.name as user_name
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
    `, [id]);

    res.json({ ratings: ratingsResult.rows || [] });

  } catch (error) {
    console.error('Store ratings error:', error);
    // Return empty ratings array instead of error
    res.json({ ratings: [] });
  }
});

// Get store details with user's rating (if authenticated)
router.get('/:id/authenticated', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get store details with average rating
    const storeResult = await pool.query(`
      SELECT s.id, s.name, s.address, s.created_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as total_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.id = $1
      GROUP BY s.id, s.name, s.address, s.created_at
    `, [id]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const store = storeResult.rows[0];

    // Get user's rating for this store
    const userRatingResult = await pool.query(`
      SELECT rating FROM ratings WHERE user_id = $1 AND store_id = $2
    `, [userId, id]);

    store.userRating = userRatingResult.rows[0]?.rating || null;

    res.json({ store });

  } catch (error) {
    console.error('Store details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Store owner dashboard - get store details and comprehensive rating insights
router.get('/owner/dashboard', authenticateToken, requireRole(['store_owner']), async (req, res) => {
  try {
    const userId = req.user.id;

    // Get store details with comprehensive stats
    const storeResult = await pool.query(`
      SELECT s.id, s.name, s.address, s.email, s.created_at,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as total_ratings,
             COUNT(DISTINCT r.user_id) as unique_customers
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.owner_id = $1
      GROUP BY s.id, s.name, s.address, s.email, s.created_at
    `, [userId]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'No store found for this user' });
    }

    const store = storeResult.rows[0];

    // Get comprehensive store statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_ratings,
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(DISTINCT user_id) as unique_customers,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_ratings,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_ratings,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM ratings
      WHERE store_id = $1
    `, [store.id]);

    const stats = statsResult.rows[0];

    // Get rating trends over time (last 30 days)
    const trendsResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        AVG(rating) as avg_rating,
        COUNT(*) as daily_ratings
      FROM ratings
      WHERE store_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [store.id]);

    // Get recent ratings with user details
    const ratingsResult = await pool.query(`
      SELECT r.rating, r.created_at, r.comment, u.name as user_name, u.email as user_email
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1
      ORDER BY r.created_at DESC
      LIMIT 15
    `, [store.id]);

    // Get rating distribution
    const ratingDistributionResult = await pool.query(`
      SELECT rating, COUNT(*) as count
      FROM ratings
      WHERE store_id = $1
      GROUP BY rating
      ORDER BY rating
    `, [store.id]);

    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = 0;
    }
    
    ratingDistributionResult.rows.forEach(row => {
      ratingDistribution[row.rating] = parseInt(row.count);
    });

    // Get customer insights
    const customerInsightsResult = await pool.query(`
      SELECT 
        u.name as customer_name,
        u.email as customer_email,
        COUNT(r.id) as total_ratings,
        AVG(r.rating) as avg_rating,
        MAX(r.created_at) as last_rating_date
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY total_ratings DESC, avg_rating DESC
      LIMIT 10
    `, [store.id]);

    // Get performance metrics
    const performanceMetrics = {
      ratingScore: parseFloat(stats.average_rating).toFixed(1),
      customerSatisfaction: stats.total_ratings > 0 ? 
        Math.round((stats.positive_ratings / stats.total_ratings) * 100) : 0,
      ratingConfidence: stats.total_ratings >= 10 ? 'high' : 
                       stats.total_ratings >= 5 ? 'medium' : 'low',
      growthTrend: trendsResult.rows.length > 1 ? 
        (trendsResult.rows[trendsResult.rows.length - 1].avg_rating - trendsResult.rows[0].avg_rating).toFixed(2) : 0
    };

    res.json({
      store,
      statistics: {
        totalRatings: parseInt(stats.total_ratings),
        averageRating: parseFloat(stats.average_rating),
        uniqueCustomers: parseInt(stats.unique_customers),
        positiveRatings: parseInt(stats.positive_ratings),
        negativeRatings: parseInt(stats.negative_ratings),
        fiveStarRatings: parseInt(stats.five_star_ratings),
        ratingRange: {
          min: parseInt(stats.min_rating) || 0,
          max: parseInt(stats.max_rating) || 0
        }
      },
      trends: trendsResult.rows,
      recentRatings: ratingsResult.rows,
      ratingDistribution,
      customerInsights: customerInsightsResult.rows,
      performanceMetrics
    });

  } catch (error) {
    console.error('Store owner dashboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get store analytics and insights (store owner only)
router.get('/owner/analytics', authenticateToken, requireRole(['store_owner']), async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days

    // Get store details
    const storeResult = await pool.query(`
      SELECT id, name FROM stores WHERE owner_id = $1
    `, [userId]);

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const store = storeResult.rows[0];

    // Get detailed rating analytics
    const ratingAnalytics = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        AVG(rating) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_ratings,
        STDDEV(rating) as rating_variance
      FROM ratings
      WHERE store_id = $1 
        AND created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [store.id]);

    // Get customer behavior insights
    const customerBehavior = await pool.query(`
      SELECT 
        u.id,
        u.name as customer_name,
        COUNT(r.id) as visit_frequency,
        AVG(r.rating) as avg_rating,
        MIN(r.created_at) as first_visit,
        MAX(r.created_at) as last_visit,
        CASE 
          WHEN COUNT(r.id) >= 3 THEN 'loyal'
          WHEN COUNT(r.id) >= 2 THEN 'regular'
          ELSE 'occasional'
        END as customer_type
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1
      GROUP BY u.id, u.name
      ORDER BY visit_frequency DESC, avg_rating DESC
    `, [store.id]);

    // Get rating sentiment analysis
    const sentimentAnalysis = await pool.query(`
      SELECT 
        CASE 
          WHEN rating >= 4 THEN 'positive'
          WHEN rating = 3 THEN 'neutral'
          ELSE 'negative'
        END as sentiment,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ratings WHERE store_id = $1)), 2) as percentage
      FROM ratings
      WHERE store_id = $1
      GROUP BY 
        CASE 
          WHEN rating >= 4 THEN 'positive'
          WHEN rating = 3 THEN 'neutral'
          ELSE 'negative'
        END
      ORDER BY count DESC
    `, [store.id]);

    // Get competitive insights (if multiple stores exist)
    const competitiveInsights = await pool.query(`
      SELECT 
        'overall' as category,
        AVG(r.rating) as avg_rating,
        COUNT(r.id) as total_ratings
      FROM ratings r
      JOIN stores s ON r.store_id = s.id
      UNION ALL
      SELECT 
        'your_store' as category,
        AVG(r.rating) as avg_rating,
        COUNT(r.id) as total_ratings
      FROM ratings r
      WHERE r.store_id = $1
    `, [store.id]);

    res.json({
      store,
      period: parseInt(period),
      ratingAnalytics: ratingAnalytics.rows,
      customerBehavior: customerBehavior.rows,
      sentimentAnalysis: sentimentAnalysis.rows,
      competitiveInsights: competitiveInsights.rows
    });

  } catch (error) {
    console.error('Store analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all ratings for a store (store owner only)
router.get('/:id/ratings', authenticateToken, requireRole(['store_owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify store ownership
    const ownershipResult = await pool.query(`
      SELECT id FROM stores WHERE id = $1 AND owner_id = $2
    `, [id, userId]);

    if (ownershipResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get ratings with user details
    const { 
      sortBy = 'created_at', 
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Validate sort parameters
    const allowedSortFields = ['rating', 'created_at', 'user_name'];
    const allowedSortOrders = ['asc', 'desc'];
    
    if (!allowedSortFields.includes(sortBy)) sortBy = 'created_at';
    if (!allowedSortOrders.includes(sortOrder.toLowerCase())) sortOrder = 'desc';

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM ratings WHERE store_id = $1
    `, [id]);
    const totalRatings = parseInt(countResult.rows[0].count);

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalRatings / limit);

    // Get ratings with pagination
    const ratingsQuery = `
      SELECT r.rating, r.created_at, u.name as user_name, u.email as user_email
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1
      ORDER BY ${sortBy === 'user_name' ? 'u.name' : sortBy} ${sortOrder.toUpperCase()}
      LIMIT $2 OFFSET $3
    `;
    
    const ratingsResult = await pool.query(ratingsQuery, [id, parseInt(limit), offset]);

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
    console.error('Store ratings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
