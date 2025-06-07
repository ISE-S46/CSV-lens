import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '../.env' });

import AuthRouter from './Routes/Auth.js';
import Middleware from './Middleware/authMiddleware.js';

const app = express();

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Body parser middileware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup static folder
app.use(express.static(path.join(__dirname, '../Frontend')));

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

export { pool };

app.use('/api/auth', AuthRouter);

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Database connected successfully at:', res.rows[0].now);
});

app.post('/api/test', (req, res) => {
    res.json({msg: "hello world"});
})

app.get('/api/Verified', Middleware, (req, res) => {
    res.json({ msg: `Welcome, ${req.user.username}! verified jwt token for user ID: ${req.user.id}` });
});

const port = process.env.SERVER_PORT;
app.listen(port, () => console.log(`server running on port: ${port}`));