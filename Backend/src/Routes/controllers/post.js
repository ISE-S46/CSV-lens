import { pool } from '../../main.js';
import { parseCsvBuffer, insertCsvDataBatch } from './utils/HandleCSV.js';

const CSVuploadEndpoint = async (req, res) => {
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
}

export { CSVuploadEndpoint };