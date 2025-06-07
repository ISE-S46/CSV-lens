import { parse, format, parseISO, isValid } from 'date-fns';
import csv from 'csv-parser';
import { Readable } from 'stream'; // Converting buffers to readable streams

const dateFormats = [
    'dd/MM/yyyy',
    'yyyy/MM/dd',
    'yyyy/dd/MM',
    'dd-MM-yyyy',
    'yyyy-dd-MM',
    'dd:MM:yyyy',
    'yyyy:MM:dd',
    'yyyy:dd:MM'
];

const inferColumnType = (value, currentInferredType = 'unknown') => {
    // Handle Null/Empty values first
    const stringValue = String(value || '').trim(); // Ensure string and handle null/undefined safely

    if (stringValue === '') {
        return currentInferredType === 'unknown' ? 'string' : currentInferredType;
    }

    // Infer Boolean (case-insensitive)
    if (['true', 'false'].includes(stringValue.toLowerCase())) {
        if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === 'boolean') {
            return 'boolean';
        }
        return 'string';
    }

    // Infer Number (integer or float)
    if (!isNaN(stringValue) && !isNaN(parseFloat(stringValue))) {
        const num = parseFloat(stringValue);
        if (Number.isInteger(num)) {
            if (currentInferredType === 'float') return 'float';
            if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === 'integer') return 'integer';
            return 'string';
        } else {
            if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === 'integer' || currentInferredType === 'float') return 'float';
            return 'string';
        }
    }

    // Conbert date to yyyy-mm-dd format
    function convertToStandardDateFormat(input) {
        for (const formatPattern of dateFormats) {
            const parsedDate = parse(stringValue, formatPattern, new Date());
            if (isValid(parsedDate)) {
                return format(parsedDate, 'yyyy-MM-dd');
            }
        }
        return input;
    }

    // Infer date
    const parsedDate = parseISO(convertToStandardDateFormat(stringValue));
    if (isValid(parsedDate)) {
        if (stringValue.includes(':') || stringValue.includes('T') || stringValue.includes('Z') || stringValue.length >= 19) {
            return 'timestamp';
        } else {
            return 'date';
        }
    }

    return 'string';
};

async function parseCsvBuffer(csvBuffer) {
    let rows = [];
    // Use a Map to maintain insertion order of columns and for easier lookup
    let columnsMetadata = new Map();
    let rowCount = 0;
    let headersProcessed = false; // Flag to ensure headers are processed once

    return new Promise((resolve, reject) => {
        const readableStream = Readable.from(csvBuffer.toString()); // Assuming UTF-8 CSVs

        readableStream
            .pipe(csv())
            .on('headers', (headers) => {
                if (headersProcessed) return; // Prevent reprocessing headers if stream somehow emits again

                headers.forEach((header, index) => {
                    // Initialize with 'unknown' or 'string' as a starting point for inference
                    columnsMetadata.set(header, {
                        column_name: header,
                        column_type: 'unknown',
                        column_order: index + 1
                    });
                });
                headersProcessed = true;
            })
            .on('data', (data) => {
                rowCount++;
                rows.push(data);

                // Refine column types based on the data encountered
                Object.keys(data).forEach(key => {
                    if (!columnsMetadata.has(key)) {
                        // This case handles CSVs where header row might be missing or inconsistent, or if a column appears mid-way
                        columnsMetadata.set(key, {
                            column_name: key,
                            column_type: 'unknown',
                            column_order: columnsMetadata.size + 1
                        });
                    }
                    const currentMeta = columnsMetadata.get(key);
                    const inferredType = inferColumnType(data[key], currentMeta.column_type);

                    // Logic to handle type conflicts:
                    if (currentMeta.column_type === 'unknown') {
                        currentMeta.column_type = inferredType;
                    } else if (currentMeta.column_type === 'integer' && inferredType === 'float') {
                        currentMeta.column_type = 'float'; // Upgrade integer to float
                    } else if (currentMeta.column_type !== inferredType && inferredType !== 'unknown') {
                        currentMeta.column_type = 'string';
                    }

                    // Update the map with the potentially refined metadata
                    columnsMetadata.set(key, currentMeta);
                });
            })
            .on('end', () => {
                // After all data is processed, make a final pass to default 'unknown' types to 'string'
                columnsMetadata.forEach((meta, key) => {
                    if (meta.column_type === 'unknown') {
                        meta.column_type = 'string';
                    }
                });
                resolve({ rows, columnsMetadata: Array.from(columnsMetadata.values()), rowCount });
            })
            .on('error', (err) => {
                console.error('CSV Parsing Error:', err.message);
                reject(new Error('Failed to parse CSV file: ' + err.message));
            });
    });
}

async function insertCsvDataBatch(client, datasetId, rows) {
    if (rows.length === 0) {
        return;
    }

    const valuePlaceholders = [];
    const params = [];
    let paramIndex = 1;

    rows.forEach((row, index) => {
        valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}::jsonb)`);
        params.push(datasetId, index + 1, JSON.stringify(row));
    });

    const query = `
        INSERT INTO csv_data (dataset_id, row_number, row_data)
        VALUES ${valuePlaceholders.join(',')}
    `;

    await client.query(query, params);
}

export { parseCsvBuffer, insertCsvDataBatch }