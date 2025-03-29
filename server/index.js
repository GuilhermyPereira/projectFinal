import express from 'express';
import { createClient } from '@libsql/client';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const db = createClient({
  url: 'file:database.sqlite',
});

// Configure CORS with specific options
app.use(cors({
  origin: ['http://localhost:5173', 'https://localhost:5173'], // Allow both http and https
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Initialize database table
async function initializeDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget REAL NOT NULL,
        city TEXT NOT NULL,
        investment_type TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

await initializeDatabase();

// Save user data
app.post('/api/user-data', async (req, res) => {
  try {
    const { budget, city, investmentType, targetAudience } = req.body;

    const result = await db.execute({
      sql: 'INSERT INTO user_data (budget, city, investment_type, target_audience) VALUES (?, ?, ?, ?)',
      args: [budget, city, investmentType, targetAudience]
    });
    
    const insertedData = await db.execute({
      sql: 'SELECT * FROM user_data WHERE id = ?',
      args: [result.lastInsertRowid]
    });
    
    res.json(insertedData.rows[0]);
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).json({ error: 'Failed to save user data' });
  }
});

// Get all user data
app.get('/api/user-data', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM user_data ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Clean up on exit
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));