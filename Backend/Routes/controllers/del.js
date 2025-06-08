import { pool } from '../../main.js';

const DeleteDatasets = async (req, res) => {
    const userId = req.user.id; // User ID from the Middleware
    const datasetId = parseInt(req.params.datasetId, 10); // Get dataset ID from URL parameter

    if (isNaN(datasetId) || datasetId <= 0) {
        return res.status(400).json({ msg: 'Invalid Dataset ID provided.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start a transaction

        const datasetCheckResult = await client.query(
            'SELECT user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (datasetCheckResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ msg: 'Dataset not found.' });
        }

        const datasetOwnerId = datasetCheckResult.rows[0].user_id;

        if (datasetOwnerId !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ msg: 'Access denied. This dataset does not belong to you.' });
        }

        // Delete associated CSV data (from csv_data table)
        await client.query('DELETE FROM csv_data WHERE dataset_id = $1', [datasetId]);

        // Delete associated column metadata (from columns table)
        await client.query('DELETE FROM columns WHERE dataset_id = $1', [datasetId]);

        // Delete the main dataset entry (from datasets table)
        await client.query('DELETE FROM datasets WHERE dataset_id = $1', [datasetId]);

        await client.query('COMMIT'); // Commit the transaction if all deletions are successful

        res.status(200).json({ msg: `Dataset ${datasetId} and all associated data deleted successfully.` });

    } catch (err) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Error deleting dataset ${datasetId}:`, err.message);
        res.status(500).json({ msg: 'Server error during dataset deletion.', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
}

export { DeleteDatasets };