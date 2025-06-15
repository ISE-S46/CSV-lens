import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkDatasetOwnership } from '../Middleware/authMiddleware.js';
import dotenv from 'dotenv';

import { Middleware } from '../Middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DatasetPageRouter = express.Router();

DatasetPageRouter.get('/:datasetId', Middleware, checkDatasetOwnership, async (req, res) => {
        res.sendFile(path.join(__dirname, '../../Frontend/CSVpage.html'));
});

DatasetPageRouter.get('/:datasetId/edit', Middleware, checkDatasetOwnership, async (req, res) => {
    res.sendFile(path.join(__dirname, '../../Frontend/EditCSVpage.html'));
});

export default DatasetPageRouter;