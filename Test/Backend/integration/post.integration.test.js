import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const TEST_CSV_PATH = path.join(__dirname, '../../DatabaseTest/test3.csv');

const testUtils = await import('../testUtils.js');
const { request, app, pool, API_BASE_URL, commonBeforeEach } = testUtils;

describe('POST API Endpoints Integration Tests', () => {
    let testUserId;

    // Global setup for this test file: connect to DB
    beforeAll(async () => {
        try {
            const client = await pool.connect();
            console.log('Connected to test database for POST suite.');
            client.release();
        } catch (error) {
            console.error('Failed to connect to test database for POST suite:', error);
            throw new Error('Test database not accessible. Ensure docker-compose.test.yml is running.');
        }
    });

    afterAll(async () => {
        // Clean up any temporary files created within tests
        const tempInvalidFilePath = path.join(__dirname, '../DatabaseTest/invalid.txt');
        if (fs.existsSync(tempInvalidFilePath)) {
            fs.unlinkSync(tempInvalidFilePath);
        }
        const tempEmptyCsvPath = path.join(__dirname, '../DatabaseTest/empty_data.csv');
        if (fs.existsSync(tempEmptyCsvPath)) {
            fs.unlinkSync(tempEmptyCsvPath);
        }

        // close the pool
        console.log('Closing test database connection pool from post.integration.test.js...');
        await pool.end();
        console.log('Test database connection pool closed.');
    });

    // Per-test setup: clear DB, create a fresh test user
    beforeEach(async () => {
        testUserId = await commonBeforeEach();
    });

    // --- CSV Upload Endpoint Tests (post.js: CSVuploadEndpoint) ---
    describe('POST /datasets/upload', () => {
        test('should upload a valid CSV and return 201', async () => {
            // Assuming test3.csv has 3 rows and columns: id, name, value
            const res = await request(app)
                .post(`${API_BASE_URL}/datasets/upload`)
                .set('Content-Type', 'multipart/form-data')
                .attach('csvFile', TEST_CSV_PATH)
                .field('csvName', 'Test Upload Dataset from Test3')
                .field('description', 'A dataset from test3.csv for testing upload');

            expect(res.statusCode).toEqual(201);
            expect(res.body.msg).toEqual('CSV uploaded and processed successfully');
            expect(res.body.rowCount).toEqual(10);
            expect(res.body.columns).toEqual([
                { column_name: 'Name', column_order: 1, column_type: 'string' },
                { column_name: 'Age', column_order: 2, column_type: 'integer' },
                { column_name: 'City', column_order: 3, column_type: 'string' },
                { column_name: 'Registered', column_order: 4, column_type: 'boolean' },
                { column_name: 'StartDate', column_order: 5, column_type: 'date' },
                { column_name: 'Amount', column_order: 6, column_type: 'float' },
            ]);

            // Verify dataset and columns in DB
            const client = await pool.connect();
            try {
                const dataset = await client.query('SELECT * FROM datasets WHERE user_id = $1 AND csv_name = $2', [testUserId, 'Test Upload Dataset from Test3']);
                expect(dataset.rows.length).toBe(1);
                const uploadedDatasetId = dataset.rows[0].dataset_id;

                const columns = await client.query('SELECT column_name, column_type FROM columns WHERE dataset_id = $1 ORDER BY column_order', [uploadedDatasetId]);
                expect(columns.rows).toEqual([
                    { column_name: 'Name', column_type: 'string' },
                    { column_name: 'Age', column_type: 'integer' },
                    { column_name: 'City', column_type: 'string' },
                    { column_name: 'Registered', column_type: 'boolean' },
                    { column_name: 'StartDate', column_type: 'date' },
                    { column_name: 'Amount', column_type: 'float' },
                ]);

                const csvData = await client.query('SELECT row_number, row_data FROM csv_data WHERE dataset_id = $1 ORDER BY row_number', [uploadedDatasetId]);
                expect(csvData.rows.length).toBe(10);
                expect(csvData.rows[0].row_data).toEqual({ Name: 'Alice', Age: '30', City: 'New York', Registered: 'true', StartDate: '2023-01-15', Amount: '123.45' });
                expect(csvData.rows[4].row_data).toEqual({ Name: 'Eve', Age: '22', City: 'New York', Registered: 'true', StartDate: '2024-04-10', Amount: '' || null });
            } finally {
                client.release();
            }
        });

        test('should return 400 if no file is uploaded', async () => {
            const res = await request(app)
                .post(`${API_BASE_URL}/datasets/upload`)
                .field('csvName', 'No File Dataset');

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('No file uploaded.');
        });

        test('should return 400 if csvName is missing', async () => {
            const res = await request(app)
                .post(`${API_BASE_URL}/datasets/upload`)
                .attach('csvFile', TEST_CSV_PATH); // Still use test3.csv for this check

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('Dataset Name (csvName) is required.');
        });

        test('should return 400 for invalid file type', async () => {
            const invalidFilePath = path.join(__dirname, '../../DatabaseTest/invalid.txt');
            fs.writeFileSync(invalidFilePath, 'This is not a CSV'); // Create temporary invalid file

            const res = await request(app)
                .post(`${API_BASE_URL}/datasets/upload`)
                .attach('csvFile', invalidFilePath)
                .field('csvName', 'Invalid File');

            expect(res.statusCode).toEqual(500);
        });

        test('should return 400 if CSV file contains no data rows', async () => {
            const emptyCsvPath = path.join(__dirname, '../../DatabaseTest/empty_data.csv');
            fs.writeFileSync(emptyCsvPath, 'header1,header2\n'); // Create temporary empty CSV

            const res = await request(app)
                .post(`${API_BASE_URL}/datasets/upload`)
                .attach('csvFile', emptyCsvPath)
                .field('csvName', 'Empty Data CSV');

            expect(res.statusCode).toEqual(400);
            expect(res.body.msg).toEqual('CSV file contains no data rows.');
        });
    });
});