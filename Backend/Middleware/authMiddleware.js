import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const Middleware = (req, res, next) => {
    const token = req.header('x-auth-token'); 

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

export { Middleware, verifyToken };