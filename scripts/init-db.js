const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database...');
    
    // Create tables directly
    await createTables();
    console.log('✅ Database schema created successfully');
    
    // Create default admin user with proper password hash
    const adminPassword = 'Admin@123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
    
    await pool.query(`
      INSERT INTO users (name, email, password_hash, address, role) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['System Administrator', 'admin@system.com', passwordHash, 'System Address - 123 Admin Street, Admin City, AC 12345', 'system_admin']);
    
    console.log('✅ Default admin user created');
    console.log('📧 Admin Email: admin@system.com');
    console.log('🔑 Admin Password: Admin@123');
    
    // Insert some sample data for testing
    await insertSampleData();
    
    console.log('✅ Database initialization completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function createTables() {
  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(60) NOT NULL CHECK (LENGTH(name) >= 20),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      address VARCHAR(400) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('system_admin', 'normal_user', 'store_owner')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Stores table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      address VARCHAR(400) NOT NULL,
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ratings table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, store_id)
    )
  `);

  // Create indexes
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_stores_address ON stores(address)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ratings_store_id ON ratings(store_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating)');
}

async function insertSampleData() {
  try {
    // Insert sample normal users
    const userPassword = await bcrypt.hash('User@123', 10);
    await pool.query(`
      INSERT INTO users (name, email, password_hash, address, role) VALUES 
      ('John Doe - Normal User Example', 'user@example.com', $1, '123 Main Street, Example City, EC 12345', 'normal_user'),
      ('Jane Smith - Another Normal User', 'jane@example.com', $1, '456 Oak Avenue, Sample Town, ST 67890', 'normal_user')
      ON CONFLICT (email) DO NOTHING
    `, [userPassword]);
    
    // Insert sample store owners
    const storeOwnerPassword = await bcrypt.hash('Store@123', 10);
    await pool.query(`
      INSERT INTO users (name, email, password_hash, address, role) VALUES 
      ('Mike Johnson - Store Owner Example', 'store@example.com', $1, '789 Business Blvd, Commerce City, CC 11111', 'store_owner'),
      ('Sarah Wilson - Another Store Owner', 'sarah@example.com', $1, '321 Retail Road, Market Town, MT 22222', 'store_owner')
      ON CONFLICT (email) DO NOTHING
    `, [storeOwnerPassword]);
    
    // Insert sample stores
    await pool.query(`
      INSERT INTO stores (name, email, address, owner_id) VALUES 
      ('Local Grocery Store', 'grocery@store.com', '100 Main Street, City Center, CC 33333', 
       (SELECT id FROM users WHERE email = 'store@example.com')),
      ('City Market', 'market@city.com', '200 Market Way, Downtown, DT 44444', 
       (SELECT id FROM users WHERE email = 'sarah@example.com'))
      ON CONFLICT (email) DO NOTHING
    `);
    
    // Insert sample ratings
    await pool.query(`
      INSERT INTO ratings (user_id, store_id, rating, comment) VALUES 
      ((SELECT id FROM users WHERE email = 'user@example.com'), 
       (SELECT id FROM stores WHERE email = 'grocery@store.com'), 5, 'Great products and service!'),
      ((SELECT id FROM users WHERE email = 'jane@example.com'), 
       (SELECT id FROM stores WHERE email = 'grocery@store.com'), 4, 'Good selection of items'),
      ((SELECT id FROM users WHERE email = 'user@example.com'), 
       (SELECT id FROM stores WHERE email = 'market@city.com'), 5, 'Excellent quality and service')
      ON CONFLICT (user_id, store_id) DO NOTHING
    `);
    
    console.log('✅ Sample data inserted successfully');
    
  } catch (error) {
    console.error('❌ Sample data insertion failed:', error);
  }
}

// Run initialization
initializeDatabase();
