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
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore original console.error, warn
    });

    // --- handleFile Tests ---
    describe('handleFile', () => {
        it('should accept a valid CSV file and display info', () => {
            const mockFile = new File(['header,data'], 'test.csv', { type: 'text/csv' });
            Object.defineProperty(mockFile, 'size', { value: 100 * 1024 }); // 100KB

            handleFile(mockFile);

            expect(fileNameSpan.textContent).toBe('test.csv');
            expect(fileSizeSpan.textContent).toBe('100 KB');
            expect(fileInfoDiv.classList.contains('hidden')).toBe(false);
            expect(processButton.classList.contains('hidden')).toBe(false);
            expect(errorMessageDiv.classList.contains('hidden')).toBe(true); // Should hide any previous error
        });

        it('should show error for non-CSV files', () => {
            const mockFile = new File(['<html></html>'], 'image.jpg', { type: 'image/jpeg' });
            Object.defineProperty(mockFile, 'size', { value: 5000 });

            handleFile(mockFile);

            expect(errorTextSpan.textContent).toBe('Please select a CSV file.');
            expect(errorMessageDiv.classList.contains('hidden')).toBe(false);
            expect(fileInfoDiv.classList.contains('hidden')).toBe(true); // Should not display file info
            expect(processButton.classList.contains('hidden')).toBe(true); // Should not show process button
            expect(showMessage).not.toHaveBeenCalled(); // showMessage is for processCSV's messages
        });

        it('should show error for files larger than 10MB', () => {
            const mockFile = new File(['large,data'], 'large.csv', { type: 'text/csv' });
            Object.defineProperty(mockFile, 'size', { value: 11 * 1024 * 1024 }); // 11MB

            handleFile(mockFile);

            expect(errorTextSpan.textContent).toBe('File size must be less than 10MB.');
            expect(errorMessageDiv.classList.contains('hidden')).toBe(false);
            expect(fileInfoDiv.classList.contains('hidden')).toBe(true);
            expect(processButton.classList.contains('hidden')).toBe(true);
        });
    });

    // --- clearFile Tests ---
    describe('clearFile', () => {
        it('should clear selected file, reset input, and hide info/buttons/error', () => {
            const mockFile = new File(['a'], 'temp.csv', { type: 'text/csv' });
            handleFile(mockFile); // Simulates a file being selected and state updated
            expect(fileInfoDiv.classList.contains('hidden')).toBe(false);
            expect(processButton.classList.contains('hidden')).toBe(false);

            clearFile();

            expect(fileInput.value).toBe('');
            expect(fileInfoDiv.classList.contains('hidden')).toBe(true);
            expect(processButton.classList.contains('hidden')).toBe(true);
            expect(errorMessageDiv.classList.contains('hidden')).toBe(true);
        });
    });

    // --- formatFileSize Tests ---
    describe('formatFileSize', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
            expect(formatFileSize(500)).toBe('500 Bytes');
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(formatFileSize(10 * 1024 * 1024 - 1)).toBe('9.99 MB'); // Just under 10MB
            expect(formatFileSize(1.234 * 1024 * 1024)).toBe('1.23 MB');
        });
    });
});