import { pool } from '../main.js';
import { RowDataModel } from './rowData.model.js';
import { buildFilterClause, buildSortingOptions } from './sortFilter.Model.js';

const findAllDatasetsByUserId = async (userId) => {
    const queryText = `
        SELECT 
            dataset_id, csv_name, original_filename, description, 
            file_size_bytes, row_count, upload_date, status 
        FROM datasets 
        WHERE user_id = $1 
        ORDER BY upload_date DESC
    `;

    const result = await pool.query(queryText, [userId]);

    return result.rows;
}

const getDatasetAndColumnsById = async (datasetId, userId) => {
    let client;
    try {
        client = await pool.connect();

        const datasetQuery = `
            SELECT dataset_id, csv_name, original_filename, description, file_size_bytes, 
                   row_count, upload_date, status 
            FROM datasets 
            WHERE dataset_id = $1 AND user_id = $2
        `;
        const datasetResult = await client.query(datasetQuery, [datasetId, userId]);

        if (datasetResult.rows.length === 0) {
            return null;
        }

        const dataset = datasetResult.rows[0];

        const columnsQuery = `
            SELECT column_id, column_name, column_type, column_order 
            FROM columns 
            WHERE dataset_id = $1 
            ORDER BY column_order
        `;
        const columnsResult = await client.query(columnsQuery, [datasetId]);

        return {
            ...dataset,
            columns: columnsResult.rows
        };

    } finally {
        if (client) {
            client.release();
        }
    }
}

const getSingleRowByIds = async (datasetId, rowNumber, userId) => {
    let client;
    try {
        client = await pool.connect();

        const datasetCheckResult = await client.query(
            'SELECT user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (datasetCheckResult.rows.length === 0) {
            return 'not_found';
        }

        const datasetOwnerId = datasetCheckResult.rows[0].user_id;
        if (datasetOwnerId !== userId) {
            return 'access_denied';
        }

        const rowDocument = await RowDataModel.findOne(
            { dataset_id: datasetId, row_number: rowNumber },
            { row_data: 1, _id: 0 }
        ).lean(); // .lean() converts the Mongoose Document to a plain, fast JavaScript object

        if (!rowDocument) {
            return 'row_not_found';
        }

        return rowDocument.row_data;

    } catch (err) {
        console.error(`Error in getSingleRowByIds:`, err.message);
        throw err;
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function getDatasetColumns(datasetId) {
    let client;
    try {
        client = await pool.connect();
        const columnsResult = await client.query(
            'SELECT column_name, column_type FROM columns WHERE dataset_id = $1 ORDER BY column_order',
            [datasetId]
        );
        return columnsResult.rows.map(col => ({
            column_name: col.column_name,
            column_type: col.column_type
        }));
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function getPaginatedSortedFilteredRows(
    datasetId,
    userId,
    { page = 1, limit = 50, sortColumns = [], sortDirections = [], filters = {} }
) {
    const offset = (page - 1) * limit;
    let client; // PostgreSQL client

    try {
        client = await pool.connect();

        const { rows } = await client.query(
            'SELECT user_id, row_count FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (rows.length === 0) throw new Error('Dataset not found');
        if (rows[0].user_id !== userId) throw new Error('Access denied');

        const totalRowsUnfiltered = rows[0].row_count;

        const datasetColumns = await getDatasetColumns(datasetId);
        const columnTypes = new Map(datasetColumns.map(col => [col.column_name, col.column_type]));

        const baseFilter = { dataset_id: datasetId };

        const dynamicFilters = buildFilterClause(filters, columnTypes);

        const finalFilter = { ...baseFilter, ...dynamicFilters };

        const sortOptions = buildSortingOptions(sortColumns, sortDirections);

        const totalFiltered = await RowDataModel.countDocuments(finalFilter);

        const rowsResult = await RowDataModel.find(
            finalFilter,
            { row_data: 1, row_number: 1, _id: 0 }
        )
            .sort(sortOptions)
            .skip(offset)
            .limit(limit)
            .lean();

        const data = rowsResult.map(doc => ({
            row_data: doc.row_data,
            row_number: doc.row_number
        }));

        const totalPages = Math.ceil(totalFiltered / limit);

        return {
            data,
            pagination: {
                totalRows: totalFiltered,
                rowsPerPage: limit,
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                // Include total unfiltered count for context
                totalUnfilteredRows: totalRowsUnfiltered
            }
        };

    } catch (error) {
        console.error('MongoDB/PostgreSQL query error in getPaginatedSortedFilteredRows:', error);
        throw error;
    } finally {
        if (client) {
            client.release()
        }
    }
}

async function getSortFilteredRowsForGraph(
    datasetId,
    userId,
    { sortColumns = [], sortDirections = [], filters = {} }
) {

    const datasetColumns = await getDatasetColumns(datasetId, userId);

    if (!datasetColumns || datasetColumns.length === 0) {
        throw new Error('Dataset not found or access denied.');
    }

    const columnTypes = new Map(datasetColumns.map(col => [col.column_name, col.column_type]));

    const filterQuery = buildFilterClause(filters, columnTypes);
    const sortOptions = buildSortingOptions(sortColumns, sortDirections);

    const baseQuery = { dataset_id: datasetId };

    const finalQuery = { ...baseQuery, ...filterQuery };

    try {
        const rowsResult = await RowDataModel.find(finalQuery)
            .sort(sortOptions)
            .lean()
            .exec();

        const totalFiltered = await RowDataModel.countDocuments(finalQuery);

        const data = rowsResult.map(row => row.row_data);

        return {
            data,
            totalRows: totalFiltered
        };

    } catch (error) {
        console.error('MongoDB query error in getSortFilteredRowsForGraphMongo:', error.message);
        throw error;
    }
}

export {
    findAllDatasetsByUserId,
    getDatasetAndColumnsById,
    getSingleRowByIds,
    getDatasetColumns,
    getPaginatedSortedFilteredRows,
    getSortFilteredRowsForGraph
};