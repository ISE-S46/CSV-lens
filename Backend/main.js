import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

import { Middleware, verifyToken } from './Middleware/authMiddleware.js';

import AuthRouter from './Routes/Auth.js';
import DatasetRouter from './Routes/Datasets.js';

dotenv.config({ path: '../.env' });

const app = express();

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Body parser middileware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup static folder
app.use(express.static(path.join(__dirname, '../Frontend')));

// Handle route based on authentication status
app.get('/', async (req, res) => {
    const token = req.header('x-auth-token');

    const { isValid } = verifyToken(token);

    if (isValid) {
        res.sendFile(path.join(__dirname, '../Frontend/index.html'));
    } else {
        res.redirect('/login');
    }
});

app.get('/login', async (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/Login.html'));
});

app.get('/register', async (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/Register.html'));
});

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

export { pool };

app.use('/api/auth', AuthRouter);
app.use('/api/datasets', DatasetRouter);

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