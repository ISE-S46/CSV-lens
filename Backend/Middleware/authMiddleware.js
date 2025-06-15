import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

import { pool } from '../main.js';

const Middleware = (req, res, next) => {
    // Read token from signed cookie (if using cookie-parser with secret)
    const token = req.signedCookies?.auth_token || req.cookies?.auth_token;

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

const verifyToken = (token) => {
    if (!token) {
        return { isValid: false, userId: null };
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return { isValid: true, userId: decoded.id };
    } catch (err) {
        // Token is invalid or expired
        return { isValid: false, userId: null };
    }
};

const checkDatasetOwnership = async (req, res, next) => {
    try {
        const datasetId = req.params.datasetId;
        const userId = req.user.id;

        // Query DB to check ownership
        const result = await pool.query(
            'SELECT user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ msg: 'Dataset not found' });
        }

        if (result.rows[0].user_id !== userId) {
            return res.status(403).json({ msg: 'Access denied' });
        }

        next();
    } catch (err) {
        console.error('Ownership check error:', err);
        res.status(500).json({ msg: 'Server error during authorization' });
    }
};

export { Middleware, verifyToken, checkDatasetOwnership };