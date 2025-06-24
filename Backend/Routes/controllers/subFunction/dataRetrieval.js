import { pool } from '../../../main.js';

async function getDatasetColumns(datasetId) {
    let client;
    try {
        client = await pool.connect();
        const columnsResult = await client.query(
            'SELECT column_name, column_type FROM columns WHERE dataset_id = $1 ORDER BY column_order',
            [datasetId]
        );
        return columnsResult.rows.map(col => ({
            column_name: col.column_name,
            column_type: col.column_type
        }));
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function getPaginatedSortedFilteredRows(
    datasetId,
    userId,
    { page = 1, limit = 50, sortColumns = [], sortDirections = [], filters = {} }
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
        const datasetColumns = await getDatasetColumns(datasetId);
        const columnTypes = new Map(datasetColumns.map(col => [col.column_name, col.column_type]));

        // console.log('Available columns and types:', Array.from(columnTypes.entries()));

        // Dynamic Query Construction for Filtering
        let filterConditions = [];
        let filterValues = [];
        let currentParamIndex = 1;

        // Base parameters for the main query
        const baseQueryValues = [datasetId]; // $1
        currentParamIndex = baseQueryValues.length + 1; // Next available index after base values

        // --- NEW LOGIC FOR HANDLING 'OR' filters (specifically for null checks) ---
        if (filters._or_conditions && Array.isArray(filters._or_conditions)) {
            const orGroupConditions = [];
            for (const filterObj of filters._or_conditions) {
                const { columnName, operator, value } = filterObj;
                const columnType = columnTypes.get(columnName);

                if (!columnType) {
                    console.warn(`Filter applied to non-existent or invalid column: ${columnName}. Ignoring.`);
                    continue;
                }
                // Pass currentParamIndex to buildFilterCondition
                const { condition, param, usedParam } = buildFilterCondition(columnName, columnType, operator, value, currentParamIndex);
                if (condition) {
                    orGroupConditions.push(condition);
                    if (usedParam) {
                        filterValues.push(param);
                        currentParamIndex++; // Increment ONLY if a parameter was used
                    }
                }
            }
            if (orGroupConditions.length > 0) {
                filterConditions.push(`(${orGroupConditions.join(' OR ')})`);
            }
        }

        for (const [column, conditions] of Object.entries(filters)) {

            if (column === '_or_conditions') {
                continue;
            }            
            
            const columnType = columnTypes.get(column);

            if (!columnType) {
                console.warn(`Filter applied to non-existent or invalid column: ${column}. Ignoring.`);
                continue;
            }

            // Handle multiple conditions for the same column
            const columnConditions = [];
            for (const { operator, value } of conditions) {
                const { condition, param, usedParam } = buildFilterCondition(
                    column, columnType, operator, value, currentParamIndex
                );

                if (condition) {
                    columnConditions.push(condition);
                    if (usedParam) {
                        filterValues.push(param);
                        currentParamIndex++;
                    }
                }
            }

            if (columnConditions.length > 0) {
                filterConditions.push(`(${columnConditions.join(' AND ')})`);
            }
        }

        const whereClause = filterConditions.length > 0 ? ' AND ' + filterConditions.join(' AND ') : '';

        let orderByClause = '';
        if (sortColumns.length > 0) {
            const orderByParts = [];

            for (let i = 0; i < sortColumns.length; i++) {
                const column = sortColumns[i];
                const direction = sortDirections[i] || 'ASC'; // Default to ASC if not provided

                const columnType = columnTypes.get(column);
                if (!columnType) {
                    throw new Error(`Cannot sort by non-existent column: ${column}`);
                }

                let pgSortCastType = '';
                if (['integer', 'float'].includes(columnType)) {
                    pgSortCastType = 'numeric';
                } else if (['date', 'timestamp'].includes(columnType)) {
                    pgSortCastType = 'timestamp';
                } else if (columnType === 'boolean') {
                    pgSortCastType = 'boolean';
                } else {
                    pgSortCastType = 'text';
                }

                orderByParts.push(`(row_data->>'${column}')::${pgSortCastType} ${direction}`);
            }

            orderByClause = `ORDER BY ${orderByParts.join(', ')}`;
        } else {
            orderByClause = `ORDER BY row_number ASC`;
        }

        // Parameter positions in the final query string will be:
        // $1: datasetId
        // $2 to $(1 + filterValues.length): filter parameters

        const limitPlaceholder = `$${1 + filterValues.length + 1}`; // LIMIT value
        const offsetPlaceholder = `$${1 + filterValues.length + 2}`; // OFFSET value

        const query = `
            SELECT row_data
            FROM csv_data
            WHERE dataset_id = $1 ${whereClause}
            ${orderByClause}
            LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
        `;

        // Combine all parameters into one array for the query execution
        const finalQueryParams = [
            ...baseQueryValues,   // datasetId (for $1)
            ...filterValues,      // All filter values (for $2 onwards)
            limit,                // For LIMIT placeholder
            offset                // For OFFSET placeholder
        ];

        const rowsResult = await client.query(query, finalQueryParams);

        const rows = rowsResult.rows.map(row => row.row_data);

        // Getting the total count but without LIMIT and OFFSET and only the relevant parameters
        const countQuery = `
            SELECT COUNT(*)
            FROM csv_data
            WHERE dataset_id = $1 ${whereClause}
        `;
        // Parameters for count query are datasetId and filter parameters only
        const countQueryParams = [
            ...baseQueryValues,
            ...filterValues
        ];

        const countResult = await client.query(countQuery, countQueryParams);
        const totalRowsAfterFilter = parseInt(countResult.rows[0].count, 10);


        // Calculate pagination metadata
        const totalPages = Math.ceil(totalRowsAfterFilter / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        return {
            data: rows,
            pagination: {
                totalRows: totalRowsAfterFilter,
                rowsPerPage: limit,
                currentPage: page,
                totalPages: totalPages,
                hasNextPage: hasNextPage,
                hasPreviousPage: hasPreviousPage
            }
        };

    } catch (error) {
        console.error('Database query error in getPaginatedSortedFilteredRows:', error);
        throw error;
    } finally {
        if (client) {
            client.release(); // Always release the client back to the pool
        }
    }
}

function buildFilterCondition(columnName, columnType, operator, value, paramCounter) {
    const jsonbPath = `row_data->>'${columnName}'`;
    let condition = '';
    let param = null;
    let usedParam = false; // indicate if a parameter placeholder ($N) was used

    switch (operator) {
        case '=':
        case '!=':
            if (['date', 'timestamp'].includes(columnType)) {
                condition = `(${jsonbPath})::timestamp ${operator} to_date($${paramCounter}, 'DD/MM/YYYY')`;
                param = value;
            } else if (['integer', 'float'].includes(columnType)) {
                condition = `(${jsonbPath})::numeric ${operator} $${paramCounter}::numeric`;
                param = parseFloat(value);
            } else if (columnType === 'boolean') {
                condition = `(${jsonbPath})::boolean ${operator} $${paramCounter}::boolean`;
                param = value === 'true' || value === true;
            } else {
                condition = `${jsonbPath} ${operator} $${paramCounter}`;
                param = value;
            }
            usedParam = true;
            break;

        case '>':
        case '<':
        case '>=':
        case '<=':
            if (!['integer', 'float', 'date', 'timestamp'].includes(columnType)) {
                throw new Error(`Operator '${operator}' not supported for column type '${columnType}' on column '${columnName}'.`);
            }

            if (['integer', 'float'].includes(columnType)) {
                condition = `(${jsonbPath})::numeric ${operator} $${paramCounter}::numeric`;
                param = parseFloat(value);
            } else if (['date', 'timestamp'].includes(columnType)) {
                condition = `(${jsonbPath})::timestamp ${operator} to_date($${paramCounter}, 'DD/MM/YYYY')`;
                param = value;
            }
            usedParam = true;
            break;

        case 'contains':
            condition = `${jsonbPath} ILIKE $${paramCounter}`;
            param = `%${value}%`;
            usedParam = true;
            break;

        case 'starts':
            condition = `${jsonbPath} ILIKE $${paramCounter}`;
            param = `${value}%`;
            usedParam = true;
            break;

        case 'ends':
            condition = `${jsonbPath} ILIKE $${paramCounter}`;
            param = `%${value}`;
            usedParam = true;
            break;

        case 'isNull':
            condition = `(${jsonbPath} IS NULL OR ${jsonbPath} = 'null' OR ${jsonbPath} = '')`;
            param = null;
            usedParam = false; // No parameter placeholder is used in SQL
            break;

        case 'isNotNull':
            condition = `(${jsonbPath} IS NOT NULL AND ${jsonbPath} != 'null' AND ${jsonbPath} != '')`;
            param = null;
            usedParam = false; // No parameter placeholder is used in SQL
            break;

        default:
            throw new Error(`Unsupported filter operator: ${operator}`);
    }

    return { condition, param, usedParam };
}

export { getDatasetColumns, getPaginatedSortedFilteredRows };