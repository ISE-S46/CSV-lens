import { parse, format, parseISO, isValid } from 'date-fns';

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

let value = "2025-06-06T09:15:00Z";
let currentInferredType = 'unknown';

function TestinferColumnType(value) {
    const stringValue = String(value || '').trim();

    if (stringValue === '') {
        return currentInferredType === 'unknown' ? 'string' : currentInferredType;
    }

    if (['true', 'false'].includes(stringValue.toLowerCase())) {
        if (currentInferredType === 'unknown' || currentInferredType === 'string' || currentInferredType === 'boolean') {
            return 'boolean';
        }
        return 'string';
    }

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

    function convertToStandardDateFormat(input) {
        for (const formatPattern of dateFormats) {
            const parsedDate = parse(stringValue, formatPattern, new Date());
            if (isValid(parsedDate)) {
                return format(parsedDate, 'yyyy-MM-dd');
            }
        }
        return input;
    }

    const parsedDate = parseISO(convertToStandardDateFormat(stringValue));
    if (isValid(parsedDate)) {
        if (stringValue.includes(':') || stringValue.includes('T') || stringValue.includes('Z') || stringValue.length >= 19) {
            return 'timestamp';
        } else {
            return 'date';
        }
    }

    return 'string';
}

const testDates = [
    '13/06/1999',
    '1999/13/06',
    '1999/06/13',
    '13-06-1999',
    '1999-13-06',
    '1999-06-13',
    '13:06:1999',
    '1999:13:06',
    '1999:06:13'
  ];
  
  testDates.forEach(dateStr => {
    console.log(dateStr, '=>', TestinferColumnType(dateStr)); // These should log as value variable type
  });