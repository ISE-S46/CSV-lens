import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import cookieParser from 'cookie-parser';

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

const port = process.env.SERVER_PORT;
const API_BASE_URL = process.env.API_BASE_URL;

app.use(`${API_BASE_URL}/auth`, AuthRouter);
app.use(`${API_BASE_URL}/datasets`, DatasetRouter);

// Setup static folder
app.use(express.static(path.join(__dirname, '../Frontend')));

// Handle route based on authentication status
app.get('/', async (req, res) => {
    const token = req.signedCookies?.auth_token || req.cookies?.auth_token;;

    if (!token) {
        res.redirect('/login');
    } 
    
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
    
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

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Database connected successfully at:', res.rows[0].now);
});

export { app, pool };

app.post(`${API_BASE_URL}/test`, (req, res) => {
    res.json({ msg: "hello world" });
})

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => console.log(`server running on port: ${port}`));
}