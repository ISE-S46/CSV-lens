import csv from 'csv-parser';
import { Readable } from 'stream'; // Converting buffers to readable streams
import { inferColumnType } from './typeConverter.js';

async function parseCsvBuffer(csvBuffer) {
    let rawRows = [];

    let columnsMetadata = new Map();
    let rowCount = 0;
    let headers = []; // Store header names

    return new Promise((resolve, reject) => {
        const readableStream = Readable.from(csvBuffer.toString());

        readableStream
            .pipe(csv({
                strict: false,
                skipEmptyLines: true,
                mapHeaders: ({ header, index }) => {
                    headers[index] = header;
                    return header;
                }
            }))
            .on('headers', (parsedHeaders) => {
                parsedHeaders.forEach((header, index) => {
                    columnsMetadata.set(header, {
                        column_name: header,
                        column_type: 'unknown',
                        column_order: index + 1
                    });
                });
            })
            .on('data', (data) => {
                rowCount++;

                const processedData = Object.fromEntries(
                    Object.entries(data).map(([key, val]) =>
                        [key, val === '' ? null : val]
                    )
                );

                rawRows.push(processedData);

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
                const finalColumnsMetadata = Array.from(columnsMetadata.values());

                finalColumnsMetadata.forEach(meta => {
                    if (meta.column_type === 'unknown') meta.column_type = 'string';
                });

                resolve({
                    rows: rawRows,
                    columnsMetadata: finalColumnsMetadata,
                    rowCount,
                    headers
                });
            })
            .on('error', reject);
    });
}

export { parseCsvBuffer };