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
    // Explicit null/empty handling
    if (value === null || value === undefined || value === '') {
        return currentInferredType === 'unknown' ? 'string' : currentInferredType;
    }

    // Convert to string and trim, but preserve 0/false
    const stringValue = String(value).trim();

    // Handle empty strings
    if (stringValue === '') {
        return currentInferredType === 'unknown' ? 'string' : currentInferredType;
    }

    // Special case: literal string "null"
    if (stringValue.toLowerCase() === 'null') {
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
    let headers = []; // Store header names

    return new Promise((resolve, reject) => {
        const readableStream = Readable.from(csvBuffer.toString()); // Assuming UTF-8 CSVs

        readableStream
            .pipe(csv({
                strict: false,
                skipEmptyLines: true,
                mapHeaders: ({ header, index }) => {
                    // Store header names in order
                    headers[index] = header;
                    return header;
                }
            }))
            .on('headers', (parsedHeaders) => {
                // Process headers and initialize metadata
                parsedHeaders.forEach((header, index) => {
                    // Initialize with 'unknown' or 'string' as a starting point for inference
                    columnsMetadata.set(header, {
                        column_name: header,
                        column_type: 'unknown',
                        column_order: index + 1
                    });
                });
            })
            .on('data', (data) => {
                rowCount++;
                
                // Convert empty strings to null and preserve headers
                const processedData = Object.fromEntries(
                    Object.entries(data).map(([key, val]) => 
                        [key, val === '' ? null : val]
                    )
                );
                
                rows.push(processedData);

                // Refine column types
                Object.entries(processedData).forEach(([key, value]) => {
                    if (!columnsMetadata.has(key)) {
                        columnsMetadata.set(key, {
                            column_name: key,
                            column_type: 'unknown',
                            column_order: columnsMetadata.size + 1
                        });
                    }
                    
                    const currentMeta = columnsMetadata.get(key);
                    const inferredType = inferColumnType(value, currentMeta.column_type);
                    
                    // Type conflict resolution
                    if (currentMeta.column_type === 'unknown') {
                        currentMeta.column_type = inferredType;
                    } else if (currentMeta.column_type === 'integer' && inferredType === 'float') {
                        currentMeta.column_type = 'float';
                    } else if (currentMeta.column_type !== inferredType) {
                        currentMeta.column_type = 'string';
                    }
                });
            })
            .on('end', () => {
                // Final type assignment
                columnsMetadata.forEach(meta => {
                    if (meta.column_type === 'unknown') {
                        meta.column_type = 'string';
                    }
                });
                
                resolve({ 
                    rows, 
                    columnsMetadata: Array.from(columnsMetadata.values()), 
                    rowCount 
                });
            })
            .on('error', reject);
    });
}

async function insertCsvDataBatch(client, datasetId, rows) {
    if (rows.length === 0) return;

    const batchSize = 500;
    let batchCount = 0;

    try {
        for (let i = 0; i < rows.length; i += batchSize) {
            batchCount++;
            const batch = rows.slice(i, i + batchSize);
            const valuePlaceholders = [];
            const params = [];
            let paramIndex = 1;

            batch.forEach((row, index) => {
                valuePlaceholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}::jsonb)`);
                params.push(datasetId, i + index + 1, row === null ? null : JSON.stringify(row));
            });

            const query = `
                INSERT INTO csv_data (dataset_id, row_number, row_data)
                VALUES ${valuePlaceholders.join(',')}
            `;

            await client.query(query, params);
            console.log(`Inserted batch ${batchCount} (rows ${i + 1}-${Math.min(i + batchSize, rows.length)})`);
        }
    } catch (err) {
        console.error(`Error in batch ${batchCount}:`, err);
        throw err;
    }
}

export { parseCsvBuffer, insertCsvDataBatch };