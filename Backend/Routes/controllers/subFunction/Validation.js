import jwt from 'jsonwebtoken';

function validateDatasetId(datasetId, res) {
    if (isNaN(datasetId) || datasetId <= 0) {
        return res.status(400).json({ msg: 'Invalid Dataset ID provided.' });
    }
    return false;
}

const generateTokens = (payload) => {
    const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
    );
    const refreshToken = jwt.sign(
        payload,
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '2d' }
    );
    return { accessToken, refreshToken };
};

export { validateDatasetId, generateTokens };