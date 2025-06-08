import express from 'express';
import multer from 'multer'; // Express middleware that handles multipart/form-data
import { pool } from '../main.js';
import Middleware from '../Middleware/authMiddleware.js';
import { parseCsvBuffer, insertCsvDataBatch } from './subFunction/HandleCSV.js';

import { getPaginatedSortedFilteredRows } from './subFunction/dataRetrieval.js';

const DatasetRouter = express.Router();

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // set limit to 20 mb
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('text/csv') || file.mimetype.startsWith('application/vnd.ms-excel')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed!'), false);
        }
    }
});

// CSV Upload Endpoint
DatasetRouter.post('/upload', Middleware, upload.single('csvFile'), async (req, res) => {
    const userId = req.user.id;
    const { csvName, description } = req.body;

    // Initial Validation
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded.' });
    }
    if (!csvName || csvName.trim() === '') {
        return res.status(400).json({ msg: 'Dataset Name (csvName) is required.' });
    }
    if (!req.file.mimetype.startsWith('text/csv') && !req.file.mimetype.startsWith('application/vnd.ms-excel')) {
        // Some CSVs might come with 'application/vnd.ms-excel' mimetype
        return res.status(400).json({ msg: 'Only CSV files are allowed. Detected: ' + req.file.mimetype });
    }

    const originalFilename = req.file.originalname;
    const fileSize = req.file.size;
    const csvBuffer = req.file.buffer; // The CSV file content as a Buffer

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // Parse CSV Data
        const { rows, columnsMetadata, rowCount } = await parseCsvBuffer(csvBuffer);

        if (rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ msg: 'CSV file contains no data rows.' });
        }
        if (columnsMetadata.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ msg: 'CSV file contains no detectable columns.' });
        }

        // Insert into datasets table
        const datasetResult = await client.query(
            'INSERT INTO datasets (user_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING dataset_id',
            [userId, csvName, originalFilename, description || null, fileSize, rowCount, 'completed']
        );
        const datasetId = datasetResult.rows[0].dataset_id;

        // Insert into columns table
        const columnInserts = columnsMetadata.map(col => {
            return client.query(
                'INSERT INTO columns (dataset_id, column_name, column_type, column_order) VALUES ($1, $2, $3, $4)',
                [datasetId, col.column_name, col.column_type, col.column_order]
            );
        });
        await Promise.all(columnInserts); // Execute all column inserts concurrently

        await insertCsvDataBatch(client, datasetId, rows);

        await client.query('COMMIT');

        res.status(201).json({
            msg: 'CSV uploaded and processed successfully',
            rowCount: rowCount,
            columns: columnsMetadata
        });

    } catch (err) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback transaction on error
        }
        console.error('Error during CSV upload process:', err);
        if (err.message.includes('Failed to parse CSV')) { // Check for our custom parsing error message
            res.status(400).json({ msg: 'Error parsing CSV file. Please check its format.', error: err.message });
        } else {
            res.status(500).json({ msg: 'Server error during CSV processing.', error: err.message });
        }
    } finally {
        if (client) {
            client.release(); // Always release the client back to the pool
        }
    }
});

// List all datasets
DatasetRouter.get('/', Middleware, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'SELECT dataset_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status FROM datasets WHERE user_id = $1 ORDER BY upload_date DESC',
            [userId]
        );

        res.status(200).json({
            msg: 'Datasets retrieved successfully',
            datasets: result.rows
        });

    } catch (err) {
        console.error('Error fetching datasets:', err.message);
        res.status(500).json({ msg: 'Server error fetching datasets.', error: err.message });
    }
});

// Get specific dataset
DatasetRouter.get('/:datasetId', Middleware, async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);

    if (isNaN(datasetId)) {
        return res.status(400).json({ msg: 'Invalid Dataset ID provided.' });
    }

    let client;
    try {
        client = await pool.connect();

        const datasetResult = await client.query(
            'SELECT dataset_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status FROM datasets WHERE dataset_id = $1 AND user_id = $2',
            [datasetId, userId]
        );

        if (datasetResult.rows.length === 0) {
            const ownerCheck = await client.query('SELECT user_id FROM datasets WHERE dataset_id = $1', [datasetId]);
            if (ownerCheck.rows.length > 0) {
                return res.status(403).json({ msg: 'Access denied. This dataset does not belong to you.' });
            }
            return res.status(404).json({ msg: 'Dataset not found.' });
        }

        const dataset = datasetResult.rows[0];

        // Fetch associated columns
        const columnsResult = await client.query(
            'SELECT column_id, column_name, column_type, column_order FROM columns WHERE dataset_id = $1 ORDER BY column_order',
            [datasetId]
        );

        res.status(200).json({
            msg: 'Dataset details retrieved successfully',
            dataset: {
                ...dataset,
                columns: columnsResult.rows // Add columns array to the dataset object
            }
        });

    } catch (err) {
        console.error(`Error fetching dataset ${datasetId} details:`, err.message);
        res.status(500).json({ msg: 'Server error fetching dataset details.', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Get rows for a specific dataset
DatasetRouter.get('/:datasetId/rows', Middleware, async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);

    // Parse pagination, sorting, and filtering parameters from query
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const sortBy = req.query.sortBy;
    // Ensure sortOrder is either 'ASC' or 'DESC', default to 'ASC'
    const sortOrder = req.query.sortOrder && ['ASC', 'DESC'].includes(req.query.sortOrder.toUpperCase()) ? req.query.sortOrder.toUpperCase() : 'ASC';
    let filters = {};
    if (req.query.filters) {
        try {
            filters = JSON.parse(req.query.filters);
        } catch (e) {
            return res.status(400).json({ msg: 'Invalid filters parameter. Must be valid JSON.', error: e.message });
        }
    }

    // Basic validation for direct route parameters
    if (isNaN(datasetId) || datasetId <= 0) {
        return res.status(400).json({ msg: 'Invalid Dataset ID provided.' });
    }
    if (isNaN(page) || page <= 0) {
        return res.status(400).json({ msg: 'Invalid page number. Page must be a positive integer.' });
    }
    if (isNaN(limit) || limit <= 0 || limit > 1000) {
        return res.status(400).json({ msg: 'Invalid limit. Limit must be between 1 and 1000.' });
    }

    try {
        // Call the utility function, passing all options
        const result = await getPaginatedSortedFilteredRows(
            datasetId,
            userId,
            { page, limit, sortBy, sortOrder, filters }
        );

        res.status(200).json({
            msg: 'Dataset rows retrieved successfully',
            ...result // Spread the data and pagination from the utility function result
        });

    } catch (err) {
        console.error(`Error fetching rows for dataset ${datasetId}:`, err.message);
        // Catch specific errors thrown by the utility function and map to HTTP status codes
        if (err.message.includes('Dataset not found')) {
            res.status(404).json({ msg: err.message });
        } else if (err.message.includes('Access denied')) {
            res.status(403).json({ msg: err.message });
        } else if (
            err.message.includes('Invalid') ||
            err.message.includes('Unsupported') ||
            err.message.includes('Cannot sort')
        ) {
            res.status(400).json({ msg: err.message });
        } else {
            res.status(500).json({ msg: 'Server error fetching dataset rows.', error: err.message });
        }
    }
});

export default DatasetRouter;