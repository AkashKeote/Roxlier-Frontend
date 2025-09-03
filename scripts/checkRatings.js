const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'store_ratings_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 20
});

const checkRatings = async () => {
  try {
    console.log('🔍 Checking database state...\n');

    // Check users
    const usersResult = await pool.query('SELECT id, name, email, role FROM users ORDER BY id');
    console.log('👥 Users in database:');
    usersResult.rows.forEach(user => {
      console.log(`  ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
    });

    console.log('\n🏪 Stores in database:');
    const storesResult = await pool.query('SELECT id, name, address, owner_id FROM stores ORDER BY id');
    storesResult.rows.forEach(store => {
      console.log(`  ID: ${store.id}, Name: ${store.name}, Address: ${store.address}, Owner ID: ${store.owner_id}`);
    });

    console.log('\n⭐ Ratings in database:');
    const ratingsResult = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.user_id, r.store_id, r.created_at,
             u.name as user_name, s.name as store_name
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      JOIN stores s ON r.store_id = s.id
      ORDER BY r.created_at DESC
    `);
    
    if (ratingsResult.rows.length === 0) {
      console.log('  ❌ No ratings found in database');
    } else {
      ratingsResult.rows.forEach(rating => {
        console.log(`  ID: ${rating.id}, Rating: ${rating.rating}/5, Store: ${rating.store_name}, User: ${rating.user_name}, Comment: ${rating.comment || 'None'}`);
      });
    }

    // Check store ratings aggregation
    console.log('\n📊 Store ratings summary:');
    const storeRatingsResult = await pool.query(`
      SELECT s.id, s.name,
             COALESCE(AVG(r.rating), 0) as average_rating,
             COUNT(r.id) as total_ratings
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      GROUP BY s.id, s.name
      ORDER BY s.id
    `);
    
    storeRatingsResult.rows.forEach(store => {
      console.log(`  ${store.name}: ${parseFloat(store.average_rating).toFixed(1)}/5 (${store.total_ratings} ratings)`);
    });

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
};

checkRatings();
