import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to modules to mock
const getCSVlistPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/getCSVlist.js');
const filterUIPath = path.join(__dirname, '../../../Frontend/Script/module/FilterUI.js');
const showMessagePath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const graphPath = path.join(__dirname, '../../../Frontend/Script/module/Graph.js');

// Mock all external dependencies
jest.unstable_mockModule(getCSVlistPath, () => ({
    __esModule: true,
    formatTimestamp: jest.fn(timestamp => `Formatted-${timestamp}`),
}));
jest.unstable_mockModule(filterUIPath, () => ({
    __esModule: true,
    populateColumnDropdowns: jest.fn(),
}));
jest.unstable_mockModule(showMessagePath, () => ({
    __esModule: true,
    showMessage: jest.fn(),
}));
jest.unstable_mockModule(graphPath, () => ({
    __esModule: true,
    initGraph: jest.fn(),
}));

// Import the module
const RenderCSVrowsModule = await import('../../../Frontend/Script/module/HandleCSV/RenderCSVrows.js');
const {
    renderDatasetMetadata,
    renderTable,
    renderNullTable,
    toggleNullRowsDisplay,
    updateColumnsInfo
} = RenderCSVrowsModule;

// Import specific mocked functions/objects for assertions
const { formatTimestamp } = await import(getCSVlistPath);
const { populateColumnDropdowns } = await import(filterUIPath);
const { showMessage } = await import(showMessagePath);
const { initGraph } = await import(graphPath);

