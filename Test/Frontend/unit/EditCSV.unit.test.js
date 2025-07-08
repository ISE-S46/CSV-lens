import { jest } from '@jest/globals';

const { convertValueForAPI, getTextWidth } = await import('../../../Frontend/Script/module/HandleCSV/EditCSV.js');

describe('EditCSV Unit Tests', () => {

    // --- convertValueForAPI Tests ---
    describe('convertValueForAPI', () => {
        // Test cases for values that should convert to null
        it('should convert "N/A", empty string, null, and undefined to null', () => {
            expect(convertValueForAPI('N/A', 'string')).toBeNull();
            expect(convertValueForAPI('n/a', 'string')).toBeNull();
            expect(convertValueForAPI('', 'string')).toBeNull();
            expect(convertValueForAPI(null, 'string')).toBeNull();
            expect(convertValueForAPI(undefined, 'string')).toBeNull();
        });

        // Test cases for 'integer' type
        describe('integer type', () => {
            it('should convert valid integer strings to integers', () => {
                expect(convertValueForAPI('123', 'integer')).toBe(123);
                expect(convertValueForAPI('0', 'integer')).toBe(0);
                expect(convertValueForAPI('-45', 'integer')).toBe(-45);
            });

            it('should convert non-numeric integer strings to null', () => {
                expect(convertValueForAPI('abc', 'integer')).toBeNull();
                expect(convertValueForAPI('12.3', 'integer')).toBe(12);
                expect(convertValueForAPI(' 123 ', 'integer')).toBe(123); // Trimmed by parseInt
            });
        });

        // Test cases for 'float' type
        describe('float type', () => {
            it('should convert valid float strings to floats', () => {
                expect(convertValueForAPI('123.45', 'float')).toBe(123.45);
                expect(convertValueForAPI('0.0', 'float')).toBe(0.0);
                expect(convertValueForAPI('999.00', 'float')).toBe(999.00);
                expect(convertValueForAPI('-0.5', 'float')).toBe(-0.5);
                expect(convertValueForAPI('10', 'float')).toBe(10.0); // Integer as float
            });

            it('should convert non-numeric float strings to null', () => {
                expect(convertValueForAPI('xyz', 'float')).toBeNull();
                expect(convertValueForAPI('3.14.15', 'float')).toBe(3.14);
                expect(convertValueForAPI(' inf ', 'float')).toBe(null); // parseFloat handles 'inf'
            });
        });

        // Test cases for 'boolean' type
        describe('boolean type', () => {
            it('should convert "true" (case-insensitive) to true', () => {
                expect(convertValueForAPI('true', 'boolean')).toBe(true);
                expect(convertValueForAPI('True', 'boolean')).toBe(true);
                expect(convertValueForAPI('TRUE', 'boolean')).toBe(true);
            });

            it('should convert any other string to false', () => {
                expect(convertValueForAPI('false', 'boolean')).toBe(false);
                expect(convertValueForAPI('0', 'boolean')).toBe(false);
                expect(convertValueForAPI('1', 'boolean')).toBe(false);
                expect(convertValueForAPI('anything', 'boolean')).toBe(false);
            });
        });

        // Test cases for 'date' type
        describe('date type', () => {
            it('should convert valid date strings to "YYYY-MM-DD" format', () => {
                expect(convertValueForAPI('2023-01-15', 'date')).toBe('2023-01-15');
                expect(convertValueForAPI('January 15, 2023', 'date')).toBe('2023-01-15');
                expect(convertValueForAPI('2023-2-5', 'date')).toBe('2023-02-05');
                expect(convertValueForAPI('2023-01-32', 'date')).toBe('2023-02-01');
                expect(convertValueForAPI('2023-13-01', 'date')).toBe('2024-01-01');
            });

            it('should return original value for invalid date strings', () => {
                expect(convertValueForAPI('not-a-date', 'date')).toBe('not-a-date');
            });
        });

        // Test cases for 'timestamp' type
        describe('timestamp type', () => {
            it('should convert valid timestamp strings to ISO format without milliseconds', () => {
                expect(convertValueForAPI('2023-01-15T10:30:00.123Z', 'timestamp')).toBe('2023-01-15T10:30:00Z');
                expect(convertValueForAPI('2023-01-15 10:30:00', 'timestamp')).toBe('2023-01-15T10:30:00Z');
                expect(convertValueForAPI('2023-13-15 10:30:00', 'timestamp')).toBe('2024-01-15T10:30:00Z');
            });

            it('should return original value for invalid timestamp strings', () => {
                expect(convertValueForAPI('invalid-timestamp', 'timestamp')).toBe('invalid-timestamp');
            });
        });

        // Test cases for 'default' (string) type
        describe('default (string) type', () => {
            it('should return the value as is for unknown types or string type', () => {
                expect(convertValueForAPI('hello world', 'string')).toBe('hello world');
                expect(convertValueForAPI('123', 'unknown')).toBe('123');
                expect(convertValueForAPI(' ', 'string')).toBe(' '); // Should not convert to null if not empty/N/A
            });
        });
    });

    // --- getTextWidth Tests ---
    describe('getTextWidth', () => {
        let mockContext;
        let mockCanvas;

        beforeEach(() => {
            // Mock HTMLCanvasElement.prototype.getContext
            mockContext = {
                measureText: jest.fn(() => ({ width: 100 })), // Default width
                font: '', // To capture font setting
            };
            mockCanvas = {
                getContext: jest.fn(() => mockContext),
            };

            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'canvas') {
                    return mockCanvas;
                }

                return document.createElement(tag);
            });

            // Mock getComputedStyle for font
            jest.spyOn(window, 'getComputedStyle').mockReturnValue({
                fontFamily: 'Arial',
                fontSize: '16px',
                font: '16px Arial', // Combined font property
            });
        });

        afterEach(() => {
            // Clean up the static canvas property to prevent leaks between tests
            if (getTextWidth.canvas) {
                delete getTextWidth.canvas;
            }
        });

        it('should measure text with provided font', () => {
            mockContext.measureText.mockReturnValue({ width: 50 });
            const font = 'bold 20px sans-serif';
            const width = getTextWidth('Hello', font);

            expect(mockContext.font).toBe(font);
            expect(mockContext.measureText).toHaveBeenCalledWith('Hello');
            expect(width).toBe(50);
        });

        it('should measure text with computed style font if no font is provided', () => {
            mockContext.measureText.mockReturnValue({ width: 75 });
            const expectedFont = '16px Arial'; // From mocked getComputedStyle

            const width = getTextWidth('World');

            expect(mockContext.font).toBe(expectedFont);
            expect(mockContext.measureText).toHaveBeenCalledWith('World');
            expect(width).toBe(75);
        });
    });
});