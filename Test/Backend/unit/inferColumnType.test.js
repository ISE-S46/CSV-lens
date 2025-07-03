import { inferColumnType } from "../../../Backend/Routes/controllers/subFunction/HandleCSV.js";

describe('inferColumnType', () => {
    // Test cases for string type
    test('should infer "string" for general text', () => {
        expect(inferColumnType('hello world')).toBe('string');
        expect(inferColumnType('123abc')).toBe('string');
        expect(inferColumnType(' ')).toBe('string'); // Empty string
    });

    // Test cases for boolean type
    test('should infer "boolean" for "true" and "false"', () => {
        expect(inferColumnType('true')).toBe('boolean');
        expect(inferColumnType('False')).toBe('boolean');
    });

    test('should not infer "boolean" for "0" or "1"', () => {
        expect(inferColumnType('0')).toBe('integer');
        expect(inferColumnType('1')).toBe('integer');
    });

    // Test cases for integer type
    test('should infer "integer" for whole numbers', () => {
        expect(inferColumnType('123')).toBe('integer');
        expect(inferColumnType('-45')).toBe('integer');
        expect(inferColumnType('0')).toBe('integer');
    });

    // Test cases for float type
    test('should infer "float" for decimal numbers', () => {
        expect(inferColumnType('123.45')).toBe('float');
        expect(inferColumnType('-0.5')).toBe('float');
        expect(inferColumnType('1.0')).toBe('float'); // Even if it's a whole number, if it has .0, it's float
    });

    // Test cases for date/timestamp type
    test('should infer "date" for valid date formats', () => {
        expect(inferColumnType('2023-01-01')).toBe('date');
        expect(inferColumnType('01/15/2023')).toBe('date');
        expect(inferColumnType('15-01-2023')).toBe('date');
    });

    test('should infer "timestamp" for valid timestamp formats', () => {
        expect(inferColumnType('2023-01-01T10:30:00Z')).toBe('timestamp');
        expect(inferColumnType('2023-01-01 10:30:00')).toBe('timestamp');
    });

    // Test cases for type refinement (currentInferredType)
    test('should upgrade integer to float', () => {
        expect(inferColumnType('1.5', 'integer')).toBe('float');
    });

    test('should default to string if type conflicts', () => {
        expect(inferColumnType('abc', 'integer')).toBe('string');
        expect(inferColumnType('2023-01-01', 'integer')).toBe('string');
    });

    test('should maintain type if current value is empty', () => {
        expect(inferColumnType('', 'integer')).toBe('integer');
        expect(inferColumnType(null, 'float')).toBe('float');
        expect(inferColumnType(undefined, 'boolean')).toBe('boolean');
    });
});