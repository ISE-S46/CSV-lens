import express from 'express';
import multer from 'multer'; // Express middleware that handles multipart/form-data
import { Middleware } from '../Middleware/authMiddleware.js';

import { CSVuploadEndpoint } from './controllers/post.js';
import { ListAllDatasets, GetSpecificDataset, GetSpecificDatasetRow } from './controllers/get.js';
import { DeleteDatasets } from './controllers/del.js';
import { UpdateSpecificRow, UpdateColumnName } from './controllers/update.js';

const DatasetRouter = express.Router();

DatasetRouter.use(Middleware);

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // set limit to 10 mb
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('text/csv') || file.mimetype.startsWith('application/vnd.ms-excel')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    }
});

DatasetRouter.post('/upload', upload.single('csvFile'), CSVuploadEndpoint);

DatasetRouter.get('/', ListAllDatasets);

DatasetRouter.get('/:datasetId', GetSpecificDataset);

DatasetRouter.get('/:datasetId/rows', GetSpecificDatasetRow);

DatasetRouter.delete('/:datasetId', DeleteDatasets);

DatasetRouter.put('/:datasetId/rows/:rowNumber', UpdateSpecificRow);

DatasetRouter.patch('/:datasetId/columns/:oldColumnName', UpdateColumnName);

export default DatasetRouter;