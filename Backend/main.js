import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import cookieParser from 'cookie-parser';

import { Middleware, verifyToken } from './Middleware/authMiddleware.js';

import AuthRouter from './Routes/Auth.js';
import DatasetRouter from './Routes/Datasets.js';
import DatasetPageRouter from './Routes/DatasetPage.js'

dotenv.config({ path: '../.env' });

const app = express();

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Body parser middileware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));

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

app.get('/account', async (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/AccountPage.html'));
});

app.use(`/datasets`, DatasetPageRouter);

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

export { pool };

const API_BASE_URL = process.env.API_BASE_URL;

app.use(`${API_BASE_URL}/auth`, AuthRouter);
app.use(`${API_BASE_URL}/datasets`, DatasetRouter);

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Database connected successfully at:', res.rows[0].now);
});

app.post(`${API_BASE_URL}/test`, (req, res) => {
    res.json({msg: "hello world"});
})

app.get(`${API_BASE_URL}/Verified`, Middleware, (req, res) => {
    res.json({ msg: `Welcome, ${req.user.username}! verified jwt token for user ID: ${req.user.id}` });
});

const port = process.env.SERVER_PORT;
app.listen(port, () => console.log(`server running on port: ${port}`));