import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../main.js';

dotenv.config({ path: '../.env' });

const AuthRouter = express.Router();

// User Registration
AuthRouter.post('/register', async (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        const userExists = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (userExists.rows.length > 0) {
            return res.status(409).json({ msg: 'User with that username or email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
            [username, email, passwordHash]
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
        res.status(500).json({ msg: 'Server error during registration' });
    }
});

// User Login
AuthRouter.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        const user = await pool.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const userData = user.rows[0];

        // Compare provided password with hashed password
        const isMatch = await bcrypt.compare(password, userData.password_hash);

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: userData.id, username: userData.username },
            process.env.JWT_SECRET,
            { expiresIn: '2h' } // Token expires in 2 hour
        );

        res.status(200).json({
            msg: 'Logged in successfully',
            token,
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email
            }
        });

    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ msg: 'Server error during login' });
    }
});

export default AuthRouter;