function buildFilterCondition(columnName, columnType, operator, value) {
    if (operator === 'isNull') {
        return {
            $or: [
                { [`row_data.${columnName}`]: null },
                { [`row_data.${columnName}`]: { $exists: false } },
                { [`row_data.${columnName}`]: "" }
            ]
        };
    }

    if (operator === 'isNotNull') {
        return {
            $and: [
                { [`row_data.${columnName}`]: { $ne: null } },
                { [`row_data.${columnName}`]: { $exists: true } },
                { [`row_data.${columnName}`]: { $ne: "" } }
            ]
        };
    }

    const keyPath = `row_data.${columnName}`;
    let condition = {};
    let parsedValue = value;

    if (['integer', 'float'].includes(columnType)) {
        parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
            throw new Error(`Invalid numeric value for column ${columnName}.`);
        }
    } else if (['date', 'timestamp'].includes(columnType)) {
        parsedValue = new Date(value);
        if (isNaN(parsedValue.getTime())) {
            throw new Error(`Invalid date/timestamp value for column ${columnName}.`);
        }
    } else if (columnType === 'boolean') {
        parsedValue = value === 'true' || value === true;
    }

    switch (operator) {
        // Direct comparisons
        case '=': condition[keyPath] = parsedValue; break;
        case '!=': condition[keyPath] = { $ne: parsedValue }; break;

        // Range comparisons (Numbers and Dates)
        case '>': condition[keyPath] = { $gt: parsedValue }; break;
        case '<': condition[keyPath] = { $lt: parsedValue }; break;
        case '>=': condition[keyPath] = { $gte: parsedValue }; break;
        case '<=': condition[keyPath] = { $lte: parsedValue }; break;

        // String operators (using regex for case-insensitive matching)
        case 'contains':
            condition[keyPath] = { $regex: new RegExp(value, 'i') }; // 'i' for case-insensitive
            break;
        case 'starts':
            condition[keyPath] = { $regex: new RegExp(`^${value}`, 'i') };
            break;
        case 'ends':
            condition[keyPath] = { $regex: new RegExp(`${value}$`, 'i') };
            break;

        default:
            throw new Error(`Unsupported filter operator: ${operator}`);
    }

    return condition;
}

function buildFilterClause(filters, columnTypes) {
    const andConditions = [];

    // Handle OR conditions first
    if (filters._or_conditions && Array.isArray(filters._or_conditions)) {
        const orGroupConditions = [];
        for (const filterObj of filters._or_conditions) {
            const { columnName, operator, value } = filterObj;
            const columnType = columnTypes.get(columnName);

            if (!columnType) continue;

            try {
                orGroupConditions.push(buildFilterCondition(columnName, columnType, operator, value));
            } catch (e) {
                console.warn(`Skipping invalid OR filter: ${e.message}`);
            }
        }
        if (orGroupConditions.length > 0) {
            andConditions.push({ $or: orGroupConditions });
        }
    }

    // Handle standard AND filters
    for (const [column, conditions] of Object.entries(filters)) {
        if (column === '_or_conditions') continue;

        const columnType = columnTypes.get(column);
        if (!columnType) continue;

        const columnConditions = [];
        for (const { operator, value } of conditions) {
            try {
                columnConditions.push(buildFilterCondition(column, columnType, operator, value));
            } catch (e) {
                console.warn(`Skipping invalid AND filter: ${e.message}`);
            }
        }

        if (columnConditions.length > 0) {
            andConditions.push({ $and: columnConditions });
        }
    }

    // Combine all AND conditions into a single MQL filter object
    return andConditions.length > 0 ? { $and: andConditions } : {};
}

function buildSortingOptions(sortColumns, sortDirections) {
    const sort = {};

    if (sortColumns.length === 0) {
        return { row_number: 1 };
    }

    for (let i = 0; i < sortColumns.length; i++) {
        const column = sortColumns[i];
        const direction = sortDirections[i].toUpperCase() === 'DESC' ? -1 : 1;

        sort[`row_data.${column}`] = direction;
    }

    return sort;
}

export { buildFilterClause, buildSortingOptions };