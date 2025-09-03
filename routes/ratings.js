const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRating } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Submit or update rating for a store
router.post('/:storeId', validateRating, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Verify store exists
    const storeResult = await pool.query('SELECT id FROM stores WHERE id = $1', [storeId]);
    if (storeResult.rows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Check if user already rated this store
    const existingRating = await pool.query(`
      SELECT id, rating, comment FROM ratings WHERE user_id = $1 AND store_id = $2
    `, [userId, storeId]);

    if (existingRating.rows.length > 0) {
      // Update existing rating
      await pool.query(`
        UPDATE ratings 
        SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $3 AND store_id = $4
      `, [rating, comment || null, userId, storeId]);

      // Get updated store stats
      const storeStats = await pool.query(`
        SELECT 
          COALESCE(AVG(rating), 0) as average_rating,
          COUNT(*) as total_ratings
        FROM ratings 
        WHERE store_id = $1
      `, [storeId]);

      res.json({ 
        message: 'Rating updated successfully',
        rating: { storeId, userId, rating, comment },
        storeStats: storeStats.rows[0]
      });
    } else {
      // Create new rating
      await pool.query(`
        INSERT INTO ratings (user_id, store_id, rating, comment)
        VALUES ($1, $2, $3, $4)
      `, [userId, storeId, rating, comment || null]);

      // Get updated store stats
      const storeStats = await pool.query(`
        SELECT 
          COALESCE(AVG(rating), 0) as average_rating,
          COUNT(*) as total_ratings
        FROM ratings 
        WHERE store_id = $1
      `, [storeId]);

      res.status(201).json({ 
        message: 'Rating submitted successfully',
        rating: { storeId, userId, rating, comment },
        storeStats: storeStats.rows[0]
      });
    }

  } catch (error) {
    console.error('Rating submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update existing rating
router.put('/:ratingId', validateRating, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Verify rating exists and belongs to user
    const existingRating = await pool.query(`
      SELECT id, store_id FROM ratings WHERE id = $1 AND user_id = $2
    `, [ratingId, userId]);

    if (existingRating.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found or unauthorized' });
    }

    const storeId = existingRating.rows[0].store_id;

    // Update rating
    await pool.query(`
      UPDATE ratings 
      SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3
    `, [rating, comment || null, ratingId]);

    // Get updated store stats
    const storeStats = await pool.query(`
      SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_ratings
      FROM ratings 
      WHERE store_id = $1
    `, [storeId]);

    res.json({ 
      message: 'Rating updated successfully',
      rating: { id: ratingId, storeId, userId, rating, comment },
      storeStats: storeStats.rows[0]
    });

  } catch (error) {
    console.error('Rating update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete rating
router.delete('/:ratingId', authenticateToken, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user.id;

    // Verify rating exists and belongs to user
    const existingRating = await pool.query(`
      SELECT id, store_id FROM ratings WHERE id = $1 AND user_id = $2
    `, [ratingId, userId]);

    if (existingRating.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found or unauthorized' });
    }

    const storeId = existingRating.rows[0].store_id;

    // Delete rating
    await pool.query('DELETE FROM ratings WHERE id = $1', [ratingId]);

    // Get updated store stats
    const storeStats = await pool.query(`
      SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_ratings
      FROM ratings 
      WHERE store_id = $1
    `, [storeId]);

    res.json({ 
      message: 'Rating deleted successfully',
      storeStats: storeStats.rows[0]
    });

  } catch (error) {
    console.error('Rating deletion error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's rating insights and history
router.get('/user/insights', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's rating statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_ratings,
        AVG(rating) as average_rating,
        COUNT(DISTINCT store_id) as stores_rated,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative_ratings,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating
      FROM ratings
      WHERE user_id = $1
    `, [userId]);

    // Get user's rating trends over time
    const trendsResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        AVG(rating) as avg_rating,
        COUNT(*) as daily_ratings
      FROM ratings
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [userId]);

    // Get user's favorite stores (highest rated)
    const favoriteStores = await pool.query(`
      SELECT 
        s.id, s.name, s.address,
        r.rating, r.created_at
      FROM ratings r
      JOIN stores s ON r.store_id = s.id
      WHERE r.user_id = $1 AND r.rating >= 4
      ORDER BY r.rating DESC, r.created_at DESC
      LIMIT 5
    `, [userId]);

    // Get user's rating distribution
    const ratingDistribution = await pool.query(`
      SELECT rating, COUNT(*) as count
      FROM ratings
      WHERE user_id = $1
      GROUP BY rating
      ORDER BY rating
    `);

    const stats = statsResult.rows[0];
    const insights = {
      totalRatings: parseInt(stats.total_ratings),
      averageRating: parseFloat(stats.average_rating || 0),
      storesRated: parseInt(stats.stores_rated),
      positiveRatings: parseInt(stats.positive_ratings),
      negativeRatings: parseInt(stats.negative_ratings),
      ratingRange: {
        min: parseInt(stats.min_rating) || 0,
        max: parseInt(stats.max_rating) || 0
      },
      ratingStyle: stats.total_ratings > 0 ? 
        (stats.positive_ratings / stats.total_ratings >= 0.7 ? 'generous' : 
         stats.negative_ratings / stats.total_ratings >= 0.3 ? 'critical' : 'balanced') : 'new'
    };

    res.json({
      insights,
      trends: trendsResult.rows,
      favoriteStores: favoriteStores.rows,
      ratingDistribution: ratingDistribution.rows
    });

  } catch (error) {
    console.error('User insights error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get store recommendations for user
router.get('/user/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    // Get user's rating preferences
    const userPreferences = await pool.query(`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as total_ratings
      FROM ratings
      WHERE user_id = $1
    `, [userId]);

    const userAvgRating = userPreferences.rows[0]?.avg_rating || 3.5;

    // Get stores user hasn't rated yet, ordered by similarity to user preferences
    const recommendations = await pool.query(`
      SELECT 
        s.id, s.name, s.address,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_ratings,
        ABS(COALESCE(AVG(r.rating), 0) - $1) as rating_similarity
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.id NOT IN (
        SELECT DISTINCT store_id FROM ratings WHERE user_id = $2
      )
      GROUP BY s.id, s.name, s.address
      ORDER BY rating_similarity ASC, total_ratings DESC
      LIMIT $3
    `, [userAvgRating, userId, parseInt(limit)]);

    // Get trending stores (most rated recently)
    const trendingStores = await pool.query(`
      SELECT 
        s.id, s.name, s.address,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as total_ratings,
        COUNT(CASE WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.id NOT IN (
        SELECT DISTINCT store_id FROM ratings WHERE user_id = $1
      )
      GROUP BY s.id, s.name, s.address
      HAVING COUNT(CASE WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) > 0
      ORDER BY recent_ratings DESC, average_rating DESC
      LIMIT 5
    `, [userId]);

    res.json({
      recommendations: recommendations.rows,
      trendingStores: trendingStores.rows,
      userPreferences: {
        averageRating: parseFloat(userAvgRating),
        totalRatings: parseInt(userPreferences.rows[0]?.total_ratings || 0)
      }
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's ratings
router.get('/user', async (req, res) => {
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

// Get user's rating for a specific store
router.get('/user/:storeId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeId } = req.params;

    const ratingResult = await pool.query(`
      SELECT id, rating, comment, created_at, updated_at
      FROM ratings
      WHERE user_id = $1 AND store_id = $2
    `, [userId, storeId]);

    if (ratingResult.rows.length === 0) {
      return res.json({ rating: null });
    }

    res.json({ rating: ratingResult.rows[0] });

  } catch (error) {
    console.error('User store rating fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get rating statistics for a user
router.get('/user/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total ratings count
    const totalRatingsResult = await pool.query(`
      SELECT COUNT(*) FROM ratings WHERE user_id = $1
    `, [userId]);

    // Get average rating given by user
    const avgRatingResult = await pool.query(`
      SELECT COALESCE(AVG(rating), 0) as average_rating FROM ratings WHERE user_id = $1
    `, [userId]);

    // Get rating distribution
    const ratingDistributionResult = await pool.query(`
      SELECT rating, COUNT(*) as count
      FROM ratings
      WHERE user_id = $1
      GROUP BY rating
      ORDER BY rating
    `, [userId]);

    const ratingDistribution = {};
    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = 0;
    }
    
    ratingDistributionResult.rows.forEach(row => {
      ratingDistribution[row.rating] = parseInt(row.count);
    });

    // Get recent rating activity
    const recentRatingsResult = await pool.query(`
      SELECT r.rating, r.created_at, s.name as store_name
      FROM ratings r
      JOIN stores s ON r.store_id = s.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [userId]);

    res.json({
      totalRatings: parseInt(totalRatingsResult.rows[0].count),
      averageRating: parseFloat(avgRatingResult.rows[0].average_rating),
      ratingDistribution,
      recentRatings: recentRatingsResult.rows
    });

  } catch (error) {
    console.error('User rating stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a rating
router.delete('/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    // Check if rating exists
    const existingRating = await pool.query(`
      SELECT id FROM ratings WHERE user_id = $1 AND store_id = $2
    `, [userId, storeId]);

    if (existingRating.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    // Delete rating
    await pool.query(`
      DELETE FROM ratings WHERE user_id = $1 AND store_id = $2
    `, [userId, storeId]);

    res.json({ message: 'Rating deleted successfully' });

  } catch (error) {
    console.error('Rating deletion error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
