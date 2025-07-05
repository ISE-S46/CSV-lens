import { 
    getDatasetColumns,
    getPaginatedSortedFilteredRows,
} from '../../../Backend/Routes/controllers/subFunction/dataRetrieval.js';

const testUtils = await import('../testUtils.js');
const { pool, seedTestDataset, commonBeforeEach, endPool } = testUtils;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_CSV_PATH = path.join(__dirname, '../../DatabaseTest/test3.csv');

describe('Data Retrieval Functions', () => {
    let testUserId;
    let seededDatasetId;
    let client;

    // Use beforeAll/afterAll for the client connection in this test suite
    beforeAll(async () => {
        // Just ensure pool is reachable and mock is active
        try {
            const tempClient = await pool.connect();
            console.log('Connected to mocked DB for data retrieval tests.');
            tempClient.release();
        } catch (error) {
            console.error('Failed to connect to mocked DB for data retrieval tests:', error);
            throw error;
        }
    });

    // Per-test setup: clear DB, create a fresh test user, and seed a dataset
    beforeEach(async () => {
        testUserId = await commonBeforeEach(); // Clears DB, creates user, releases client
        client = await pool.connect(); // Get a new mocked client for the current test
        seededDatasetId = await seedTestDataset(client, testUserId, TEST_CSV_PATH, 'Test Retrieved Dataset', 'For data retrieval tests');
    });

    afterEach(() => {
        if (client) {
            client.release();
        }
    });

    // --- getDatasetColumns Tests ---
    describe('getDatasetColumns', () => {
        test('should retrieve columns for a dataset', async () => {
            // Columns are seeded by seedTestDataset based on test3.csv
            const columns = await getDatasetColumns(seededDatasetId);

            expect(columns).toEqual([
                { column_name: 'Name', column_type: 'string' },
                { column_name: 'Age', column_type: 'integer' },
                { column_name: 'City', column_type: 'string' },
                { column_name: 'Registered', column_type: 'boolean' },
                { column_name: 'StartDate', column_type: 'date' },
                { column_name: 'Amount', column_type: 'float' },
            ]);
        });

        test('should return empty array if no columns found for dataset', async () => {
            // Seed a dataset with no columns (or a new dataset that won't have columns seeded by testUtils)
            const clientTemp = await pool.connect();
            let newDatasetId;
            try {
                const datasetNoColsResult = await clientTemp.query(
                    'INSERT INTO datasets (user_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING dataset_id',
                    [testUserId, 'No Columns Dataset', 'empty.csv', 'Test no columns', 0, 0, 'completed']
                );
                newDatasetId = datasetNoColsResult.rows[0].dataset_id;
            } finally {
                clientTemp.release();
            }

            const columns = await getDatasetColumns(newDatasetId);
            expect(columns).toEqual([]);
        });
    });

    // --- getPaginatedSortedFilteredRows Tests ---
    describe('getPaginatedSortedFilteredRows', () => {
        test('should retrieve all data for a dataset with default pagination and no filters', async () => {
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, {});

            expect(result).toBeDefined();
            expect(result.data.length).toBe(10); // test3.csv has 10 rows
            expect(result.data[0].row_data).toEqual({ Name: 'Alice', Age: '30', City: 'New York', Registered: 'true', StartDate: '2023-01-15', Amount: '123.45' });
            expect(result.data[5].row_data).toEqual({ Name: 'Frank', Age: '40', City: 'London', Registered: 'false', StartDate: '2023-01-25', Amount: '1000.00' });
            expect(result.data[9].row_data).toEqual({ Name: 'Julia', Age: '38', City: 'Paris', Registered: 'false', StartDate: '2023-04-20', Amount: '400.00' });

            expect(result.pagination).toEqual({
                totalRows: 10,
                rowsPerPage: 50, // Default limit
                currentPage: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false
            });
        });

        test('should retrieve data with custom pagination (limit and page)', async () => {
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { page: 2, limit: 3 });

            expect(result.data.length).toBe(3);
            expect(result.data[0].row_data).toEqual({ Name: 'David', Age: '28', City: 'Berlin', Registered: 'false', StartDate: '2023-03-01', Amount: '75.00' });
            expect(result.pagination).toEqual({
                totalRows: 10,
                rowsPerPage: 3,
                currentPage: 2,
                totalPages: 4, // 10 rows / 3 per page = 3.33 -> 4 pages
                hasNextPage: true,
                hasPreviousPage: true
            });
        });

        test('should return empty data for out-of-bounds page number', async () => {
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { page: 10, limit: 10 });
            expect(result.data).toEqual([]);
            expect(result.pagination.totalRows).toBe(10);
            expect(result.pagination.totalPages).toBe(1);
            expect(result.pagination.currentPage).toBe(10);
        });

        test('should handle simple equality filter', async () => {
            const filters = { City: [{ operator: '=', value: 'London' }] };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { filters });

            expect(result.data.length).toBe(3);
            expect(result.data[0].row_data).toEqual({ Name: 'Bob', Age: '24', City: 'London', Registered: 'false', StartDate: '2023-02-20', Amount: '99.99' });
            expect(result.data[1].row_data).toEqual({ Name: 'Frank', Age: '40', City: 'London', Registered: 'false', StartDate: '2023-01-25', Amount: '1000.00' });
            expect(result.data[2].row_data).toEqual({ Name: 'Ian', Age: '26', City: 'London', Registered: 'true', StartDate: '2023-01-01', Amount: '200.00' });
            expect(result.pagination.totalRows).toBe(3);
        });

        test('should handle "contains" filter', async () => {
            const filters = { Name: [{ operator: 'contains', value: 'a' }] };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { filters });

            expect(result.data.length).toBe(7);
            expect(result.pagination.totalRows).toBe(7);
            // Verify specific rows (order depends on default sorting if no sortColumns provided)
            expect(result.data.map(d => d.row_data.Name)).toEqual(expect.arrayContaining(['Alice', 'Charlie', 'David', 'Frank', 'Grace', 'Ian', 'Julia']));
        });

        test('should handle numeric comparison filter (Age > 30)', async () => {
            const filters = { Age: [{ operator: '>', value: '30' }] };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { filters });

            expect(result.data.length).toBe(4);
            expect(result.pagination.totalRows).toBe(4);
            expect(result.data.map(d => parseInt(d.row_data.Age))).toEqual(expect.arrayContaining([35, 40, 32, 38]));
        });

        test('should handle date comparison filter (StartDate < 2024-03-01)', async () => {
            const filters = { StartDate: [{ operator: '>', value: '2024/03/01' }] };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { filters });

            expect(result.data.length).toBe(1);
            expect(result.pagination.totalRows).toBe(1);
            expect(result.data.map(d => d.row_data.Name)).toEqual(expect.arrayContaining(['Eve']));
        });

        test('should handle "isNull" filter (Amount is null/empty)', async () => {
            const filters = { Amount: [{ operator: 'isNull' }] };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { filters });

            expect(result.data.length).toBe(1); // Eve has empty amount
            expect(result.pagination.totalRows).toBe(1);
            expect(result.data[0].row_data.Name).toBe('Eve');
        });
        
        test('should handle "isNotNull" filter (Amount is not null/empty)', async () => {
            const filters = { Amount: [{ operator: 'isNotNull' }] };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, { filters });

            expect(result.data.length).toBe(9);
            expect(result.pagination.totalRows).toBe(9);
            expect(result.data.every(d => d.row_data.Name !== 'Eve')).toBe(true);
        });

        test('should handle sorting (ASC)', async () => {
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, {
                sortColumns: ['Age'],
                sortDirections: ['ASC']
            });

            expect(result.data.length).toBe(10);
            expect(result.data.map(d => d.row_data.Age)).toEqual([
                '22', '24', '26', '28', '29', '30', '32', '35', '38', '40'
            ]);
        });

        test('should handle sorting (DESC)', async () => {
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, {
                sortColumns: ['Age'],
                sortDirections: ['DESC']
            });

            expect(result.data.length).toBe(10);
            expect(result.data.map(d => d.row_data.Age)).toEqual([
                '40', '38', '35', '32', '30', '29', '28', '26', '24', '22'
            ]);
        });

        test('should handle multiple filters and sorting', async () => {
            const filters = {
                Age: [{ operator: '>=', value: '30k' }],
                Registered: [{ operator: '=', value: 'true' }]
            };
            const result = await getPaginatedSortedFilteredRows(seededDatasetId, testUserId, {
                filters,
                sortColumns: ['Age'],
                sortDirections: ['DESC']
            });

            expect(result.data.length).toBe(2);
            expect(result.pagination.totalRows).toBe(2);
            expect(result.data.map(d => d.row_data.Name)).toEqual(['Charlie', 'Alice']);
        });

        test('should throw error if dataset not found or access denied', async () => {
            await expect(getPaginatedSortedFilteredRows(99999, testUserId, {})).rejects.toThrow('Dataset not found');
            await expect(getPaginatedSortedFilteredRows(seededDatasetId, testUserId + 1, {})).rejects.toThrow('Access denied');
        });
    });

    afterAll(async () => {
        await endPool();
    });

});