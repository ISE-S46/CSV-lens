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

function buildFilterClause(filters, columnTypes, baseParamIndex = 1) {
    let filterConditions = [];
    let filterValues = [];
    let currentParamIndex = baseParamIndex;

    // Handle OR conditions
    if (filters._or_conditions && Array.isArray(filters._or_conditions)) {
        const orGroupConditions = [];
        for (const filterObj of filters._or_conditions) {
            const { columnName, operator, value } = filterObj;
            const columnType = columnTypes.get(columnName);

            if (!columnType) {
                console.warn(`OR filter ignored - invalid column: ${columnName}`);
                continue;
            }

            const { condition, param, usedParam } = buildFilterCondition(
                columnName, columnType, operator, value, currentParamIndex
            );

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

    // Handle standard filters
    for (const [column, conditions] of Object.entries(filters)) {
        if (column === '_or_conditions') continue;

        const columnType = columnTypes.get(column);
        if (!columnType) {
            console.warn(`Filter ignored - invalid column: ${column}`);
            continue;
        }

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

    const whereClause = filterConditions.length > 0
        ? `AND ${filterConditions.join(' AND ')}`
        : '';

    return { whereClause, filterValues, nextParamIndex: currentParamIndex };
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

function buildPaginationSorting(sortColumns, sortDirections, columnTypes, paramIndex) {
    // Build ORDER BY clause
    let orderByClause = '';
    if (sortColumns.length > 0) {
        const orderByParts = [];
        for (let i = 0; i < sortColumns.length; i++) {
            const column = sortColumns[i];
            const direction = sortDirections[i] || 'ASC';
            const columnType = columnTypes.get(column);

            if (!columnType) {
                throw new Error(`Cannot sort by non-existent column: ${column}`);
            }

            let pgSortCastType = 'text';
            if (['integer', 'float'].includes(columnType)) pgSortCastType = 'numeric';
            else if (['date', 'timestamp'].includes(columnType)) pgSortCastType = 'timestamp';
            else if (columnType === 'boolean') pgSortCastType = 'boolean';

            orderByParts.push(`(row_data->>'${column}')::${pgSortCastType} ${direction}`);
        }
        orderByClause = `ORDER BY ${orderByParts.join(', ')}`;
    } else {
        orderByClause = 'ORDER BY row_number ASC';
    }

    // Build pagination placeholders
    const limitPlaceholder = `$${paramIndex}`;
    const offsetPlaceholder = `$${paramIndex + 1}`;
    const paginationClause = `LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

    return { orderByClause, paginationClause };
}

// Main function using both helpers
async function getPaginatedSortedFilteredRows(
    datasetId,
    userId,
    { page = 1, limit = 50, sortColumns = [], sortDirections = [], filters = {} }
) {
    const offset = (page - 1) * limit;
    let client;

    try {
        client = await pool.connect();

        // Dataset validation and ownership check
        const { rows } = await client.query(
            'SELECT row_count, user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (rows.length === 0) throw new Error('Dataset not found');
        if (rows[0].user_id !== userId) throw new Error('Access denied');

        const datasetColumns = await getDatasetColumns(datasetId);
        const columnTypes = new Map(datasetColumns.map(col => [col.column_name, col.column_type]));

        // Build filter components
        const { whereClause, filterValues, nextParamIndex } = buildFilterClause(
            filters,
            columnTypes,
            2 // Start at $2 (since $1 is datasetId)
        );

        // Build pagination/sorting components
        const { orderByClause, paginationClause } = buildPaginationSorting(
            sortColumns,
            sortDirections,
            columnTypes,
            nextParamIndex
        );

        // Construct main query
        const query = `
            SELECT row_data
            FROM csv_data
            WHERE dataset_id = $1 ${whereClause}
            ${orderByClause}
            ${paginationClause}
        `;

        // Execute query with combined parameters
        const finalQueryParams = [
            datasetId,          // datasetId (for $1)
            ...filterValues,    // All filter values (for $2 onwards)
            limit,
            offset
        ];

        const rowsResult = await client.query(query, finalQueryParams);
        const data = rowsResult.rows.map(row => row.row_data);

        // Get filtered count
        const countResult = await client.query(
            `SELECT COUNT(*) FROM csv_data WHERE dataset_id = $1 ${whereClause}`,
            [datasetId, ...filterValues]
        );

        const totalFiltered = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalFiltered / limit);

        return {
            data,
            pagination: {
                totalRows: totalFiltered,
                rowsPerPage: limit,
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
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

async function getSortFilteredRowsForGraph(
    datasetId,
    userId,
    { sortColumns = [], sortDirections = [], filters = {} }
) {
    let client;

    try {
        client = await pool.connect();

        // Dataset validation and ownership check
        const { rows } = await client.query(
            'SELECT row_count, user_id FROM datasets WHERE dataset_id = $1',
            [datasetId]
        );

        if (rows.length === 0) throw new Error('Dataset not found');
        if (rows[0].user_id !== userId) throw new Error('Access denied');

        const datasetColumns = await getDatasetColumns(datasetId);
        const columnTypes = new Map(datasetColumns.map(col => [col.column_name, col.column_type]));

        // Build filter components
        const { whereClause, filterValues } = buildFilterClause(
            filters,
            columnTypes,
            2 // Start at $2 (since $1 is datasetId)
        );

        const { orderByClause } = buildPaginationSorting(
            sortColumns,
            sortDirections,
            columnTypes
        );

        // Construct main query
        const query = `
            SELECT row_data
            FROM csv_data
            WHERE dataset_id = $1 ${whereClause}
            ${orderByClause}
        `;

        // Execute query with combined parameters
        const finalQueryParams = [
            datasetId,          // datasetId (for $1)
            ...filterValues,   // All filter values (for $2 onwards)
        ];

        const rowsResult = await client.query(query, finalQueryParams);
        const data = rowsResult.rows.map(row => row.row_data);

        // Get filtered count
        const countResult = await client.query(
            `SELECT COUNT(*) FROM csv_data WHERE dataset_id = $1 ${whereClause}`,
            [datasetId, ...filterValues]
        );

        const totalFiltered = parseInt(countResult.rows[0].count, 10);

        return {
            data,
            totalRows: totalFiltered
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

export { getDatasetColumns, getPaginatedSortedFilteredRows, getSortFilteredRowsForGraph };