import { parseCsvBuffer, } from './utils/HandleCSV.js';
import { insertDatasetAndColumns, insertCsvDataBulk } from '../Models/post.model.js';

const CSVuploadEndpoint = async (req, res) => {
    const userId = req.user.id;
    const { csvName, description } = req.body;

    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded.' });
    }
    if (!csvName || csvName.trim() === '') {
        return res.status(400).json({ msg: 'Dataset Name (csvName) is required.' });
    }
    if (!req.file.mimetype.startsWith('text/csv') && !req.file.mimetype.startsWith('application/vnd.ms-excel')) {
        return res.status(400).json({ msg: 'Only CSV files are allowed. Detected: ' + req.file.mimetype });
    }

    const originalFilename = req.file.originalname;
    const fileSize = req.file.size;
    const csvBuffer = req.file.buffer;

    let postgreClient;

    try {
        const { rows, columnsMetadata, rowCount } = await parseCsvBuffer(csvBuffer);

        if (rowCount === 0) {
            return res.status(400).json({ msg: 'CSV file contains no data rows.' });
        }
        if (columnsMetadata.length === 0) {
            return res.status(400).json({ msg: 'CSV file contains no detectable columns.' });
        }

        const datasetDetails = { csvName, originalFilename, description, fileSize, rowCount };
        const { client, datasetId } = await insertDatasetAndColumns(userId, datasetDetails, columnsMetadata);
        postgreClient = client;

        try {
            await insertCsvDataBulk(datasetId, rows, columnsMetadata); 
        } catch (mongoErr) {
            await postgreClient.query('ROLLBACK');
            throw mongoErr;
        }

        await postgreClient.query('COMMIT'); 

        res.status(201).json({
            msg: 'CSV uploaded and processed successfully',
            rowCount: rowCount,
            datasetId: datasetId,
            columns: columnsMetadata
        });

    } catch (err) {
        if (postgreClient) {
            try {
                const status = await postgreClient.query('SELECT current_setting(\'transaction_isolation\')');
                if (status.rows.length > 0) {
                     await postgreClient.query('ROLLBACK');
                }
            } catch (rbErr) {
                console.error('Error during PostgreSQL rollback:', rbErr.message);
            }
        }
        
        console.error('Error during CSV upload process:', err);
        if (err.message.includes('Failed to parse CSV')) {
            res.status(400).json({ msg: 'Error parsing CSV file. Please check its format.', error: err.message });
        } else {
            res.status(500).json({ msg: 'Server error during CSV processing.', error: err.message });
        }
    } finally {
        if (postgreClient) {
            postgreClient.release();
        }
    }
}

export { CSVuploadEndpoint };