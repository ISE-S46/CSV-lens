import { Router } from 'express';
import { Middleware } from '../Middleware/authMiddleware.js';

import { register, login, logout, verifyToken, refreshToken } from './controllers/Auth.controller.js';

const AuthRouter = Router();

AuthRouter.post('/register', register);

AuthRouter.post('/login', login);

AuthRouter.post('/logout', logout);

AuthRouter.get('/verify-token', Middleware, verifyToken);

AuthRouter.post('/refresh-token', refreshToken);

export default AuthRouter;