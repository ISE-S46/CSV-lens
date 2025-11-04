import { pool } from '../main.js';
import { RowDataModel } from './rowData.model.js';

export const insertDatasetAndColumns = async (userId, datasetDetails, columnsMetadata) => {
    const { csvName, originalFilename, description, fileSize, rowCount } = datasetDetails;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const datasetResult = await client.query(
            'INSERT INTO datasets (user_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING dataset_id',
            [userId, csvName, originalFilename, description || null, fileSize, rowCount, 'completed']
        );
        const datasetId = datasetResult.rows[0].dataset_id;

        const columnInserts = columnsMetadata.map(col => {
            return client.query(
                'INSERT INTO columns (dataset_id, column_name, column_type, column_order) VALUES ($1, $2, $3, $4)',
                [datasetId, col.column_name, col.column_type, col.column_order]
            );
        });
        await Promise.all(columnInserts);

        return { client, datasetId };

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
            client.release();
        }
        throw error;
    }
};

export const insertCsvDataBulk = async (datasetId, rows) => {

    const documents = rows.map((row, index) => ({
        dataset_id: datasetId,
        row_number: index + 1,
        row_data: row
    }));

    await RowDataModel.insertMany(documents, { ordered: false }); 

};