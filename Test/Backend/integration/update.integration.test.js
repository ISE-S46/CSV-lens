import path from 'path';
import { fileURLToPath } from 'url';

const testUtils = await import('../testUtils.js');
const { request, app, pool, API_BASE_URL, seedTestDataset, commonBeforeEach, endPool } = testUtils;

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const TEST_CSV_PATH = path.join(__dirname, '../../DatabaseTest/test3.csv');
const TEST_CSV_PATH2 = path.join(__dirname, '../../DatabaseTest/TestTimeStamp.csv');

describe('PUT/PATCH API Endpoints Integration Tests', () => {
    let testUserId;
    let seededDatasetId;
    let seededDatasetId2;

    beforeAll(async () => {
        // Set NODE_ENV is handled by jest.setup.js
        try {
            const client = await pool.connect();
            console.log('Connected to test database for UPDATE suite.');
            client.release();
        } catch (error) {
            console.error('Failed to connect to test database for UPDATE suite:', error);
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
            seededDatasetId = await seedTestDataset(client, testUserId, TEST_CSV_PATH, 'Seeded PUT/PATCH Dataset from test3.csv', 'For PUT/PATCH tests');
            seededDatasetId2 = await seedTestDataset(client, testUserId, TEST_CSV_PATH2, 'Seeded PUT/PATCH Dataset from TestTimeStamp.csv', 'For PUT/PATCH tests');
        } finally {
            client.release();
        }
    });

    // --- Update Specific Row Tests (update.js: UpdateSpecificRow) ---
    describe('PUT /datasets/:datasetId/rows/:rowNumber', () => {
        test('should update a specific row successfully', async () => {
            const newRowData = {
                "Name": "khaslana",
                "Age": "33550336",
                "City": "aedes elysiae",
                "Registered": "false",
                "StartDate": "0000-01-01",
                "Amount": "48000000.00"
            };
            const res = await request(app)
                .put(`${API_BASE_URL}/datasets/${seededDatasetId}/rows/1`)
                .send(newRowData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual(`Row 1 in dataset ${seededDatasetId} updated successfully.`);
            expect(res.body.updatedRow).toEqual(newRowData);

            // Verify in DB
            const client = await pool.connect();
            try {
                const updatedRow = await client.query('SELECT row_data FROM csv_data WHERE dataset_id = $1 AND row_number = $2', [seededDatasetId, 1]);
                expect(updatedRow.rows[0].row_data).toEqual(newRowData);
            } finally {
                client.release();
            }
        });

        test('should return 400 for invalid row number', async () => {
            const res = await request(app)
                .put(`${API_BASE_URL}/datasets/${seededDatasetId}/rows/0`)
                .send({ id: '1', name: 'Test', value: '100' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('Invalid Row Number provided. Row number must be a positive integer.');
        });

        test('should return 404 for non-existent row number', async () => {
            const res = await request(app)
                .put(`${API_BASE_URL}/datasets/${seededDatasetId}/rows/999`)
                .send({ id: '1', name: 'Test', value: '100' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual(`Row number 999 exceeds total rows (10) for this dataset.`);
        });

        test('should return 404 for non-existent dataset', async () => {
            const res = await request(app)
                .put(`${API_BASE_URL}/datasets/99999/rows/1`)
                .send({ id: '1', name: 'Test', value: '100' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual('Dataset not found.');
        });

        test('should return 403 if dataset does not belong to user', async () => {
            const client = await pool.connect();
            let otherUserId;
            try {
                const otherUserResult = await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['otheruser', 'other@example.com', 'hashedpassword']);
                otherUserId = otherUserResult.rows[0].id;
                const otherDatasetId = await seedTestDataset(client, otherUserId, TEST_CSV_PATH, 'Seeded PUT/PATCH Dataset from test3.csv', 'For PUT/PATCH tests');

                // Make the request as the original test user trying to update the other user's dataset
                const res = await request(app)
                    .put(`${API_BASE_URL}/datasets/${otherDatasetId}/rows/1`)
                    .send({
                        "Name": "kevin kaslana",
                        "Age": "40000",
                        "City": "Moon",
                        "Registered": "true",
                        "StartDate": "0000-01-01",
                        "Amount": "99999999.00"
                    });

                expect(res.statusCode).toEqual(403);
                expect(res.body.msg).toEqual('Access denied. This dataset does not belong to you.');
            } finally {
                client.release();
            }
        });
    });

    // --- Update Column Name Tests (update.js: UpdateColumnName) ---
    describe('PATCH /datasets/:datasetId/columns/:oldColumnName', () => {
        test('should rename a column successfully', async () => {
            const res = await request(app)
                .patch(`${API_BASE_URL}/datasets/${seededDatasetId2}/columns/timestamp`)
                .send({ newColumnName: 'last_access' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual(`Column 'timestamp' successfully renamed to 'last_access' for dataset ${seededDatasetId2}.`);

            // Verify in DB
            const client = await pool.connect();
            try {
                const columns = await client.query('SELECT column_name FROM columns WHERE dataset_id = $1 ORDER BY column_order', [seededDatasetId2]);
                expect(columns.rows).toEqual([
                    { column_name: 'name' },
                    { column_name: 'last_access' },
                ]);

                const csvData = await client.query('SELECT row_data FROM csv_data WHERE dataset_id = $1 ORDER BY row_number', [seededDatasetId2]);
                expect(csvData.rows[0].row_data).toHaveProperty('last_access');
                expect(csvData.rows[0].row_data).not.toHaveProperty('timestamp');
                expect(csvData.rows[0].row_data.last_access).toEqual('2025-06-30T08:15:00Z');
            } finally {
                client.release();
            }
        });

        test('should return 400 if newColumnName is missing', async () => {
            const res = await request(app)
                .patch(`${API_BASE_URL}/datasets/${seededDatasetId2}/columns/last_access`)
                .send({});

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('New Column Name is required and must be a non-empty string.');
        });

        test('should return 400 if newColumnName is same as oldColumnName', async () => {
            const res = await request(app)
                .patch(`${API_BASE_URL}/datasets/${seededDatasetId2}/columns/last_access`)
                .send({ newColumnName: 'last_access' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('New column name cannot be the same as the old column name.');
        });

        test('should return 404 if oldColumnName does not exist', async () => {
            const res = await request(app)
                .patch(`${API_BASE_URL}/datasets/${seededDatasetId2}/columns/non_existent_column`)
                .send({ newColumnName: 'new_column' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual(`Column 'non_existent_column' not found for this dataset.`);
        });

        test('should return 409 if newColumnName already exists', async () => {
            const res = await request(app)
                .patch(`${API_BASE_URL}/datasets/${seededDatasetId2}/columns/last_access`)
                .send({ newColumnName: 'last_access' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual(`New column name cannot be the same as the old column name.`);
        });

        test('should return 403 if dataset does not belong to user', async () => {
            const client = await pool.connect();
            let otherUserId;
            try {
                const otherUserResult = await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['otheruser', 'other@example.com', 'hashedpassword']);
                otherUserId = otherUserResult.rows[0].id;
                const otherDatasetId = await seedTestDataset(client, otherUserId, TEST_CSV_PATH2, 'Seeded PUT/PATCH Dataset from TestTimeStamp.csv', 'For PUT/PATCH tests');

                const res = await request(app)
                    .patch(`${API_BASE_URL}/datasets/${otherDatasetId}/columns/timestamp`)
                    .send({ newColumnName: 'last_access' });

                expect(res.statusCode).toEqual(403);
                expect(res.body.msg).toEqual('Access denied. This dataset does not belong to you.');
            } finally {
                client.release();
            }
        });
    });
});