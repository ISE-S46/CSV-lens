import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MiddlewarePath = path.join(__dirname, '../../Backend/Middleware/authMiddleware.js');

jest.unstable_mockModule(MiddlewarePath, () => ({
    Middleware: jest.fn((req, res, next) => {
        req.user = { id: 1, username: 'testuser', email: 'test@example.com' };
        next();
    }),
}));

// Now dynamically import the mocked modules
const { Middleware } = await import('../../Backend/Middleware/authMiddleware.js');
const { app, pool } = await import('../../Backend/main.js');

import request from 'supertest';
import { parseCsvBuffer, insertCsvDataBatch } from '../../Backend/Routes/controllers/subFunction/HandleCSV.js';

const API_BASE_URL = process.env.API_BASE_URL;

const seedTestDataset = async (client, userId, csvFilePath, name = 'test.csv', description = 'A dataset for testing') => {
    const csvBuffer = fs.readFileSync(csvFilePath);
    const originalFilename = path.basename(csvFilePath);
    const { columnsMetadata, rows } = await parseCsvBuffer(csvBuffer);

    const columnsToInsert = columnsMetadata.map(col => ({
        column_name: col.column_name,
        column_type: col.column_type,
        column_order: col.column_order,
    }));

    const fileSizeBytes = csvBuffer.byteLength;
    const rowCount = rows.length;

    const datasetResult = await client.query(
        'INSERT INTO datasets (user_id, csv_name, original_filename, description, file_size_bytes, row_count, upload_date, status) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING dataset_id',
        [userId, name, originalFilename, description, fileSizeBytes, rowCount, 'completed']
    );
    const datasetId = datasetResult.rows[0].dataset_id;

    if (columnsToInsert.length > 0) {
        const columnValues = columnsToInsert.map(col => `($${col.column_order * 4 - 3}, $${col.column_order * 4 - 2}, $${col.column_order * 4 - 1}, $${col.column_order * 4})`).join(', ');
        const columnParams = columnsToInsert.flatMap(col => [datasetId, col.column_name, col.column_type, col.column_order]);

        await client.query(
            `INSERT INTO columns (dataset_id, column_name, column_type, column_order) VALUES ${columnValues}`,
            columnParams
        );
    }

    await insertCsvDataBatch(client, datasetId, rows);

    return datasetId;
};

const commonBeforeEach = async () => {
    const client = await pool.connect();
    let testUserId;
    try {
        await client.query('BEGIN');

        await client.query('TRUNCATE TABLE users, datasets, columns, csv_data RESTART IDENTITY;');

        const userResult = await client.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
            ['testuser', 'test@example.com', 'hashedpassword']
        );
        testUserId = userResult.rows[0].id;

        Middleware.mockImplementation((req, res, next) => {
            req.user = { id: testUserId, username: 'testuser', email: 'test@example.com' };
            next();
        });

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during commonBeforeEach cleanup/seeding:', error);
        throw error;
    } finally {
        client.release();
    }
    return testUserId;
};

const endPool = async () => {
    console.log('Ending test database connection pool...');
    await pool.end();
    console.log('Test database connection pool ended.');
};

export {
    request,
    app,
    pool,
    API_BASE_URL,
    seedTestDataset,
    commonBeforeEach,
    endPool
};