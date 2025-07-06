import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const TEST_CSV_PATH = path.join(__dirname, '../../DatabaseTest/Ecommerce_Customers.csv');
const TEST_CSV_PATH2 = path.join(__dirname, '../../DatabaseTest/walmart_stock.csv');

const testUtils = await import('../testUtils.js');
const { request, app, pool, API_BASE_URL, seedTestDataset, commonBeforeEach, endPool } = testUtils;

describe('DELETE API Endpoints Integration Tests', () => {
    let testUserId;
    let seededDatasetId;
    let seededDatasetId2;

    beforeAll(async () => {
        // Set NODE_ENV is handled by jest.setup.js
        try {
            const client = await pool.connect();
            console.log('Connected to test database for DELETE suite.');
            client.release();
        } catch (error) {
            console.error('Failed to connect to test database for DELETE suite:', error);
            throw new Error('Test database not accessible. Ensure docker-compose.test.yml is running.');
        }
    });

    afterAll(async () => {
        await endPool();
    });

    // Per-test setup: clear DB, create a fresh test user, and seed a dataset
    beforeEach(async () => {
        testUserId = await commonBeforeEach();
        const client = await pool.connect();
        try {
            seededDatasetId = await seedTestDataset(client, testUserId, TEST_CSV_PATH, 'Seeded DELETE Dataset from Ecommerce_Customers.csv', 'For DELETE tests');
            seededDatasetId2 = await seedTestDataset(client, testUserId, TEST_CSV_PATH2, 'Seeded DELETE Dataset from walmart_stock.csv', 'For DELETE tests');
        } finally {
            client.release();
        }
    });

    // --- Delete Datasets Tests (del.js: DeleteDatasets) ---
    describe('DELETE /datasets/:datasetId', () => {
        test('should delete a dataset and its data successfully', async () => {
            const res = await request(app)
                .delete(`${API_BASE_URL}/datasets/${seededDatasetId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual(`Dataset ${seededDatasetId} and all associated data deleted successfully.`);

            const res2 = await request(app)
                .delete(`${API_BASE_URL}/datasets/${seededDatasetId2}`);

            expect(res2.statusCode).toEqual(200);
            expect(res2.body.msg).toEqual(`Dataset ${seededDatasetId2} and all associated data deleted successfully.`);

            // Verify deletion in DB
            const client = await pool.connect();
            try {
                const datasetCheck = await client.query('SELECT * FROM datasets WHERE dataset_id = $1', [seededDatasetId]);
                expect(datasetCheck.rows.length).toBe(0);

                const columnsCheck = await client.query('SELECT * FROM columns WHERE dataset_id = $1', [seededDatasetId]);
                expect(columnsCheck.rows.length).toBe(0);

                const csvDataCheck = await client.query('SELECT * FROM csv_data WHERE dataset_id = $1', [seededDatasetId]);
                expect(csvDataCheck.rows.length).toBe(0);

                const datasetCheck2 = await client.query('SELECT * FROM datasets WHERE dataset_id = $1', [seededDatasetId2]);
                expect(datasetCheck2.rows.length).toBe(0);

                const columnsCheck2 = await client.query('SELECT * FROM columns WHERE dataset_id = $1', [seededDatasetId2]);
                expect(columnsCheck2.rows.length).toBe(0);

                const csvDataCheck2 = await client.query('SELECT * FROM csv_data WHERE dataset_id = $1', [seededDatasetId2]);
                expect(csvDataCheck2.rows.length).toBe(0);
            } finally {
                client.release();
            }
        });

        test('should return 400 for invalid dataset ID', async () => {
            const res = await request(app)
                .delete(`${API_BASE_URL}/datasets/abc`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('Invalid Dataset ID provided.');
        });

        test('should return 404 for non-existent dataset', async () => {
            const res = await request(app)
                .delete(`${API_BASE_URL}/datasets/99999`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual('Dataset not found.');
        });

        test('should return 403 if dataset does not belong to user', async () => {
            const client = await pool.connect();
            let otherUserId;
            try {
                const otherUserResult = await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['otheruser', 'other@example.com', 'hashedpassword']);
                otherUserId = otherUserResult.rows[0].id;
                const otherDatasetId = await seedTestDataset(client, otherUserId, TEST_CSV_PATH, 'Seeded GET Dataset from Ecommerce_Customers.csv', 'For DELETE tests');

                const res = await request(app)
                    .delete(`${API_BASE_URL}/datasets/${otherDatasetId}`);

                expect(res.statusCode).toEqual(403);
                expect(res.body.msg).toEqual('Access denied. This dataset does not belong to you.');
            } finally {
                client.release();
            }
        });
    });
});