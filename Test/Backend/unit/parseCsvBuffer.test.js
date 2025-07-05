import { parseCsvBuffer } from '../../../Backend/Routes/controllers/subFunction/HandleCSV.js';

describe('parseCsvBuffer', () => {

    // --- parseCsvBuffer Tests ---
    describe('parseCsvBuffer', () => {
        test('should correctly parse a simple CSV buffer', async () => {
            const csvString = 'col1,col2,col3\nval1a,val1b,val1c\nval2a,val2b,val2c';
            const csvBuffer = Buffer.from(csvString, 'utf8');

            const { headers, rows } = await parseCsvBuffer(csvBuffer);

            expect(headers).toEqual(['col1', 'col2', 'col3']);
            expect(rows).toEqual([
                { col1: 'val1a', col2: 'val1b', col3: 'val1c' },
                { col1: 'val2a', col2: 'val2b', col3: 'val2c' },
            ]);
        });

        test('should handle CSV with different delimiters', async () => {
            const csvString = 'col1;col2\nval1a;val1b';
            const csvBuffer = Buffer.from(csvString, 'utf8');

            // Default delimiter is comma, so this should still parse as one column if not specified
            const { headers, rows } = await parseCsvBuffer(csvBuffer);
            expect(headers).toEqual(['col1;col2']);
            expect(rows).toEqual([{ 'col1;col2': 'val1a;val1b' }]);
        });

        test('should handle empty CSV buffer', async () => {
            const csvBuffer = Buffer.from('', 'utf8');
            const { headers, rows } = await parseCsvBuffer(csvBuffer);
            expect(headers).toEqual([]);
            expect(rows).toEqual([]);
        });

        test('should handle CSV with only headers', async () => {
            const csvBuffer = Buffer.from('header1,header2\n', 'utf8');
            const { headers, rows } = await parseCsvBuffer(csvBuffer);
            expect(headers).toEqual(['header1', 'header2']);
            expect(rows).toEqual([]);
        });

        test('should handle CSV with quoted fields', async () => {
            const csvString = 'Name,"Description, with comma",Value\nAlice,"This is ""Alice""\'s entry",100';
            const csvBuffer = Buffer.from(csvString, 'utf8');
            const { headers, rows } = await parseCsvBuffer(csvBuffer);
            expect(headers).toEqual(['Name', 'Description, with comma', 'Value']);
            expect(rows).toEqual([
                { Name: 'Alice', 'Description, with comma': 'This is "Alice"\'s entry', Value: '100' },
            ]);
        });

        test('should correctly infer column types for a complex CSV', async () => {
            const csvString = `Name,Age,Registered,StartDate,Amount
                Alice,30,true,2023-01-15,123.45
                Bob,25,false,2022/11/01,
                Charlie,40,true,10-03-2021,500
                David,,false,2024-05-20,75.2
            `;
            const csvBuffer = Buffer.from(csvString, 'utf8');

            const { columnsMetadata } = await parseCsvBuffer(csvBuffer);

            expect(columnsMetadata).toEqual([
                expect.objectContaining({ column_name: 'Name', column_type: 'string' }),
                expect.objectContaining({ column_name: 'Age', column_type: 'integer' }),
                expect.objectContaining({ column_name: 'Registered', column_type: 'boolean' }),
                expect.objectContaining({ column_name: 'StartDate', column_type: 'date' }),
                expect.objectContaining({ column_name: 'Amount', column_type: 'float' }),
            ]);
        });

        test('should upgrade column type from integer to float if mixed', async () => {
            const csvString = `Value
        1
        2.5
        3`;
            const csvBuffer = Buffer.from(csvString, 'utf8');

            const { columnsMetadata } = await parseCsvBuffer(csvBuffer);

            expect(columnsMetadata).toEqual([
                expect.objectContaining({ column_name: 'Value', column_type: 'float' }),
            ]);
        });

        test('should resolve to string if mixed numerical and text data', async () => {
            const csvString = `MixedData
        123
        abc
        456.7`;
            const csvBuffer = Buffer.from(csvString, 'utf8');

            const { columnsMetadata } = await parseCsvBuffer(csvBuffer);

            expect(columnsMetadata).toEqual([
                expect.objectContaining({ column_name: 'MixedData', column_type: 'string' }),
            ]);
        });
    });

});