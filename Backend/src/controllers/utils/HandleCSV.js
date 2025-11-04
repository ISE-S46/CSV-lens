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
    'yyyy:dd:MM',
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'yyyy.MM.dd',
    'dd.MM.yyyy',
    'yyyyMMdd',
    'yyyy MM dd',
    'MMMM dd, yyyy',
    'dd-MMM-yyyy',
    'EEE MMM dd yyyy',
    'yyyy年MM月dd日'
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
    const isNumeric = !isNaN(stringValue) && !isNaN(parseFloat(stringValue));
    if (isNumeric) {
        const num = parseFloat(stringValue);

        // Check if the string explicitly contains a decimal point OR if the parsed number is not an integer
        if (stringValue.includes('.') || !Number.isInteger(num)) {
            if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === 'integer' || currentInferredType === 'float') {
                return 'float';
            }
            return 'string';
        } else {
            if (currentInferredType === 'float') return 'float'; // Allow upgrading to float
            if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === 'integer') return 'integer';
            return 'string';
        }
    }

    let inferredDateType = null;

    // Convert date to yyyy-mm-dd format
    function convertToStandardDateFormat(input) {
        for (const formatPattern of dateFormats) {
            const parsedDate = parse(input, formatPattern, new Date());
            if (isValid(parsedDate)) {
                return format(parsedDate, 'yyyy-MM-dd');
            }
        }
        return input;
    }

    // Infer date
    const standardDateString = convertToStandardDateFormat(stringValue);
    const parsedDate = parseISO(standardDateString);

    if (isValid(parsedDate)) {
        if (stringValue.includes(':') || stringValue.includes('T') || stringValue.includes('Z') || stringValue.length >= 19) {
            inferredDateType = 'timestamp';
        } else {
            inferredDateType = 'date';
        }
    }

    if (inferredDateType) {
        if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === inferredDateType) {
            return inferredDateType;
        }
        return 'string';
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
                    rowCount,
                    headers
                });
            })
            .on('error', reject);
    });
}

export { inferColumnType, parseCsvBuffer };