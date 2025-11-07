import { pool } from '../main.js';
import { RowDataModel } from './rowData.model.js';

export const deleteDatasetAndData = async (datasetId, userId) => {
    let client;
    let success = false;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const datasetCheckResult = await client.query(
            'SELECT user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (datasetCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return 'not_found';
        }

        const datasetOwnerId = datasetCheckResult.rows[0].user_id;
        if (datasetOwnerId !== userId) {
            await client.query('ROLLBACK');
            return 'access_denied';
        }

        await client.query('DELETE FROM columns WHERE dataset_id = $1', [datasetId]);

        const mongoResult = await RowDataModel.deleteMany({ dataset_id: datasetId });

        console.log(`[MongoDB] Deleted ${mongoResult.deletedCount} documents for dataset ${datasetId}.`);


        await client.query('DELETE FROM datasets WHERE dataset_id = $1', [datasetId]);

        await client.query('COMMIT');
        success = true;
        return 'success';

    } catch (err) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Error during XA transaction for dataset deletion ${datasetId}:`, err.message);
        throw err;
    } finally {
        if (client) {
            client.release();
        }
    }
};