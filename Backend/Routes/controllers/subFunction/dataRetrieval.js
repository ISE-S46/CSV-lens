import { pool } from '../../../main.js';

export async function getPaginatedSortedFilteredRows(
    datasetId,
    userId,
    { page = 1, limit = 50, sortBy, sortOrder = 'ASC', filters = {} }
) {
    const offset = (page - 1) * limit;

    let client;
    try {
        client = await pool.connect();

        // Verify dataset ownership and get total row count
        const datasetCheckResult = await client.query(
            'SELECT row_count, user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (datasetCheckResult.rows.length === 0) {
            throw new Error('Dataset not found.');
        }

        const { row_count: totalRows, user_id: datasetOwnerId } = datasetCheckResult.rows[0];

        if (datasetOwnerId !== userId) {
            throw new Error('Access denied. This dataset does not belong to you.');
        }

        // Fetch column types for dynamic query construction and validation
        const columnsResult = await client.query(
            'SELECT column_name, column_type FROM columns WHERE dataset_id = $1',
            [datasetId]
        );
        const columnTypes = new Map(columnsResult.rows.map(col => [col.column_name, col.column_type]));

        // console.log('Available columns and types:', Array.from(columnTypes.entries()));

        // Dynamic Query Construction for Filtering
        let filterConditions = [];
        let filterParams = [];
        // The first 3 parameters ($1, $2, $3) will be datasetId, limit, offset respectively.
        // So filter parameters start from $4.
        let paramCounter = 4;

        for (const [columnName, filterObj] of Object.entries(filters)) {
            const columnType = columnTypes.get(columnName);

            if (!columnType) {
                console.warn(`Filter applied to non-existent or invalid column: ${columnName}. Ignoring.`);
                continue;
            }

            const { operator, value } = filterObj;
            let condition = '';
            let pgCastType = ''; // PostgreSQL type for casting JSONB values

            // Determine PostgreSQL cast type based on column type
            if (['integer', 'float'].includes(columnType)) {
                pgCastType = 'numeric'; // Use numeric instead of float for better compatibility
            } else if (['date', 'timestamp'].includes(columnType)) {
                pgCastType = 'timestamp'; 
            } else if (columnType === 'boolean') {
                pgCastType = 'boolean';
            } else {
                pgCastType = 'text';
            }

            // Access value as text from JSONB
            const jsonbPath = `row_data->>'${columnName}'`;

            // console.log(`Processing filter for column: ${columnName}, type: ${columnType}, operator: ${operator}, value: ${value}`);

            switch (operator) {
                case '=':
                    if (['integer', 'float'].includes(columnType)) {
                        condition = `(${jsonbPath})::numeric = $${paramCounter++}::numeric`;
                        filterParams.push(parseFloat(value));
                    } else if (columnType === 'boolean') {
                        condition = `(${jsonbPath})::boolean = $${paramCounter++}::boolean`;
                        filterParams.push(value === 'true' || value === true);
                    } else {
                        condition = `${jsonbPath} = $${paramCounter++}`;
                        filterParams.push(value);
                    }
                    break;
                    
                case '!=':
                    if (['integer', 'float'].includes(columnType)) {
                        condition = `(${jsonbPath})::numeric != $${paramCounter++}::numeric`;
                        filterParams.push(parseFloat(value));
                    } else if (columnType === 'boolean') {
                        condition = `(${jsonbPath})::boolean != $${paramCounter++}::boolean`;
                        filterParams.push(value === 'true' || value === true);
                    } else {
                        condition = `${jsonbPath} != $${paramCounter++}`;
                        filterParams.push(value);
                    }
                    break;
                    
                case '>':
                case '<':
                case '>=':
                case '<=':
                    if (!['integer', 'float', 'date', 'timestamp'].includes(columnType)) {
                        throw new Error(`Operator '${operator}' not supported for column type '${columnType}' on column '${columnName}'.`);
                    }
                    
                    if (['integer', 'float'].includes(columnType)) {
                        condition = `(${jsonbPath})::numeric ${operator} $${paramCounter++}::numeric`;
                        filterParams.push(parseFloat(value));
                    } else if (['date', 'timestamp'].includes(columnType)) {
                        condition = `(${jsonbPath})::timestamp ${operator} $${paramCounter++}::timestamp`;
                        filterParams.push(value);
                    }
                    break;
                    
                case 'like': 
                    condition = `${jsonbPath} ILIKE $${paramCounter++}`;
                    filterParams.push(`%${value}%`);
                    break;
                    
                case 'isNull':
                    condition = `(${jsonbPath} IS NULL OR ${jsonbPath} = 'null' OR ${jsonbPath} = '')`;
                    break;
                    
                case 'isNotNull':
                    condition = `(${jsonbPath} IS NOT NULL AND ${jsonbPath} != 'null' AND ${jsonbPath} != '')`;
                    break;
                    
                default:
                    throw new Error(`Unsupported filter operator: ${operator}`);
            }
            
            if (condition) {
                filterConditions.push(condition);
            }
        }

        const whereClause = filterConditions.length > 0 ? ' AND ' + filterConditions.join(' AND ') : '';

        // Dynamic Query Construction for Sorting
        let orderByClause = '';
        if (sortBy) {
            const columnType = columnTypes.get(sortBy);

            if (!columnType) {
                 throw new Error(`Cannot sort by non-existent column: ${sortBy}`);
            }

            let pgSortCastType = '';
            if (['integer', 'float'].includes(columnType)) {
                pgSortCastType = 'numeric'; 
            } else if (['date', 'timestamp'].includes(columnType)) {
                pgSortCastType = 'timestamp'; 
            } else if (columnType === 'boolean') {
                pgSortCastType = 'boolean';
            } else {
                pgSortCastType = 'text'; // Default for strings
            }

            orderByClause = `ORDER BY (row_data->>'${sortBy}')::${pgSortCastType} ${sortOrder}`;
        } else {
            orderByClause = `ORDER BY row_number ASC`; // Default if no sortBy provided
        }

        // Fetch paginated rows with dynamic WHERE and ORDER BY clauses
        const query = `
            SELECT row_data
            FROM csv_data
            WHERE dataset_id = $1 ${whereClause}
            ${orderByClause}
            LIMIT $2 OFFSET $3
        `;

        // Parameters: datasetId, limit, offset, and then any filter parameters
        const queryParams = [datasetId, limit, offset, ...filterParams];

        const rowsResult = await client.query(query, queryParams);

        const rows = rowsResult.rows.map(row => row.row_data);

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalRows / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        return {
            data: rows,
            pagination: {
                totalRows: totalRows,
                rowsPerPage: limit,
                currentPage: page,
                totalPages: totalPages,
                hasNextPage: hasNextPage,
                hasPreviousPage: hasPreviousPage
            }
        };

    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        if (client) {
            client.release(); // Always release the client back to the pool
        }
    }
}