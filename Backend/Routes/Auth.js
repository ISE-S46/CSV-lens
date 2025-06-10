import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../main.js';
import { Middleware } from '../Middleware/authMiddleware.js';

dotenv.config({ path: '../.env' });

const AuthRouter = express.Router();

// User Registration
AuthRouter.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    let client;
    try {
        client = await pool.connect();
        // Check if user already exists
        const user = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (user.rows.length > 0) {
            return res.status(400).json({ msg: 'User with that email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user
        const newUser = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, email, registration_date',
            [username, email, hashedPassword]
        );

        res.status(201).json({
            msg: 'User registered successfully',
            user: {
                id: newUser.rows[0].id,
                username: newUser.rows[0].username,
                email: newUser.rows[0].email
            }
        });

    } catch (err) {
        console.error('Error during registration:', err.message);
        res.status(500).json({ msg: 'Server error during registration', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// User Login
AuthRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    let client;
    try {
        client = await pool.connect();
        // Check if user exists
        const user = await pool.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const storedUser = user.rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, storedUser.password_hash);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Create JWT
        const payload = { id: storedUser.id, username: storedUser.username };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '2h' },
            (err, token) => {
                if (err) throw err;
                res.json({ msg: 'Logged in successfully', token });
            }
        );

    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ msg: 'Server error during login', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
});

AuthRouter.get('/verify-token', Middleware, (req, res) => {
    res.status(200).json({ msg: 'Token is valid', user: { id: req.user.id } });
});

export default AuthRouter;