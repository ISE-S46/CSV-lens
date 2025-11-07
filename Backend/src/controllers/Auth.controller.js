import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../main.js';
import { generateTokens } from './utils/Validation.js';

dotenv.config({ path: '../../.env' });

const register = async (req, res) => {
    const { username, email, password } = req.body;

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: 'Invalid email format' });
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
            return res.status(400).json({ msg: 'User with that email or username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user
        const newUser = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
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
}

const login = async (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: 'Invalid email format' });
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
        const payload = { id: storedUser.id, username: storedUser.username, email: email };
        const { accessToken, refreshToken } = generateTokens(payload);

        res.cookie('auth_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 2 * 60 * 60 * 1000, // 2 hours in ms
            signed: !!process.env.COOKIE_SECRET,
        });

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: parseInt(process.env.REFRESH_COOKIE_MAX_AGE, 10) || 2 * 24 * 60 * 60 * 1000, // 2 days in ms
            signed: !!process.env.COOKIE_SECRET,
        });

        res.json({
            msg: 'Logged in successfully',
            user: {
                id: storedUser.id,
                username: storedUser.username,
                email: storedUser.email,
            },
        });

    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ msg: 'Server error during login', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
}

const logout = async (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    
    res.json({ msg: 'Logged out successfully' });
}

const verifyToken = (req, res) => {
    const expSeconds = req.user.exp;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeLeftS = expSeconds - nowSeconds;

    res.status(200).json({ 
        msg: `Welcome, ${req.user.username}! verified jwt token for user ID: ${req.user.id}`, 
        user: { 
            id: req.user.id, 
            username: req.user.username,
            email: req.user.email
        },
        expiry: expSeconds,
        expires_in_seconds: timeLeftS,
    });
}

const refreshToken = async (req, res) => {
    const refreshToken = req.signedCookies?.refresh_token || req.cookies?.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ msg: 'No refresh token provided.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        const userResult = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ msg: 'User not found for refresh token.' });
        }
        const user = userResult.rows[0];

        const payload = { id: user.id, username: user.username, email: user.email };
        const { accessToken, refreshToken: newGeneratedRefreshToken } = generateTokens(payload);

        // Set NEW Access Token as HTTP-only cookie
        res.cookie('auth_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 15 * 60 * 1000,
            signed: !!process.env.COOKIE_SECRET,
        });

        // Set NEW Refresh Token as HTTP-only cookie (rotate refresh token)
        res.cookie('refresh_token', newGeneratedRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: parseInt(process.env.REFRESH_COOKIE_MAX_AGE, 10) || 2 * 24 * 60 * 60 * 1000,
            signed: !!process.env.COOKIE_SECRET,
        });

        res.status(200).json({
            msg: 'Tokens refreshed successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
            expiry: decoded.exp
        });

    } catch (err) {
        console.error('Error refreshing token:', err.name, ' - ', err.message);
        if (err.name === 'TokenExpiredError') {
            console.log('Debug: Refresh token has expired.');
        } else if (err.name === 'JsonWebTokenError') {
            console.log('Debug: Refresh token is malformed or invalid signature.');
        }
        // If refresh token is invalid/expired, clear both cookies
        res.clearCookie('auth_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        res.clearCookie('refresh_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        res.status(401).json({ msg: 'Invalid or expired refresh token. Please log in again.' });
    }
}

export { register, login, logout, verifyToken, refreshToken };