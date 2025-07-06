import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const TEST_CSV_PATH = path.join(__dirname, '../../DatabaseTest/test3.csv');
const TEST_CSV_PATH2 = path.join(__dirname, '../../DatabaseTest/appl_stock.csv');

const testUtils = await import('../testUtils.js');
const { request, app, pool, API_BASE_URL, seedTestDataset, commonBeforeEach, endPool } = testUtils;

describe('GET API Endpoints Integration Tests', () => {
    let testUserId;
    let seededDatasetId;
    let seededDatasetId2;

    // Global setup/teardown is minimal as commonBeforeEach handles most DB state
    beforeAll(async () => {
        try {
            const client = await pool.connect();
            console.log('Connected to test database for GET suite.');
            client.release();
        } catch (error) {
            console.error('Failed to connect to test database for GET suite:', error);
            throw new Error('Test database not accessible. Ensure docker-compose.test.yml is running.');
        }
    });

    afterAll(async () => {
        await endPool();
    });

    // Per-test setup: clear DB, create a fresh test user, and seed a dataset for GET tests
    beforeEach(async () => {
        testUserId = await commonBeforeEach();
        const client = await pool.connect();
        try {
            seededDatasetId = await seedTestDataset(client, testUserId, TEST_CSV_PATH, 'Seeded GET Dataset from test3.csv', 'For GET tests');
            seededDatasetId2 = await seedTestDataset(client, testUserId, TEST_CSV_PATH2, 'Seeded GET Dataset from appl_stock.csv', 'For GET tests');
        } finally {
            client.release();
        }
    });

    // --- List All Datasets Tests (get.js: ListAllDatasets) ---
    describe('GET /datasets', () => {
        test('should list all datasets for the authenticated user', async () => {
            const client = await pool.connect();
            try {
                await client.query('SELECT * FROM datasets WHERE dataset_id = $1 AND user_id = $2', [seededDatasetId, testUserId]);
                await client.query('SELECT * FROM datasets WHERE dataset_id = $1 AND user_id = $2', [seededDatasetId2, testUserId]);
            } finally {
                client.release();
            }

            const res = await request(app)
                .get(`${API_BASE_URL}/datasets`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Datasets retrieved successfully');
            expect(res.body.datasets).toHaveLength(2);
            expect(res.body.datasets.map(d => d.csv_name)).toEqual(expect.arrayContaining(['Seeded GET Dataset from test3.csv', 'Seeded GET Dataset from appl_stock.csv']));
            // Datasets are usually ordered by upload_date DESC
            expect(res.body.datasets[0].csv_name).toEqual('Seeded GET Dataset from appl_stock.csv');
            expect(res.body.datasets[1].csv_name).toEqual('Seeded GET Dataset from test3.csv');
        });

        test('should return empty array if no datasets for user', async () => {
            // Clear datasets for the test user to ensure no datasets
            const client = await pool.connect();
            try {
                await client.query('TRUNCATE TABLE datasets, columns, csv_data RESTART IDENTITY;');
            } finally {
                client.release();
            }

            const res = await request(app)
                .get(`${API_BASE_URL}/datasets`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Datasets retrieved successfully');
            expect(res.body.datasets).toEqual([]);
        });
    });

    // --- Get Specific Dataset Details (get.js: GetSpecificDataset) ---
    describe('GET /datasets/:datasetId', () => {
        test('should get test3 dataset details with columns', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Dataset details retrieved successfully');
            expect(res.body.dataset).toBeDefined();
            expect(res.body.dataset.dataset_id).toEqual(seededDatasetId);
            expect(res.body.dataset.csv_name).toEqual('Seeded GET Dataset from test3.csv');
            expect(res.body.dataset.columns).toHaveLength(6);
            expect(res.body.dataset.columns).toEqual([
                { column_id: 1, column_name: 'Name', column_order: 1, column_type: 'string' },
                { column_id: 2, column_name: 'Age', column_order: 2, column_type: 'integer' },
                { column_id: 3, column_name: 'City', column_order: 3, column_type: 'string' },
                { column_id: 4, column_name: 'Registered', column_order: 4, column_type: 'boolean' },
                { column_id: 5, column_name: 'StartDate', column_order: 5, column_type: 'date' },
                { column_id: 6, column_name: 'Amount', column_order: 6, column_type: 'float' },
            ]);
        });

        test('should get apple stock dataset details with columns', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId2}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Dataset details retrieved successfully');
            expect(res.body.dataset).toBeDefined();
            expect(res.body.dataset.dataset_id).toEqual(seededDatasetId2);
            expect(res.body.dataset.csv_name).toEqual('Seeded GET Dataset from appl_stock.csv');
            expect(res.body.dataset.columns).toHaveLength(7);
            expect(res.body.dataset.columns).toEqual([
                { column_id: 7, column_name: 'Date', column_order: 1, column_type: 'date' },
                { column_id: 8, column_name: 'Open', column_order: 2, column_type: 'float' },
                { column_id: 9, column_name: 'High', column_order: 3, column_type: 'float' },
                { column_id: 10, column_name: 'Low', column_order: 4, column_type: 'float' },
                { column_id: 11, column_name: 'Close', column_order: 5, column_type: 'float' },
                { column_id: 12, column_name: 'Volume', column_order: 6, column_type: 'integer' },
                { column_id: 13, column_name: 'Adj Close', column_order: 7, column_type: 'float' },
            ]);
        });

        test('should return 404 for non-existent dataset', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/99999`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual('Dataset not found.');
        });

        test('should return 403 if dataset does not belong to user', async () => {
            const client = await pool.connect();
            let otherUserId;
            try {
                const otherUserResult = await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['otheruser', 'other@example.com', 'hashedpassword2']);
                otherUserId = otherUserResult.rows[0].id;
                const otherDatasetId = await seedTestDataset(client, otherUserId, TEST_CSV_PATH, 'Seeded GET Dataset from test3.csv', 'For GET tests');

                const res = await request(app)
                    .get(`${API_BASE_URL}/datasets/${otherDatasetId}`);

                expect(res.statusCode).toEqual(403);
                expect(res.body.msg).toEqual('Access denied. This dataset does not belong to you.');
            } finally {
                client.release();
            }
        });
    });

    // --- Get Paginated/Sorted/Filtered Rows (get.js: GetSpecificDatasetRow) ---
    describe('GET /datasets/:datasetId/rows', () => {
        test('should get paginated rows with default sorting (row_number ASC)', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows?page=1&limit=3`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Dataset rows retrieved successfully');
            expect(res.body.data).toHaveLength(3);
            expect(res.body.data[0].row_data.Name).toEqual('Alice');
            expect(res.body.data[2].row_data.Name).toEqual('Charlie');
            expect(res.body.pagination.totalRows).toEqual(10);
            expect(res.body.pagination.currentPage).toEqual(1);
            expect(res.body.pagination.totalPages).toEqual(4);
        });

        test('should get sorted rows by "Amount" DESC', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows?sortBy=Amount&sortOrder=DESC`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data[0].row_data.Amount).toEqual(null);
            expect(res.body.data[1].row_data.Amount).toEqual('1000.00');
            expect(res.body.data[5].row_data.Amount).toEqual('200.00');
        });

        test('should get filtered rows by "name" contains "o"', async () => {
            const filters = JSON.stringify({ "Name": [{ "operator": 'contains', "value": 'o' }] });
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows?filters=${filters}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].row_data.Name).toEqual('Bob');
        });

        test('should get filtered rows by "open" > 500', async () => {
            const filters = JSON.stringify({ "Open": [{ "operator": '>', "value": 500 }] });
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId2}/rows?filters=${filters}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.pagination.totalRows).toEqual(401);
        });

        test('should return 400 for invalid sort direction', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows?sortBy=name&sortOrder=INVALID`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('Invalid sort direction: INVALID. Must be ASC or DESC.');
        });
    });

    // --- Get All Rows for Graph (get.js: GetSpecificDatasetAllRows) ---
    describe('GET /datasets/:datasetId/GraphData', () => {
        test('should get all rows for graph data without pagination', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/GraphData`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Dataset rows retrieved successfully');
            expect(res.body.data).toHaveLength(10);
            expect(res.body.totalRows).toEqual(10);
        });

        test('should get sorted and filtered rows for graph data', async () => {
            const filters = JSON.stringify({ "Open": [{ "operator": '>', "value": 500 }] });
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId2}/GraphData?sortBy=Open&sortOrder=DESC&filters=${filters}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveLength(401);
            expect(res.body.data[0].Open).toEqual('702.409988');
            expect(res.body.data[2].Open).toEqual('699.879997');
            expect(res.body.totalRows).toEqual(401);
        });
    });

    // --- Get Null Rows (get.js: GetSpecificDatasetNullRow) ---
    describe('GET /datasets/:datasetId/null-rows', () => {
        test('should get rows with any null or empty column', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/null-rows`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Null rows retrieved successfully');
            expect(res.body.data).toHaveLength(2);
            expect(res.body.count).toEqual(2);
            expect(res.body.data.map(r => r.row_number)).toEqual(expect.arrayContaining([5, 8]));
        });

        test('should get 0 rows with any null or empty column in apple stock', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId2}/null-rows`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Null rows retrieved successfully');
            expect(res.body.data).toHaveLength(0);
            expect(res.body.count).toEqual(0);
        });
    });

    // --- Get Single Row by Number (get.js: GetSingleRowByNumber) ---
    describe('GET /datasets/:datasetId/rows/:rowNumber', () => {
        test('should get a single row by its row number', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows/1`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toEqual('Row 1 retrieved successfully.');
            expect(res.body.row).toEqual({ Name: 'Alice', Age: '30', City: 'New York', Registered: 'true', StartDate: '2023-01-15', Amount: '123.45' });
        });

        test('should return 400 for invalid row number', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows/0`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('Invalid row number provided. Row number must be a positive integer.');
        });

        test('should return 404 for non-existent row number', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/${seededDatasetId}/rows/999`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual(`Row 999 not found in dataset ${seededDatasetId}.`);
        });

        test('should return 404 for non-existent dataset', async () => {
            const res = await request(app)
                .get(`${API_BASE_URL}/datasets/99999/rows/1`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.msg).toEqual('Dataset not found.');
        });

        test('should return 403 if dataset does not belong to user', async () => {
            const client = await pool.connect();
            let otherUserId;
            try {
                const otherUserResult = await client.query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id', ['otheruser', 'other@example.com', 'hashedpassword']);
                otherUserId = otherUserResult.rows[0].id;
                const otherDatasetId = await seedTestDataset(client, otherUserId, TEST_CSV_PATH, 'Seeded GET Dataset from test3.csv', 'For GET tests');

                const res = await request(app)
                    .get(`${API_BASE_URL}/datasets/${otherDatasetId}/rows/1`);

                expect(res.statusCode).toEqual(403);
                expect(res.body.msg).toEqual('Access denied. This dataset does not belong to you.');
            } finally {
                client.release();
            }
        });
    });
});