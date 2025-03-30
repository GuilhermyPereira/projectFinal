import express from 'express';
import { createClient } from '@libsql/client';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const DB_PATH = 'database.sqlite';

// Check if database file exists and is corrupted
const checkAndInitializeDatabase = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      try {
        const db = createClient({
          url: `file:${DB_PATH}`,
        });
        // Test the connection
        db.execute('SELECT 1');
      } catch (error) {
        console.log('Database corrupted, recreating...');
        fs.unlinkSync(DB_PATH);
      }
    }
  } catch (error) {
    console.error('Error checking database:', error);
  }
};

// Initialize express app
const app = express();

// Configure CORS with expanded options
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:7860',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
  preflightContinue: true
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Initialize database
const initializeDatabase = async () => {
  try {
    checkAndInitializeDatabase();
    
    const db = createClient({
      url: `file:${DB_PATH}`,
    });

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
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

let db;

// Initialize database before starting server
const startServer = async () => {
  try {
    db = await initializeDatabase();

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

    // Proxy endpoint for the AI API
    app.post('/api/proxy/ai', async (req, res) => {
      try {
        const response = await fetch(
          "http://127.0.0.1:7860/api/v1/run/a4750c39-3fb9-4115-9316-c7815f68a43c?stream=false",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "sk-0xIidlrOXVmV_vH1NtsDqLWWUQO-GOiz7izCCYGsmN0"
            },
            body: JSON.stringify(req.body)
          }
        );

        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error('Error calling AI API:', error);
        res.status(500).json({ error: 'Failed to process AI request' });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Clean up on exit
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Start the server
startServer();