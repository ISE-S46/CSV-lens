import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to modules to mock
const configPath = path.join(__dirname, '../../../Frontend/config.js');
const showMsgPath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const getCSVlistPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/getCSVlist.js');

// Mock `ShowMessage.js`
jest.unstable_mockModule(showMsgPath, () => ({
    __esModule: true,
    showMessage: jest.fn(),
}));

// Mock `getCSVlist.js` (assuming it's renderCSVlist function)
jest.unstable_mockModule(getCSVlistPath, () => ({
    __esModule: true,
    renderCSVlist: jest.fn(),
}));

// Import the module under test AFTER mocks are defined
const { handleFile, clearFile, processCSV, formatFileSize } = await import('../../../Frontend/Script/module/HandleCSV/CSVupload.js');

// Import mocked dependencies
const { showMessage } = await import(showMsgPath);
const { renderCSVlist } = await import(getCSVlistPath);
const { API_BASE_URL } = await import(configPath);

describe('CSVupload.js', () => {
    let fileInfoDiv;
    let fileNameSpan;
    let fileSizeSpan;
    let fileInput;
    let processButton;
    let errorMessageDiv;
    let errorTextSpan;
    let dashboardMessageDiv;
    let mockFile;

    function createMockModal(modalId, className = '') {
        const modal = document.createElement('div');
        modal.id = modalId;

        const messageDiv = document.createElement('div');
        messageDiv.id = 'modal-message';
        modal.appendChild(messageDiv);

        if (className) modal.classList.add(className);

        document.body.appendChild(modal);
        return modal;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = ''; // Clean up DOM

        // Create and append required DOM elements
        fileInfoDiv = createMockModal('fileInfo', 'hidden'); // Initially hidden
        fileNameSpan = document.createElement('span');
        fileNameSpan.id = 'fileName';
        fileInfoDiv.appendChild(fileNameSpan);

        fileSizeSpan = document.createElement('span');
        fileSizeSpan.id = 'fileSize';
        fileInfoDiv.appendChild(fileSizeSpan);

        fileInput = document.createElement('input');
        fileInput.id = 'fileInput';
        fileInput.type = 'file'; // Important for `input.value = ''` to work correctly in tests
        document.body.appendChild(fileInput);

        processButton = createMockModal('processBtn', 'hidden');
        document.body.appendChild(processButton);

        errorMessageDiv = createMockModal('errorMessage', 'hidden');
        errorTextSpan = document.createElement('span');
        errorTextSpan.id = 'errorText';
        errorMessageDiv.appendChild(errorTextSpan);

        dashboardMessageDiv = createMockModal('Main-page-modal'); // For processCSV messages

        // Mock global fetch
        global.fetch = jest.fn();

        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });

        global.FormData = jest.fn(() => ({
            append: jest.fn(),
        }));

        mockFile = new File(['col1,col2\ndata1,data2'], 'upload.csv', { type: 'text/csv' });
        Object.defineProperty(mockFile, 'size', { value: 500 });
        handleFile(mockFile);
        showMessage.mockClear();
        errorMessageDiv.classList.add('hidden');
        fileInfoDiv.classList.add('hidden');
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore original console.error, warn
    });

    // --- processCSV Tests ---
    describe('processCSV', () => {
        let mockFormDataInstanceAppend;  // Reference to the append mock from FormData

        const getMockFormDataInstanceAppend = () => {
            if (global.FormData.mock.results.length > 0) {
                return global.FormData.mock.results[0].value.append;
            }
            return jest.fn(); // Return a dummy mock if not called, to avoid errors
        };

        it('should show error if no file is selected', async () => {
            clearFile(); // Ensure no file is selected, setting internal `selectedFile = null`
            await processCSV();

            expect(showMessage).toHaveBeenCalledWith(dashboardMessageDiv, 'No file selected', false);
            expect(global.fetch).not.toHaveBeenCalled();
            expect(renderCSVlist).not.toHaveBeenCalled();
            expect(global.FormData).not.toHaveBeenCalled();
        });

        it('should successfully upload CSV file and render list', async () => {
            // Setup for successful fetch
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ msg: 'Upload successful' }),
                headers: { get: (header) => header === 'content-type' ? 'application/json' : null },
            });

            await processCSV();

            // Now, AFTER `processCSV` has run (and instantiated FormData)
            // we can safely get the mockFormDataInstanceAppend.
            mockFormDataInstanceAppend = getMockFormDataInstanceAppend();

            expect(global.FormData).toHaveBeenCalledTimes(1);
            expect(mockFormDataInstanceAppend).toHaveBeenCalledWith('csvName', mockFile.name);
            expect(mockFormDataInstanceAppend).toHaveBeenCalledWith('description', mockFile.type);
            expect(mockFormDataInstanceAppend).toHaveBeenCalledWith('csvFile', mockFile);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${API_BASE_URL}/datasets/upload`),
                expect.any(Object)
            );
            expect(showMessage).toHaveBeenCalledWith(dashboardMessageDiv, 'Upload CSV file successfully', true);
            expect(renderCSVlist).toHaveBeenCalledTimes(1);
        });

        it('should handle API error response with JSON content', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ msg: 'File already exists' }),
                headers: { get: (header) => header === 'content-type' ? 'application/json' : null },
            });

            await processCSV();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(showMessage).toHaveBeenCalledWith(dashboardMessageDiv, 'Upload failed, File already exists', false)
        });

        it('should handle API error response with text content', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal Server Error'),
                headers: { get: (header) => header === 'content-type' ? 'text/plain' : null },
            });

            await processCSV();

            mockFormDataInstanceAppend = getMockFormDataInstanceAppend();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(mockFormDataInstanceAppend).toHaveBeenCalled();
            expect(showMessage).toHaveBeenCalledWith(dashboardMessageDiv, "Upload failed, undefined", false);
        });


        it('should handle network errors during upload', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Upload network error'));

            await processCSV();

            mockFormDataInstanceAppend = getMockFormDataInstanceAppend();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith('Upload error:', expect.any(Error));
            expect(showMessage).toHaveBeenCalledWith(dashboardMessageDiv, 'Network error. Please try again later.', false);
            expect(renderCSVlist).not.toHaveBeenCalled();
            expect(mockFormDataInstanceAppend).toHaveBeenCalled(); // FormData should still be used
        });
    });
});