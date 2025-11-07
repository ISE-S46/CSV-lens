import { pool } from "../main.js";
import { validateDatasetId } from './utils/Validation.js';
import { getDatasetMetadataById } from "../Models/get.model.js";
import { updateSpecificRowMongo, renameColumnNameMongo } from "../Models/update.model.js";

const UpdateSpecificRow = async (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ msg: 'Unauthorized: User authentication details missing.' });
    }

    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const newRowData = req.body;

    if (validateDatasetId(datasetId, res)) return;

    if (isNaN(rowNumber) || rowNumber <= 0) {
        return res.status(400).json({ msg: 'Invalid Row Number provided. Row number must be a positive integer.' });
    }

    // Basic validation for request body
    if (typeof newRowData !== 'object' || newRowData === null || Array.isArray(newRowData) || Object.keys(newRowData).length === 0) {
        return res.status(400).json({ msg: 'Invalid request body. Expected a non-empty JSON object representing the row data.' });
    }

    try {
        const datasetMetadata = await getDatasetMetadataById(datasetId);

        if (!datasetMetadata) {
            return res.status(404).json({ msg: 'Dataset not found.' });
        }

        const { user_id: datasetOwnerId, row_count: totalRows } = datasetMetadata;

        if (datasetOwnerId !== userId) {
            return res.status(403).json({ msg: 'Access denied. This dataset does not belong to you.' });
        }

        if (rowNumber > totalRows) {
            return res.status(404).json({ msg: `Row number ${rowNumber} exceeds total rows (${totalRows}) for this dataset.` });
        }

        const updatedRow = await updateSpecificRowMongo(
            datasetId,
            rowNumber,
            newRowData
        );

        res.status(200).json({
            msg: `Row ${rowNumber} in dataset ${datasetId} updated successfully.`,
            updatedRow: updatedRow
        });

    } catch (err) {
        console.error(`Error updating row ${rowNumber} for dataset ${datasetId}:`, err.message);

        if (err.message.includes('not found')) {
            return res.status(404).json({ msg: err.message });
        }

        res.status(500).json({ msg: 'Server error during row update.', error: err.message });
    }
}

const UpdateColumnName = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);
    const oldColumnName = req.params.oldColumnName;
    const { newColumnName } = req.body;

    if (validateDatasetId(datasetId, res)) return;

    if (typeof oldColumnName !== 'string' || oldColumnName.trim() === '') {
        return res.status(400).json({ msg: 'Invalid Old Column Name provided.' });
    }
    if (typeof newColumnName !== 'string' || newColumnName.trim() === '') {
        return res.status(400).json({ msg: 'New Column Name is required and must be a non-empty string.' });
    }
    if (oldColumnName.trim() === newColumnName.trim()) {
        return res.status(400).json({ msg: 'New column name cannot be the same as the old column name.' });
    }

    // Sanitize column names to prevent SQL injection (although binding handles this)
    const sanitizedOldColumnName = oldColumnName.trim();
    const sanitizedNewColumnName = newColumnName.trim();

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Verify dataset ownership and existence
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

        // Verify oldColumnName exists for this dataset and get its details
        const oldColumnResult = await client.query(
            'SELECT column_id, column_name, column_type, column_order FROM columns WHERE dataset_id = $1 AND column_name = $2',
            [datasetId, sanitizedOldColumnName]
        );

        if (oldColumnResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ msg: `Column '${sanitizedOldColumnName}' not found for this dataset.` });
        }

        // Check if newColumnName already exists for this dataset
        const newColumnConflictResult = await client.query(
            'SELECT column_id FROM columns WHERE dataset_id = $1 AND column_name = $2',
            [datasetId, sanitizedNewColumnName]
        );

        if (newColumnConflictResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ msg: `Column name '${sanitizedNewColumnName}' already exists in this dataset.` });
        }

        // Update the column_name in the 'columns' table
        await client.query(
            'UPDATE columns SET column_name = $1 WHERE dataset_id = $2 AND column_name = $3',
            [sanitizedNewColumnName, datasetId, sanitizedOldColumnName]
        );

        await client.query('COMMIT');

        await renameColumnNameMongo(datasetId, sanitizedOldColumnName, sanitizedNewColumnName);

        res.status(200).json({
            msg: `Column '${sanitizedOldColumnName}' successfully renamed to '${sanitizedNewColumnName}' for dataset ${datasetId}.`
        });

    } catch (err) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(`Error renaming column '${sanitizedOldColumnName}' to '${sanitizedNewColumnName}' for dataset ${datasetId}:`, err.message);
        res.status(500).json({ msg: 'Server error during column rename.', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
    }
}

export { UpdateSpecificRow, UpdateColumnName };