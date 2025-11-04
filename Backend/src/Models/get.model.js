import { pool } from '../main.js';

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

export { findAllDatasetsByUserId, getDatasetAndColumnsById };