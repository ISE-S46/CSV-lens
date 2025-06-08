import { pool } from '../../main.js';

import { getPaginatedSortedFilteredRows } from './subFunction/dataRetrieval.js';

const ListAllDatasets = async (req, res) => {
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
}

const GetSpecificDataset = async (req, res) => {
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
}

const GetSpecificDatasetRow = async (req, res) => {
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
}

export { ListAllDatasets, GetSpecificDataset, GetSpecificDatasetRow };