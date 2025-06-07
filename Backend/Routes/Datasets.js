import express from 'express';
import multer from 'multer'; // Express middleware that handles multipart/form-data
import { pool } from '../main.js';
import Middleware from '../Middleware/authMiddleware.js';
import { parseCsvBuffer, insertCsvDataBatch } from './subFunction/HandleCSV.js';

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

    let client; // Declare client for the database transaction

    try {
        client = await pool.connect(); // Get a client from the pool
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

        // Insert into csv_data table
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

export default DatasetRouter;