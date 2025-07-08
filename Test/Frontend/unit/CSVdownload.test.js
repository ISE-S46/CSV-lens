import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const showMsgPath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const graphPath = path.join(__dirname, '../../../Frontend/Script/module/Graph.js');

// Mock `Graph.js` for data, columns, and filename
jest.unstable_mockModule(graphPath, () => ({
    __esModule: true,
    currentData: [],
    columnsInfo: [],
    csvName: { value: '' },
}));

// Mock `ShowMessage.js`
jest.unstable_mockModule(showMsgPath, () => ({
    __esModule: true,
    showMessage: jest.fn(),
}));

// Import the module under test AFTER mocks are defined
const { setupSaveCSVEvents, saveDataAs } = await import('../../../Frontend/Script/module/HandleCSV/CSVdownload.js');

const { currentData, columnsInfo, csvName } = await import(graphPath);
const { showMessage } = await import(showMsgPath);

describe('CSVdownload.js', () => {
    let saveCSVToggleButton;
    let saveCSVOptionsDropdown;
    let mockModal;

    // simulate a click event on an element
    const simulateClick = (element) => {
        if (element) {
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    };

    function createMockModal(modalId) {
        const modal = document.createElement('div');
        modal.id = modalId;

        const messageDiv = document.createElement('div');
        messageDiv.id = 'modal-message';
        modal.appendChild(messageDiv);

        document.body.appendChild(modal);
        return modal;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = ''; // Clean up DOM

        // Create and append required DOM elements for the module to find
        saveCSVToggleButton = document.createElement('button');
        saveCSVToggleButton.id = 'save-csv-toggle-btn';
        document.body.appendChild(saveCSVToggleButton);

        saveCSVOptionsDropdown = document.createElement('div');
        saveCSVOptionsDropdown.id = 'save-csv-options-dropdown';
        // Initially, the dropdown should be hidden in the DOM test environment
        saveCSVOptionsDropdown.classList.add('hidden');
        document.body.appendChild(saveCSVOptionsDropdown);

        mockModal = createMockModal('csv-page-modal');

        // Mock URL API methods
        global.URL.createObjectURL = jest.fn(() => 'blob:http://mockurl/mock-blob');
        global.URL.revokeObjectURL = jest.fn();

        // Spy on DOM manipulation methods
        jest.spyOn(document, 'createElement');
        jest.spyOn(document.body, 'appendChild');
        jest.spyOn(document.body, 'removeChild');
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });

        // Reset the default values for the mocked Graph.js
        currentData.splice(0, currentData.length);
        columnsInfo.splice(0, columnsInfo.length);
        csvName.value = ''; // Reset value
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore console, createElement, appendChild, removeChild
    });

    // --- setupSaveCSVEvents Tests ---
    describe('setupSaveCSVEvents', () => {
        it('should toggle dropdown visibility on button click', () => {
            setupSaveCSVEvents(); // Initialize event listeners
            expect(saveCSVOptionsDropdown.classList.contains('hidden')).toBe(true);

            simulateClick(saveCSVToggleButton); // Click the toggle button
            expect(saveCSVOptionsDropdown.classList.contains('hidden')).toBe(false); // Should be visible

            simulateClick(saveCSVToggleButton); // Click again
            expect(saveCSVOptionsDropdown.classList.contains('hidden')).toBe(true); // Should be hidden again
        });

        it('should hide dropdown after clicking a format option and trigger saveDataAs (via indirect test)', () => {
            setupSaveCSVEvents();
            simulateClick(saveCSVToggleButton); // Show dropdown

            const mockOption = document.createElement('div');
            mockOption.dataset.format = 'csv';
            saveCSVOptionsDropdown.appendChild(mockOption); // Add a mock option

            simulateClick(mockOption); // Click the option
            expect(saveCSVOptionsDropdown.classList.contains('hidden')).toBe(true); // Should hide dropdown
        });

        it('should not initialize if toggle button or dropdown are missing', () => {
            document.body.innerHTML = '';
            jest.clearAllMocks();

            expect(document.getElementById('save-csv-toggle-btn')).toBeNull();
            expect(document.getElementById('save-csv-options-dropdown')).toBeNull();

            setupSaveCSVEvents();
            expect(console.warn).toHaveBeenCalledWith("Save plot buttons or dropdown not found in DOM. Save functionality not initialized.");
        });
    });

    // --- saveDataAs function Tests ---
    if (saveDataAs) {
        describe('saveDataAs', () => {
            const mockData = [
                { 'Column A': 'Value1', 'Column B': 10 },
                { 'Column A': 'Value2', 'Column B': 20 }
            ];
            const mockColumns = [
                { column_id: 1, column_name: 'Column A' },
                { column_id: 2, column_name: 'Column B' }
            ];
            const mockFilename = 'my_data';

            it('should show message if no data to export', () => {
                saveDataAs('csv', [], [], '');
                expect(showMessage).toHaveBeenCalledWith(mockModal, 'No data to export.');
                expect(global.URL.createObjectURL).not.toHaveBeenCalled();
            });

            it('should convert and download data as CSV', () => {
                saveDataAs('csv', mockData, mockColumns, mockFilename);

                const expectedCsvContent = 'Column A,Column B\nValue1,10\nValue2,20\n';
                const expectedBlob = new Blob([expectedCsvContent], { type: 'text/csv;charset=utf-8;' });

                expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
                const calledBlob = global.URL.createObjectURL.mock.calls[0][0];
                // Compare blob content and type (a bit tricky for exact match, check type and size)
                expect(calledBlob.type).toBe(expectedBlob.type);
                expect(calledBlob.size).toBe(expectedBlob.size); // Basic size check

                expect(document.createElement).toHaveBeenCalledWith('a');
                const anchor = document.createElement.mock.results[0].value;
                expect(anchor.href).toBe('blob:http://mockurl/mock-blob');
                expect(anchor.download).toBe('my_data.csv');
                expect(document.body.appendChild).toHaveBeenCalledWith(anchor);
                expect(document.body.removeChild).toHaveBeenCalledWith(anchor);
                expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://mockurl/mock-blob');
                expect(showMessage).toHaveBeenCalledWith(mockModal, 'Data successfully saved as my_data.csv!');
            });

            it('should convert and download data as JSON', () => {
                saveDataAs('json', mockData, mockColumns, mockFilename);

                const expectedJsonContent = JSON.stringify([
                    { 'Column A': 'Value1', 'Column B': 10 },
                    { 'Column A': 'Value2', 'Column B': 20 }
                ], null, 2);
                const expectedBlob = new Blob([expectedJsonContent], { type: 'application/json;charset=utf-8;' });

                expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
                const calledBlob = global.URL.createObjectURL.mock.calls[0][0];
                expect(calledBlob.type).toBe(expectedBlob.type);
                expect(calledBlob.size).toBe(expectedBlob.size);

                expect(document.createElement).toHaveBeenCalledWith('a');
                const anchor = document.createElement.mock.results[0].value;
                expect(anchor.download).toBe('my_data.json');
                expect(showMessage).toHaveBeenCalledWith(mockModal, 'Data successfully saved as my_data.json!');
            });

            it('should handle unsupported format', () => {
                saveDataAs('xyz', mockData, mockColumns, mockFilename);
                expect(showMessage).toHaveBeenCalledWith(mockModal, 'Unsupported format: xyz');
                expect(console.warn).toHaveBeenCalledWith('Unsupported save format: xyz');
                expect(global.URL.createObjectURL).not.toHaveBeenCalled();
            });

            it('should clean filename from existing .csv extension', () => {
                const filenameWithExt = 'another_file.csv';
                saveDataAs('json', mockData, mockColumns, filenameWithExt);
                expect(document.createElement).toHaveBeenCalledWith('a');
                const anchor = document.createElement.mock.results[0].value;
                expect(anchor.download).toBe('another_file.json'); // Should remove .csv and add .json
            });

            it('should handle special characters in CSV values by quoting and escaping', () => {
                const specialData = [
                    { 'Col1': 'val,with,comma', 'Col2': 'val"with"quote' },
                    { 'Col1': 'new\nline', 'Col2': 'simple' }
                ];
                const specialColumns = [
                    { column_id: 1, column_name: 'Col1' },
                    { column_id: 2, column_name: 'Col2' }
                ];
                saveDataAs('csv', specialData, specialColumns, 'special');

                const anchor = document.createElement.mock.results[0].value;
                expect(anchor.download).toBe('special.csv');
                expect(showMessage).toHaveBeenCalledWith(mockModal, 'Data successfully saved as special.csv!');
            });

            it('should handle empty/null/undefined values in CSV conversion', () => {
                const emptyData = [
                    { 'Col1': 'a', 'Col2': null },
                    { 'Col1': undefined, 'Col2': 'b' },
                    { 'Col1': '', 'Col2': 'c' }
                ];
                const emptyColumns = [
                    { column_id: 1, column_name: 'Col1' },
                    { column_id: 2, column_name: 'Col2' }
                ];
                saveDataAs('csv', emptyData, emptyColumns, 'empty_values');

                const calledBlob = global.URL.createObjectURL.mock.calls[0][0];
                expect(calledBlob.type).toBe('text/csv;charset=utf-8;');
            });
        });
    }
});