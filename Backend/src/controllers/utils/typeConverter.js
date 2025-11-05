import { parse, format, parseISO, isValid } from 'date-fns';

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

export const inferColumnType = (value, currentInferredType = 'unknown') => {
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

export const convertValueToType = (value, columnType) => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return null;
    }

    const trimmedValue = String(value).trim();
    const type = columnType.toLowerCase();

    switch (type) {
        case 'integer':
            const intValue = parseInt(trimmedValue, 10);
            return isNaN(intValue) ? null : intValue;
        
        case 'float':
        case 'numeric':
            const floatValue = parseFloat(trimmedValue);
            return isNaN(floatValue) ? null : floatValue;

        case 'boolean':
            if (['true', 't', '1', 'yes', 'y'].includes(trimmedValue.toLowerCase())) return true;
            if (['false', 'f', '0', 'no', 'n'].includes(trimmedValue.toLowerCase())) return false;
            return null; // Value is not a valid boolean representation

        case 'date':
        case 'timestamp':
            const dateValue = new Date(trimmedValue);
            return isNaN(dateValue.getTime()) ? null : dateValue;
        
        case 'string':
        case 'text':
        case 'varchar':
        default:
            return trimmedValue;
    }
};