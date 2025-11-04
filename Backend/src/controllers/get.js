import { pool } from '../main.js';
import { validateDatasetId } from './utils/Validation.js';
import { getPaginatedSortedFilteredRows, getDatasetColumns, getSortFilteredRowsForGraph } from './utils/dataRetrieval.js';

import { findAllDatasetsByUserId, getDatasetAndColumnsById } from '../Models/get.model.js';

const ListAllDatasets = async (req, res) => {
    const userId = req.user.id; 

    try {
        const datasets = await findAllDatasetsByUserId(userId); 

        res.status(200).json({
            msg: 'Datasets retrieved successfully',
            datasets: datasets
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

    try {
        const datasetWithColumns = await getDatasetAndColumnsById(datasetId, userId);

        if (!datasetWithColumns) {
            return res.status(404).json({ msg: 'Dataset not found.' });
        }

        res.status(200).json({
            msg: 'Dataset details retrieved successfully',
            dataset: datasetWithColumns
        });

    } catch (err) {
        console.error(`Error fetching dataset ${datasetId} details:`, err.message);
        res.status(500).json({ msg: 'Server error fetching dataset details.' });
    }
}

const GetSpecificDatasetRow = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);

    // Parse pagination, sorting, and filtering parameters from query
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    // Parse multiple sort columns and directions
    let sortColumns = [];
    let sortDirections = [];
    if (req.query.sortBy) {
        sortColumns = req.query.sortBy.split(',');
    }
    if (req.query.sortOrder) {
        sortDirections = req.query.sortOrder.split(',');
    }

    let filters = {};
    if (req.query.filters) {
        try {
            filters = JSON.parse(req.query.filters);
        } catch (e) {
            return res.status(400).json({ msg: 'Invalid filters parameter. Must be valid JSON.', error: e.message });
        }
    }

    if (validateDatasetId(datasetId, res)) return;

    if (isNaN(page) || page <= 0) {
        return res.status(400).json({ msg: 'Invalid page number. Page must be a positive integer.' });
    }
    if (isNaN(limit) || limit <= 0 || limit > 1000) {
        return res.status(400).json({ msg: 'Invalid limit. Limit must be between 1 and 1000.' });
    }

    // Validate sort directions
    const validDirections = ['ASC', 'DESC'];
    for (const dir of sortDirections) {
        if (!validDirections.includes(dir.toUpperCase())) {
            return res.status(400).json({ msg: `Invalid sort direction: ${dir}. Must be ASC or DESC.` });
        }
    }

    // Validate same number of sort columns and directions
    if (sortColumns.length !== sortDirections.length) {
        return res.status(400).json({ msg: 'Number of sort columns must match number of sort directions.' });
    }

    try {
        // Call the utility function with multiple sort support
        const result = await getPaginatedSortedFilteredRows(
            datasetId,
            userId,
            {
                page,
                limit,
                sortColumns,
                sortDirections,
                filters
            }
        );

        res.status(200).json({
            msg: 'Dataset rows retrieved successfully',
            ...result
        });

    } catch (err) {
        console.error(`Error fetching rows for dataset ${datasetId}:`, err.message);
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

const GetSpecificDatasetAllRows = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);

    let sortColumns = [];
    let sortDirections = [];
    if (req.query.sortBy) {
        sortColumns = req.query.sortBy.split(',');
    }
    if (req.query.sortOrder) {
        sortDirections = req.query.sortOrder.split(',');
    }

    let filters = {};
    if (req.query.filters) {
        try {
            filters = JSON.parse(req.query.filters);
        } catch (e) {
            return res.status(400).json({ msg: 'Invalid filters parameter. Must be valid JSON.', error: e.message });
        }
    }

    if (validateDatasetId(datasetId, res)) return;

    // Validate sort directions
    const validDirections = ['ASC', 'DESC'];
    for (const dir of sortDirections) {
        if (!validDirections.includes(dir.toUpperCase())) {
            return res.status(400).json({ msg: `Invalid sort direction: ${dir}. Must be ASC or DESC.` });
        }
    }

    try {
        // Call the utility function with multiple sort support
        const result = await getSortFilteredRowsForGraph(
            datasetId,
            userId,
            {
                sortColumns,
                sortDirections,
                filters
            }
        );

        res.status(200).json({
            msg: 'Dataset rows retrieved successfully',
            ...result
        });

    } catch (err) {
        console.error(`Error fetching rows for dataset ${datasetId}:`, err.message);
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

const GetSpecificDatasetNullRow = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10000; // Default to 10000 to get a large chunk or all

    if (validateDatasetId(datasetId, res)) return;

    if (isNaN(page) || page <= 0) {
        return res.status(400).json({ msg: 'Invalid page number. Page must be a positive integer.' });
    }
    if (isNaN(limit) || limit <= 0 || limit > 10000) {
        return res.status(400).json({ msg: 'Invalid limit. Limit must be between 1 and 10000.' });
    }

    try {
        // Get all column names for the dataset
        const datasetColumns = await getDatasetColumns(datasetId);
        if (!datasetColumns || datasetColumns.length === 0) {
            return res.status(404).json({ msg: 'Dataset columns not found or empty.' });
        }

        // Construct the filter to find rows where ANY column is null/empty
        const nullCheckOrConditions = datasetColumns.map(col => ({
            columnName: col.column_name,
            operator: 'isNull',
            value: true
        }));

        const filters = {
            _or_conditions: nullCheckOrConditions
        };

        const result = await getPaginatedSortedFilteredRows(
            datasetId,
            userId,
            { page, limit, filters } // Pass the constructed filters
        );

        res.status(200).json({
            msg: 'Null rows retrieved successfully',
            count: result.pagination.totalRows, // Total count of rows with nulls
            data: result.data, // The actual null rows
            pagination: result.pagination // Redundant but might need later
        });

    } catch (err) {
        console.error(`Error fetching null rows for dataset ${datasetId}:`, err.message);
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
            res.status(500).json({ msg: 'Server error fetching null rows.', error: err.message });
        }
    }
}

const GetSingleRowByNumber = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);
    const rowNumber = parseInt(req.params.rowNumber, 10);

    if (validateDatasetId(datasetId, res)) return;

    if (isNaN(rowNumber) || rowNumber <= 0) {
        return res.status(400).json({ msg: 'Invalid row number provided. Row number must be a positive integer.' });
    }

    let client;
    try {
        client = await pool.connect();

        const datasetCheckResult = await client.query(
            'SELECT user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (datasetCheckResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Dataset not found.' });
        }

        const datasetOwnerId = datasetCheckResult.rows[0].user_id;

        if (datasetOwnerId !== userId) {
            return res.status(403).json({ msg: 'Access denied. This dataset does not belong to you.' });
        }

        const rowResult = await client.query(
            'SELECT row_data FROM csv_data WHERE dataset_id = $1 AND row_number = $2',
            [datasetId, rowNumber]
        );

        if (rowResult.rows.length === 0) {
            return res.status(404).json({ msg: `Row ${rowNumber} not found in dataset ${datasetId}.` });
        }

        res.status(200).json({
            msg: `Row ${rowNumber} retrieved successfully.`,
            row: rowResult.rows[0].row_data
        });

    } catch (err) {
        console.error(`Error fetching single row ${rowNumber} for dataset ${datasetId}:`, err.message);
        res.status(500).json({ msg: 'Server error fetching single row.', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
}

export {
    ListAllDatasets,
    GetSpecificDataset,
    GetSpecificDatasetRow,
    GetSpecificDatasetAllRows,
    GetSpecificDatasetNullRow,
    GetSingleRowByNumber
};