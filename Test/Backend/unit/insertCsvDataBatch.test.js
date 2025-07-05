import { insertCsvDataBatch } from '../../../Backend/Routes/controllers/subFunction/HandleCSV.js';

const testUtils = await import('../testUtils.js');
const { pool, commonBeforeEach, endPool } = testUtils;

describe('insertCsvDataBatch', () => {
    let testUserId;
    let datasetId;
    let client

    // Connect to the real test database and set up user/dataset before each test
    beforeEach(async () => {
        testUserId = await commonBeforeEach();
        client = await pool.connect(); 

        const datasetResult = await client.query(
            'INSERT INTO datasets (user_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING dataset_id',
            [testUserId, 'Batch Insert Test', 'batch.csv', 'Test batch insert', 100, 5, 'completed']
        );
        datasetId = datasetResult.rows[0].dataset_id;
    });

    afterEach(async () => {
        if (client) {
            client.release();
        }
    });

    test('should insert a single batch of CSV data', async () => {
        const dataToInsert = [
            { colA: 'val1', colB: '10' },
            { colA: 'val2', colB: '20' },
        ];

        await insertCsvDataBatch(client, datasetId, dataToInsert);

        const retrievedData = await client.query(
            'SELECT row_number, row_data FROM csv_data WHERE dataset_id = $1 ORDER BY row_number',
            [datasetId]
        );

        expect(retrievedData.rows.length).toBe(2);
        expect(retrievedData.rows[0].row_data).toEqual({ colA: 'val1', colB: '10' });
        expect(retrievedData.rows[1].row_data).toEqual({ colA: 'val2', colB: '20' });
    });

    test('should handle empty data array gracefully', async () => {
        const dataToInsert = [];
        await insertCsvDataBatch(client, datasetId, dataToInsert);

        const retrievedData = await client.query(
            'SELECT row_number, row_data FROM csv_data WHERE dataset_id = $1',
            [datasetId]
        );
        expect(retrievedData.rows.length).toBe(0); // Expect no rows
    });

    test('should handle multiple batches if data size exceeds batchSize', async () => {
        // The batchSize is defined inside insertCsvDataBatch (500)
        const largeData = Array(501).fill(null).map((_, i) => ({ id: `${i + 1}`, name: `Item ${i + 1}` }));

        await insertCsvDataBatch(client, datasetId, largeData);

        // Query the database to verify ALL data from all batches
        const retrievedData = await client.query(
            'SELECT row_number, row_data FROM csv_data WHERE dataset_id = $1 ORDER BY row_number',
            [datasetId]
        );

        expect(retrievedData.rows.length).toBe(largeData.length); // Verify total count
        expect(retrievedData.rows[0].row_data).toEqual({ id: '1', name: 'Item 1' });
        expect(retrievedData.rows[500].row_data).toEqual({ id: '501', name: 'Item 501' });
        // Optionally, check a few more to be confident
        expect(retrievedData.rows[largeData.length - 1].row_data).toEqual(largeData[largeData.length - 1]);
    });

    afterAll(async () => {
        await endPool();
    });
});