import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DatasetPageRouter = express.Router();

DatasetPageRouter.get('/:datasetId', async (req, res) => {
    res.sendFile(path.join(__dirname, '../../Frontend/CSVpage.html'));
});

export default DatasetPageRouter;