describe('RenderCSVrows.js', () => {
    let mockElements = {};
    const originalGetElementById = document.getElementById;
    const originalCreateElement = document.createElement;
    let createElementSpy;

    // Helper to create mock DOM elements with common properties
    const createMockElement = (id) => {
        const element = {
            id: id,
            _textContent: '',
            _innerHTML: '',
            classList: {
                _classes: new Set(),
                add: jest.fn(className => element.classList._classes.add(className)),
                remove: jest.fn(className => element.classList._classes.delete(className)),
                contains: jest.fn(className => element.classList._classes.has(className)),
                get currentClasses() { return Array.from(element.classList._classes); }
            },
            dataset: {},
            children: [],
            appendChild: jest.fn(child => element.children.push(child)),
            get textContent() { return element._textContent; },
            set textContent(value) { element._textContent = value; },
            get innerHTML() { return element._innerHTML; },
            set innerHTML(value) { element._innerHTML = value; },
            // Add a mock for removeChild for elements that might clear children
            removeChild: jest.fn(child => {
                const index = element.children.indexOf(child);
                if (index > -1) {
                    element.children.splice(index, 1);
                }
            })
        };
        return element;
    };

    beforeAll(() => {
        jest.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (!mockElements[id]) {
                mockElements[id] = createMockElement(id);
            }
            return mockElements[id];
        });

        // Spy on document.createElement to capture created elements
        createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = createMockElement(`mock-${tagName}`);
            // Add a special property to identify these as dynamically created
            el.tagName = tagName.toUpperCase();
            el.style = {}; // Mock style for class toggling
            return el;
        });
    });

    beforeEach(() => {
        jest.clearAllMocks(); // Clears all jest.fn() mocks

        // Reset mock elements' state for each test
        mockElements = {
            'CSV-name': createMockElement('CSV-name'),
            'meta-name': createMockElement('meta-name'),
            'meta-description': createMockElement('meta-description'),
            'meta-rows': createMockElement('meta-rows'),
            'meta-date': createMockElement('meta-date'),
            'csv-page-modal': createMockElement('csv-page-modal'),
            'table-header-row': createMockElement('table-header-row'),
            'table-body': createMockElement('table-body'),
            'null-table-header-row': createMockElement('null-table-header-row'),
            'null-table-body': createMockElement('null-table-body'),
            'hide-null-rows-btn': createMockElement('hide-null-rows-btn'),
            'null-csv-table': createMockElement('null-csv-table'),
        };

        // Re-mock getElementById to ensure it points to the fresh mockElements
        document.getElementById.mockImplementation((id) => {
            return mockElements[id];
        });

        // Ensure initGraph and populateColumnDropdowns are cleared before each test
        populateColumnDropdowns.mockClear();
        initGraph.mockClear();
        showMessage.mockClear();
        formatTimestamp.mockClear();

        // Set initial visibility state for null rows table
        mockElements['null-csv-table'].classList._classes.add('hidden'); // hidden initially
        mockElements['hide-null-rows-btn']._textContent = 'Show Null Rows'; // text initially
    });

    afterAll(() => {
        document.getElementById = originalGetElementById; // Restore original
        document.createElement = originalCreateElement; // Restore original
        jest.restoreAllMocks(); // Restore all other mocks
    });

    const sampleColumns = [
        { column_name: 'ID', column_type: 'integer', column_order: 1 },
        { column_name: 'Name', column_type: 'text', column_order: 2 },
        { column_name: 'Date', column_type: 'date', column_order: 3 },
        { column_name: 'Active', column_type: 'boolean', column_order: 4 }, // Using 'boolean' string for type
        { column_name: 'Timestamp', column_type: 'timestamp', column_order: 5 }
    ];

    describe('renderDatasetMetadata', () => {
        const mockDataset = {
            csv_name: 'TestCSV',
            original_filename: 'original.csv',
            description: 'A test dataset.',
            row_count: 100,
            upload_date: '2023-01-01T12:00:00Z',
            columns: [
                { column_name: 'ColB', column_type: 'text', column_order: 2 },
                { column_name: 'ColA', column_type: 'integer', column_order: 1 },
            ]
        };

        it('should update metadata elements with dataset info', () => {
            renderDatasetMetadata(mockDataset);

            expect(mockElements['CSV-name'].textContent).toBe('TestCSV');
            expect(mockElements['meta-name'].textContent).toBe('original.csv');
            expect(mockElements['meta-description'].textContent).toBe('A test dataset.');
            expect(mockElements['meta-rows'].textContent).toBe(100);
            expect(formatTimestamp).toHaveBeenCalledWith('2023-01-01T12:00:00Z');
            expect(mockElements['meta-date'].textContent).toBe('Formatted-2023-01-01T12:00:00Z');
        });

        it('should set default description if none provided', () => {
            const datasetWithoutDescription = { ...mockDataset, description: null };
            renderDatasetMetadata(datasetWithoutDescription);
            expect(mockElements['meta-description'].textContent).toBe('No description provided.');
        });

        it('should populate column dropdowns and initialize graph with sorted columns', () => {
            renderDatasetMetadata(mockDataset);

            const expectedSortedColumns = [
                { column_name: 'ColA', column_type: 'integer', column_order: 1 },
                { column_name: 'ColB', column_type: 'text', column_order: 2 },
            ];

            expect(populateColumnDropdowns).toHaveBeenCalledWith(expectedSortedColumns);
            expect(initGraph).toHaveBeenCalledWith(expectedSortedColumns, 'TestCSV');
        });
    });

    describe('updateColumnsInfo', () => {
        it('should update columnsInfo and trigger dropdown and graph updates', () => {
            const newCols = [{ column_name: 'NewCol', column_type: 'text', column_order: 1 }];
            const csvName = 'UpdatedCSV';

            updateColumnsInfo(newCols, csvName);
            expect(populateColumnDropdowns).toHaveBeenCalledWith(newCols);
            expect(initGraph).toHaveBeenCalledWith(newCols, csvName);
        });
    });

    describe('renderTable', () => {
        const mockRows = [
            { row_number: 1, row_data: { ID: 1, Name: 'Alice', Date: '2023-01-01', Active: true, Timestamp: '2023-01-01T10:00:00Z' } },
            { row_number: 2, row_data: { ID: 2, Name: null, Date: '2023-01-02', Active: false, Timestamp: null } },
            { row_number: 3, row_data: { ID: 3, Name: 'Bob', Date: null, Active: '', Timestamp: '' } },
        ];

        // Simulate columnsInfo being set
        beforeEach(() => {
            renderDatasetMetadata({ ...({}), columns: sampleColumns, csv_name: 'test' });
            jest.clearAllMocks(); // Clear mocks called by renderDatasetMetadata setup
            // Re-mock createElementSpy specifically for renderTable assertions
            createElementSpy.mockClear();
        });

        it('should clear existing table content', () => {
            mockElements['table-header-row'].innerHTML = 'existing header';
            mockElements['table-body'].innerHTML = 'existing body';

            renderTable([]); // Render with empty rows to trigger clearing

            expect(mockElements['table-header-row'].innerHTML).toBe('');
            expect(mockElements['table-body'].innerHTML).toBe('');
        });

        it('should show message if no column information found', () => {
            // Temporarily clear columnsInfo for this test
            renderDatasetMetadata({ ...({}), columns: [], csv_name: 'test' }); // Simulate no columns
            jest.clearAllMocks(); // Clear setup mocks

            renderTable(mockRows);
            expect(showMessage).toHaveBeenCalledWith(mockElements['csv-page-modal'], 'No column information found for this dataset.');
            expect(createElementSpy).not.toHaveBeenCalled(); // No elements should be created
        });

        it('should show message if no data rows are available', () => {
            renderTable([]); // With sampleColumns set in beforeEach
            expect(showMessage).toHaveBeenCalledWith(mockElements['csv-page-modal'], 'No data available for this page with current filters/sorts.');
            expect(createElementSpy).not.toHaveBeenCalled(); // Still no rows/headers created if message triggered first
        });

        it('should render table headers correctly', () => {
            renderTable(mockRows);

            expect(createElementSpy).toHaveBeenCalledWith('th');
            expect(mockElements['table-header-row'].appendChild).toHaveBeenCalledTimes(sampleColumns.length);

            const createdHeaders = createElementSpy.mock.results.filter(r => r.value.tagName === 'TH').map(r => r.value);
            expect(createdHeaders.length).toBe(sampleColumns.length);

            expect(createdHeaders[0].textContent).toBe('ID');
            expect(createdHeaders[0].dataset.columnName).toBe('ID');
            expect(createdHeaders[0].dataset.columnType).toBe('integer');

            // Check the last header for rounded-tr-lg
            expect(createdHeaders[sampleColumns.length - 1].textContent).toBe('Timestamp');
            expect(createdHeaders[sampleColumns.length - 1].classList.add).toHaveBeenCalledWith('rounded-tr-lg');
        });

        // Test the `col.column_type === true` behavior
        it('should handle boolean column type if column_type is literally true', () => {
            const booleanColumn = { column_name: 'IsActive', column_type: true, column_order: 1 };
            const mockRowsForBoolean = [{ row_number: 1, row_data: { IsActive: 1 } }];
            const mockRowsForBooleanFalse = [{ row_number: 1, row_data: { IsActive: 0 } }];

            // Mock columnsInfo for this specific test
            renderDatasetMetadata({ ...({}), columns: [booleanColumn], csv_name: 'test' });
            jest.clearAllMocks();
            createElementSpy.mockClear();

            // Test true-ish value
            renderTable(mockRowsForBoolean);
            const createdRowTrue = createElementSpy.mock.results.filter(r => r.value.tagName === 'TR').map(r => r.value)[0];
            expect(createdRowTrue.children[0].textContent).toBe('True');

            // Test false-ish value
            jest.clearAllMocks(); // Clear for next renderTable call
            createElementSpy.mockClear();
            renderTable(mockRowsForBooleanFalse);
            const createdRowFalse = createElementSpy.mock.results.filter(r => r.value.tagName === 'TR').map(r => r.value)[0];
            expect(createdRowFalse.children[0].textContent).toBe('False');
        });
    });


    describe('renderNullTable', () => {
        const mockNullRows = [
            { row_number: 1, row_data: { ID: 1, Name: null, Date: '2023-01-01', Active: false } },
            { row_number: 5, row_data: { ID: 5, Name: 'Eve', Date: null, Active: '' } },
        ];

        beforeEach(() => {
            renderDatasetMetadata({ ...({}), columns: sampleColumns, csv_name: 'test' }); // Setup columnsInfo
            jest.clearAllMocks();
            createElementSpy.mockClear();
        });

        it('should clear existing null table content', () => {
            mockElements['null-table-header-row'].innerHTML = 'existing header';
            mockElements['null-table-body'].innerHTML = 'existing body';

            renderNullTable([]);
            expect(mockElements['null-table-header-row'].innerHTML).toBe('');
            expect(mockElements['null-table-body'].innerHTML).toBe('');
        });

        it('should show message if no column information found for null table', () => {
            renderDatasetMetadata({ ...({}), columns: [], csv_name: 'test' }); // Simulate no columns
            jest.clearAllMocks();

            renderNullTable(mockNullRows);
            expect(showMessage).toHaveBeenCalledWith(mockElements['csv-page-modal'], 'No column information found for null rows table.');
            expect(createElementSpy).not.toHaveBeenCalled();
        });

        it('should render null table headers correctly', () => {
            renderNullTable(mockNullRows);
            expect(createElementSpy).toHaveBeenCalledWith('th');
            expect(mockElements['null-table-header-row'].appendChild).toHaveBeenCalledTimes(sampleColumns.length);

            const createdHeaders = createElementSpy.mock.results.filter(r => r.value.tagName === 'TH').map(r => r.value);
            expect(createdHeaders[0].textContent).toBe('ID');
            expect(createdHeaders[sampleColumns.length - 1].classList.add).toHaveBeenCalledWith('rounded-tr-lg');
        });

        it('should render null table rows and highlight null/empty values', () => {
            renderNullTable(mockNullRows);

            expect(createElementSpy).toHaveBeenCalledWith('tr');
            expect(mockElements['null-table-body'].appendChild).toHaveBeenCalledTimes(mockNullRows.length);

            const createdRows = createElementSpy.mock.results.filter(r => r.value.tagName === 'TR').map(r => r.value);
            expect(createdRows.length).toBe(mockNullRows.length);

            // First null row
            const firstNullRow = createdRows[0];
            expect(firstNullRow.dataset.rowNumber).toBe(1);
            expect(firstNullRow.children[0].textContent).toBe(1); // ID
            expect(firstNullRow.children[1].textContent).toBe('NULL'); // Name is null -> highlighted
            expect(firstNullRow.children[2].textContent).toBe('2023-01-01'); // Date
            expect(firstNullRow.children[3].textContent).toBe(false); // Active

            // Second null row
            const secondNullRow = createdRows[1];
            expect(secondNullRow.dataset.rowNumber).toBe(5);
            expect(secondNullRow.children[0].textContent).toBe(5); // ID
            expect(secondNullRow.children[1].textContent).toBe('Eve'); // Name
            expect(secondNullRow.children[2].textContent).toBe('NULL'); // Date is null -> highlighted
            expect(secondNullRow.children[3].textContent).toBe('NULL'); // Active is empty string -> highlighted
        });

        it('should handle boolean column type if column_type is literally true in null table', () => {
            const booleanColumn = { column_name: 'IsActive', column_type: true, column_order: 1 };
            const mockRowsForBoolean = [{ row_number: 1, row_data: { IsActive: 1 } }];
            const mockRowsForBooleanFalse = [{ row_number: 1, row_data: { IsActive: 0 } }];
            const mockRowsForBooleanNull = [{ row_number: 1, row_data: { IsActive: null } }];

            // Mock columnsInfo for this specific test
            renderDatasetMetadata({ ...({}), columns: [booleanColumn], csv_name: 'test' });
            jest.clearAllMocks();
            createElementSpy.mockClear();

            // Test true-ish value
            renderNullTable(mockRowsForBoolean);
            const createdRowTrue = createElementSpy.mock.results.filter(r => r.value.tagName === 'TR').map(r => r.value)[0];
            expect(createdRowTrue.children[0].textContent).toBe('True');

            // Test false-ish value
            jest.clearAllMocks();
            createElementSpy.mockClear();
            renderNullTable(mockRowsForBooleanFalse);
            const createdRowFalse = createElementSpy.mock.results.filter(r => r.value.tagName === 'TR').map(r => r.value)[0];
            expect(createdRowFalse.children[0].textContent).toBe('False');

            // Test null value
            jest.clearAllMocks();
            createElementSpy.mockClear();
            renderNullTable(mockRowsForBooleanNull);
            const createdRowNull = createElementSpy.mock.results.filter(r => r.value.tagName === 'TR').map(r => r.value)[0];
            expect(createdRowNull.children[0].textContent).toBe('NULL'); // Should be NULL due to highlighting logic
        });
    });

    describe('toggleNullRowsDisplay', () => {
        it('should hide null rows table and change button text if currently visible', () => {
            // Set initial state: visible
            mockElements['null-csv-table'].classList.remove('hidden');
            mockElements['hide-null-rows-btn'].textContent = 'Hide Null Rows';

            toggleNullRowsDisplay();

            expect(mockElements['null-csv-table'].classList.add).toHaveBeenCalledWith('hidden');
            expect(mockElements['hide-null-rows-btn'].textContent).toBe('Show Null Rows');
        });

        it('should show null rows table and change button text if currently hidden', () => {
            // Set initial state: hidden (default from beforeEach)
            expect(mockElements['null-csv-table'].classList.contains('hidden')).toBe(true);
            mockElements['hide-null-rows-btn'].textContent = 'Show Null Rows';

            toggleNullRowsDisplay();

            expect(mockElements['null-csv-table'].classList.remove).toHaveBeenCalledWith('hidden');
            expect(mockElements['hide-null-rows-btn'].textContent).toBe('Hide Null Rows');
        });
    });
});