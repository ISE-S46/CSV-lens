import { pool } from "../../main.js";
import { validateDatasetId } from './subFunction/Validation.js';

const UpdateSpecificRow = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const newRowData = req.body;

    if (validateDatasetId(datasetId, res)) return;

    if (isNaN(rowNumber) || rowNumber <= 0) {
        return res.status(400).json({ msg: 'Invalid Row Number provided. Row number must be a positive integer.' });
    }

    // Basic validation for request body
    if (typeof newRowData !== 'object' || newRowData === null || Array.isArray(newRowData)) {
        return res.status(400).json({ msg: 'Invalid request body. Expected a JSON object representing the row data.' });
    }
    if (Object.keys(newRowData).length === 0) {
        return res.status(400).json({ msg: 'New row data cannot be empty.' });
    }

    let client;
    try {
        client = await pool.connect();

        // Verify dataset ownership and existence
        const datasetCheckResult = await client.query(
            'SELECT user_id, row_count FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (datasetCheckResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Dataset not found.' });
        }

        const { user_id: datasetOwnerId, row_count: totalRows } = datasetCheckResult.rows[0];

        if (datasetOwnerId !== userId) {
            return res.status(403).json({ msg: 'Access denied. This dataset does not belong to you.' });
        }

        // Check if rowNumber is within valid range (1 to totalRows)
        if (rowNumber > totalRows) {
            return res.status(404).json({ msg: `Row number ${rowNumber} exceeds total rows (${totalRows}) for this dataset.` });
        }

        // Update the row_data in the csv_data table
        const updateResult = await client.query(
            'UPDATE csv_data SET row_data = $1 WHERE dataset_id = $2 AND row_number = $3 RETURNING row_data',
            [newRowData, datasetId, rowNumber]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ msg: `Row ${rowNumber} not found in dataset ${datasetId}.` });
        }

        res.status(200).json({
            msg: `Row ${rowNumber} in dataset ${datasetId} updated successfully.`,
            updatedRow: updateResult.rows[0].row_data
        });

    } catch (err) {
        console.error(`Error updating row ${rowNumber} for dataset ${datasetId}:`, err.message);
        res.status(500).json({ msg: 'Server error during row update.', error: err.message });
    } finally {
        if (client) {
            client.release();
        }
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

    // Sanitize column names to prevent SQL injection
    const sanitizedOldColumnName = oldColumnName.trim();
    const sanitizedNewColumnName = newColumnName.trim();

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start a transaction for atomicity

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

        // Method 1: Using string concatenation (more explicit typing)
        const updateQuery = `
            UPDATE csv_data
            SET row_data = (row_data - $1::text) || jsonb_build_object($2::text, row_data->$1::text)
            WHERE dataset_id = $3
        `;

        try {
            await client.query(updateQuery, [sanitizedOldColumnName, sanitizedNewColumnName, datasetId]);
        } catch (jsonbError) {
            console.log('Method 1 failed, trying alternative approach:', jsonbError.message);
            
            // Method 2: Alternative approach using format() function to avoid parameter type issues
            const alternativeQuery = `
                UPDATE csv_data
                SET row_data = row_data - $1 || jsonb_build_object($2, row_data->$1)
                WHERE dataset_id = $3 AND row_data ? $1
            `;
            
            try {
                await client.query(alternativeQuery, [sanitizedOldColumnName, sanitizedNewColumnName, datasetId]);
            } catch (altError) {
                console.log('Method 2 failed, trying method 3:', altError.message);
                
                // Method 3: Step-by-step approach
                // Get all affected rows
                const rowsToUpdate = await client.query(
                    'SELECT row_number, row_data FROM csv_data WHERE dataset_id = $1 AND row_data ? $2',
                    [datasetId, sanitizedOldColumnName]
                );

                // Update each row individually
                for (const row of rowsToUpdate.rows) {
                    const oldValue = row.row_data[sanitizedOldColumnName];
                    const updatedRowData = { ...row.row_data };
                    
                    // Remove old key and add new key
                    delete updatedRowData[sanitizedOldColumnName];
                    updatedRowData[sanitizedNewColumnName] = oldValue;

                    await client.query(
                        'UPDATE csv_data SET row_data = $1 WHERE dataset_id = $2 AND row_number = $3',
                        [JSON.stringify(updatedRowData), datasetId, row.row_number]
                    );
                }
            }
        }

        await client.query('COMMIT'); // Commit the transaction if all operations succeed

        res.status(200).json({
            msg: `Column '${sanitizedOldColumnName}' successfully renamed to '${sanitizedNewColumnName}' for dataset ${datasetId}.`
        });

    } catch (err) {
        if (client) {
            await client.query('ROLLBACK'); // Rollback if any error occurs
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