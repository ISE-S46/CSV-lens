import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const showMessagePath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const CSVuploadPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/CSVupload.js');
const paginationPath = path.join(__dirname, '../../../Frontend/Script/module/Pagination.js');
const configPath = path.join(__dirname, '../../../Frontend/config.js');

// Mock `ShowMessage.js`
jest.unstable_mockModule(showMessagePath, () => ({
    __esModule: true,
    showMessage: jest.fn(),
}));

// Mock `CSVupload.js` (for formatFileSize)
jest.unstable_mockModule(CSVuploadPath, () => ({
    __esModule: true,
    formatFileSize: jest.fn(size => `${size / 1024} KB`), // Simple mock for testing
}));

// Mock `Pagination.js`
jest.unstable_mockModule(paginationPath, () => ({
    __esModule: true,
    getCurrentPage: jest.fn(() => 1),
    setCurrentPage: jest.fn(),
    setTotalPages: jest.fn(),
    resetPagination: jest.fn(),
    updatePaginationDisplay: jest.fn(),
    bindPaginationButtons: jest.fn(),
    getPageFromUrl: jest.fn(() => 1), // Default to page 1 from URL
    updateUrlWithPage: jest.fn(),
    handlePopstate: jest.fn(),
}));

const {
    getCSVlist,
    renderCurrentPage
} = await import('../../../Frontend/Script/module/HandleCSV/getCSVlist.js');

// Import the real module asynchronously before mocking
const realGetCSVlistModule = await import('../../../Frontend/Script/module/HandleCSV/getCSVlist.js');

jest.unstable_mockModule('../../../Frontend/Script/module/HandleCSV/getCSVlist.js', () => ({
    __esModule: true,
    getCSVlist: jest.fn(), // mocked function
    renderCSVlist: realGetCSVlistModule.renderCSVlist,
    formatTimestamp: realGetCSVlistModule.formatTimestamp,
    initializePagination: realGetCSVlistModule.initializePagination,
    renderCurrentPage: realGetCSVlistModule.renderCurrentPage,
    handlePageChange: realGetCSVlistModule.handlePageChange
}));

const GetCSVlistModule = await import('../../../Frontend/Script/module/HandleCSV/getCSVlist.js');

// Import mocked dependencies
const { showMessage } = await import(showMessagePath);
const { formatFileSize } = await import(CSVuploadPath);
const Pagination = await import(paginationPath);
const { API_BASE_URL } = await import(configPath);

// Store original DOM methods
const originalQuerySelector = document.querySelector;
const originalGetElementById = document.getElementById;

describe('GetCSVlist.js', () => {
    let mockDashboardMessageDiv;
    let mockDatasetsContainer;
    let originalAddEventListener;
    let originalRemoveEventListener;

    const mockDatasets = [
        { dataset_id: 1, csv_name: 'data1.csv', file_size_bytes: 1024, row_count: 100, upload_date: '2023-01-01T10:00:00Z' },
        { dataset_id: 2, csv_name: 'data2.csv', file_size_bytes: 2048, row_count: 200, upload_date: '2023-01-02T11:00:00Z' },
        { dataset_id: 3, csv_name: 'data3.csv', file_size_bytes: 3072, row_count: 300, upload_date: '2023-01-03T12:00:00Z' },
        { dataset_id: 4, csv_name: 'data4.csv', file_size_bytes: 4096, row_count: 400, upload_date: '2023-01-04T13:00:00Z' },
        { dataset_id: 5, csv_name: 'data5.csv', file_size_bytes: 5120, row_count: 500, upload_date: '2023-01-05T14:00:00Z' },
        { dataset_id: 6, csv_name: 'data6.csv', file_size_bytes: 6144, row_count: 600, upload_date: '2023-01-06T15:00:00Z' },
        { dataset_id: 7, csv_name: 'data7.csv', file_size_bytes: 7168, row_count: 700, upload_date: '2023-01-07T16:00:00Z' },
        { dataset_id: 8, csv_name: 'data8.csv', file_size_bytes: 8192, row_count: 800, upload_date: '2023-01-08T17:00:00Z' },
        { dataset_id: 9, csv_name: 'data9.csv', file_size_bytes: 9216, row_count: 900, upload_date: '2023-01-09T18:00:00Z' },
        { dataset_id: 10, csv_name: 'data10.csv', file_size_bytes: 10240, row_count: 1000, upload_date: '2023-01-10T19:00:00Z' },
        { dataset_id: 11, csv_name: 'data11.csv', file_size_bytes: 11264, row_count: 1100, upload_date: '2023-01-11T20:00:00Z' },
        { dataset_id: 12, csv_name: 'data12.csv', file_size_bytes: 12288, row_count: 1200, upload_date: '2023-01-12T21:00:00Z' },
        { dataset_id: 13, csv_name: 'data13.csv', file_size_bytes: 13312, row_count: 1300, upload_date: '2023-01-13T22:00:00Z' },
    ];
    const rowsPerPage = 12; // Matches the module's internal rowsPerPage

    function createMockDiv(id, tagName = 'div') {
        const el = document.createElement(tagName);
        el.id = id;

        // Create Jest mock functions for the getter and setter
        const mockSetter = jest.fn(val => { el._innerHTML = val; });
        const mockGetter = jest.fn(() => el._innerHTML || '');

        // Store references to the mock functions on the element for easy access
        el.setInnerHTML = mockSetter;
        el.getInnerHTML = mockGetter;

        // Mock innerHTML setter to capture content
        Object.defineProperty(el, 'innerHTML', {
            set: mockSetter,
            get: mockGetter,
            configurable: true
        });
        document.body.appendChild(el);
        return el;
    }

    // Helper to setup DOM mocks
    function setupDOMMocks() {
        mockDashboardMessageDiv = createMockDiv('Main-page-modal');
        mockDatasetsContainer = createMockDiv('DatasetsContainer', 'tbody');

        jest.spyOn(document, 'querySelector').mockImplementation((selector) => {
            if (selector === '#Main-page-modal') return mockDashboardMessageDiv;
            return originalQuerySelector.call(document, selector);
        });
        jest.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'DatasetsContainer') return mockDatasetsContainer;
            return originalGetElementById.call(document, id);
        });
    }

    beforeAll(() => {
        // Store original add/remove event listener methods
        originalAddEventListener = window.addEventListener;
        originalRemoveEventListener = window.removeEventListener;

        // Mock window.addEventListener and removeEventListener for specific events
        window.addEventListener = jest.fn((event, handler) => {
            if (!window.eventListeners) {
                window.eventListeners = {};
            }
            if (!window.eventListeners[event]) {
                window.eventListeners[event] = [];
            }
            window.eventListeners[event].push(handler);
        });
        window.removeEventListener = jest.fn((event, handler) => {
            if (window.eventListeners && window.eventListeners[event]) {
                window.eventListeners[event] = window.eventListeners[event].filter(h => h !== handler);
            }
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';

        setupDOMMocks();

        // Mock global fetch
        global.fetch = jest.fn();

        // Spy on console.error and console.log
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterAll(() => {
        window.addEventListener = originalAddEventListener;
        window.removeEventListener = originalRemoveEventListener;
        jest.restoreAllMocks();
    });

    // Helper for common fetch scenarios
    const mockFetchSuccess = (data, status = 200) => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: status,
            json: () => Promise.resolve(data),
        });
    };

    const mockFetchFailure = (errorData, status = 400, statusText = 'Bad Request') => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: status,
            statusText: statusText,
            json: () => Promise.resolve(errorData),
        });
    };

    // --- getCSVlist Tests ---
    describe('getCSVlist', () => {
        it('should fetch CSV list successfully', async () => {
            const mockApiResponse = { datasets: mockDatasets };
            mockFetchSuccess(mockApiResponse);

            const result = await getCSVlist();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets`,
                expect.objectContaining({ method: 'GET' })
            );
            expect(result).toEqual(mockDatasets);
            expect(showMessage).not.toHaveBeenCalled();
        });

        it('should show error message and return undefined on API failure', async () => {
            const errorMsg = 'Failed to fetch';
            mockFetchFailure({ msg: errorMsg }, 500);

            const result = await getCSVlist();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, `fetching datasets failed, ${errorMsg}`, false);
            expect(result).toBeUndefined();
        });

        it('should show network error message and return undefined on network failure', async () => {
            const networkError = new Error('Network error');
            global.fetch.mockRejectedValueOnce(networkError);

            const result = await getCSVlist();

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith('Error fetching datasets', networkError);
            expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Error fetching datasets.', false);
            expect(result).toBeUndefined();
        });
    });

    // --- formatTimestamp Tests ---
    describe('formatTimestamp', () => {
        it('should format a UTC timestamp string correctly', () => {
            const timestamp = '2023-07-15T09:30:00.000Z';
            expect(GetCSVlistModule.formatTimestamp(timestamp)).toBe('15-07-2023 16:30');
        });

        it('should handle single digit month/day/hour/minute padding', () => {
            const timestamp = '2023-01-05T03:05:00.000Z';
            expect(GetCSVlistModule.formatTimestamp(timestamp)).toBe('05-01-2023 10:05');
        });

        it('should handle different year formats if input is valid', () => {
            const timestamp = '2025-12-25T14:45:00Z';
            expect(GetCSVlistModule.formatTimestamp(timestamp)).toBe('25-12-2025 21:45');
        });
    });

    // --- renderCSVlist Tests ---
    describe('renderCSVlist', () => {
        it('should fetch and render all datasets if no matchingDatasets provided', async () => {
            await GetCSVlistModule.renderCSVlist(mockDatasets);

            expect(GetCSVlistModule.getCSVlist).not.toHaveBeenCalled();
            expect(Pagination.setTotalPages).toHaveBeenCalledWith(Math.ceil(mockDatasets.length / rowsPerPage));
            expect(Pagination.setCurrentPage).toHaveBeenCalledWith(1);
            expect(mockDatasetsContainer.innerHTML).not.toBe('');
            expect(mockDatasetsContainer.innerHTML).toContain(mockDatasets[0].csv_name);
            expect(mockDatasetsContainer.innerHTML).toContain(mockDatasets[rowsPerPage - 1].csv_name);
            expect(mockDatasetsContainer.innerHTML).not.toContain(mockDatasets[rowsPerPage].csv_name);
            expect(formatFileSize).toHaveBeenCalledTimes(rowsPerPage);
        });

        it('should render matchingDatasets if provided', async () => {
            const filteredDatasets = [mockDatasets[0], mockDatasets[1]];
            await GetCSVlistModule.renderCSVlist(filteredDatasets);

            expect(GetCSVlistModule.getCSVlist).not.toHaveBeenCalled();
            expect(Pagination.setTotalPages).toHaveBeenCalledWith(Math.ceil(filteredDatasets.length / rowsPerPage));
            expect(mockDatasetsContainer.innerHTML).toContain(filteredDatasets[0].csv_name);
            expect(mockDatasetsContainer.innerHTML).toContain(filteredDatasets[1].csv_name);
            expect(mockDatasetsContainer.innerHTML).not.toContain(mockDatasets[2].csv_name);
            expect(formatFileSize).toHaveBeenCalledTimes(filteredDatasets.length);
        });

        it('should render empty container if no datasets are returned or matched', async () => {
            GetCSVlistModule.getCSVlist.mockResolvedValue([]);
            await GetCSVlistModule.renderCSVlist();
            expect(mockDatasetsContainer.innerHTML).toBe('');
            expect(Pagination.setTotalPages).toHaveBeenCalledWith(0);
        });

        it('should handle null datasets gracefully', async () => {
            GetCSVlistModule.getCSVlist.mockResolvedValue(null);
            await GetCSVlistModule.renderCSVlist();
            expect(mockDatasetsContainer.innerHTML).toBe('');
            expect(Pagination.setTotalPages).toHaveBeenCalledWith(0);
        });
    });

    // --- renderCurrentPage Tests ---
    describe('renderCurrentPage', () => {
        const setupInternalAllDatasets = async (datasets, initialPage = 1) => {
            // Mock pagination functions for setup
            Pagination.getPageFromUrl.mockReturnValue(initialPage);
            Pagination.getCurrentPage.mockReturnValue(initialPage);

            // Call renderCSVlist to populate `allDatasets` internally
            await GetCSVlistModule.renderCSVlist(datasets);

            // Clear the innerHTML mock calls from the initial render
            mockDatasetsContainer.setInnerHTML.mockClear();
            mockDatasetsContainer.getInnerHTML.mockClear();

            // Clear other mocks that were called during setup
            Pagination.setTotalPages.mockClear();
            Pagination.setCurrentPage.mockClear();
            Pagination.updatePaginationDisplay.mockClear();
            formatFileSize.mockClear();
        };

        it('should render datasets for the current page (page 1)', async () => {
            await setupInternalAllDatasets(mockDatasets, 1);

            // Call renderCurrentPage directly to test it
            renderCurrentPage();

            expect(mockDatasetsContainer.innerHTML).toContain(mockDatasets[0].csv_name);
            expect(mockDatasetsContainer.innerHTML).toContain(mockDatasets[rowsPerPage - 1].csv_name);
            expect(Pagination.updatePaginationDisplay).toHaveBeenCalledWith({
                currentPage: 1,
                totalPages: Math.ceil(mockDatasets.length / rowsPerPage),
                hasPreviousPage: false,
                hasNextPage: true,
            });
            expect(formatFileSize).toHaveBeenCalledTimes(rowsPerPage);
        });

        it('should render datasets for a subsequent page (page 2)', async () => {
            await setupInternalAllDatasets(mockDatasets, 1);

            // Change current page to 2
            Pagination.getCurrentPage.mockReturnValue(2);

            renderCurrentPage();

            expect(mockDatasetsContainer.innerHTML).toContain(mockDatasets[12].csv_name);
            expect(formatFileSize).toHaveBeenCalledTimes(1); // Only 1 dataset on page 2
            expect(Pagination.updatePaginationDisplay).toHaveBeenCalledWith({
                currentPage: 2,
                totalPages: Math.ceil(mockDatasets.length / rowsPerPage),
                hasPreviousPage: true,
                hasNextPage: false,
            });
        });

        it('should clear container if no datasets', async () => {
            await setupInternalAllDatasets([], 1);

            renderCurrentPage();

            expect(Pagination.updatePaginationDisplay).toHaveBeenCalledWith({
                currentPage: 1,
                totalPages: 0,
                hasPreviousPage: false,
                hasNextPage: false,
            });
            expect(formatFileSize).not.toHaveBeenCalled();
        });

        it('should return early if DatasetsContainer is not found', async () => {
            await setupInternalAllDatasets(mockDatasets, 1);

            // Mock getElementById to return null for DatasetsContainer
            jest.spyOn(document, 'getElementById').mockImplementation((id) => {
                if (id === 'DatasetsContainer') return null;
                return originalGetElementById.call(document, id);
            });

            renderCurrentPage();

            expect(Pagination.updatePaginationDisplay).not.toHaveBeenCalled();
        });
    });

    // --- handlePageChange Tests ---
    describe('handlePageChange', () => {
        let actualHandlePageChange;

        beforeEach(async () => {
            await GetCSVlistModule.renderCSVlist(mockDatasets);

            Pagination.getPageFromUrl.mockReturnValue(1);
            jest.clearAllMocks(); // Clear mocks from setup

            // Import `handlePageChange` after `allDatasets` is set by `renderCSVlist`
            actualHandlePageChange = GetCSVlistModule.handlePageChange;

            // Mock relevant pagination functions for `handlePageChange` execution
            Pagination.getCurrentPage.mockReturnValue(1);
        });

        it('should change to the next page if valid', async () => {
            const initialPage = 1;
            const direction = 1;
            Pagination.getCurrentPage.mockReturnValue(initialPage);

            await actualHandlePageChange(direction);

            expect(Pagination.setCurrentPage).toHaveBeenCalledWith(initialPage + direction);
            expect(Pagination.updateUrlWithPage).toHaveBeenCalledWith(initialPage + direction, true);
            // Verify that renderCurrentPage was called indirectly (it calls updatePaginationDisplay)
            expect(Pagination.updatePaginationDisplay).toHaveBeenCalled();
        });

        it('should change to the previous page if valid', async () => {
            const initialPage = 2; // Simulate being on page 2
            const direction = -1;
            Pagination.getCurrentPage.mockReturnValue(initialPage);

            await actualHandlePageChange(direction);

            expect(Pagination.setCurrentPage).toHaveBeenCalledWith(initialPage + direction);
            expect(Pagination.updateUrlWithPage).toHaveBeenCalledWith(initialPage + direction, true);
            expect(Pagination.updatePaginationDisplay).toHaveBeenCalled();
        });

        it('should not change page if newPage is less than 1', async () => {
            const initialPage = 1;
            const direction = -1;
            Pagination.getCurrentPage.mockReturnValue(initialPage);

            await actualHandlePageChange(direction);

            expect(Pagination.setCurrentPage).not.toHaveBeenCalled();
            expect(Pagination.updateUrlWithPage).not.toHaveBeenCalled();
            expect(Pagination.updatePaginationDisplay).not.toHaveBeenCalled();
        });

        it('should not change page if newPage is greater than totalPages', async () => {
            const initialPage = Math.ceil(mockDatasets.length / rowsPerPage); // Last page
            const direction = 1;
            Pagination.getCurrentPage.mockReturnValue(initialPage);

            await actualHandlePageChange(direction);

            expect(Pagination.setCurrentPage).not.toHaveBeenCalled();
            expect(Pagination.updateUrlWithPage).not.toHaveBeenCalled();
            expect(Pagination.updatePaginationDisplay).not.toHaveBeenCalled();
        });
    });

    // --- initializePagination Tests ---
    describe('initializePagination', () => {
        let actualHandlePageChangeCallback;

        beforeEach(async () => {
            // Need to set up `allDatasets` for handlePageChange to work when simulated
            GetCSVlistModule.getCSVlist.mockResolvedValue(mockDatasets);
            // Mock getPageFromUrl and setCurrentPage so that `allDatasets` can be populated by renderCSVlist
            Pagination.getPageFromUrl.mockReturnValue(1);
            // Simulate that renderCSVlist was called once to populate allDatasets
            await GetCSVlistModule.renderCSVlist(mockDatasets);
            jest.clearAllMocks(); // Clear mocks from initial setup

            Pagination.bindPaginationButtons.mockImplementationOnce((callback) => {
                actualHandlePageChangeCallback = callback;
            });
        });

        it('should bind pagination buttons and popstate event listener', async () => {
            GetCSVlistModule.initializePagination();

            expect(Pagination.bindPaginationButtons).toHaveBeenCalledWith(expect.any(Function));
            // Check that the popstate listener was added
            expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
            // Ensure the specific handler is roughly the one we expect (this is more about structure)
            const popstateHandler = window.eventListeners['popstate'][0];
            expect(popstateHandler).toBeInstanceOf(Function);
        });

        it('popstate event should call handlePopstate, renderCurrentPage, and handleSearchFromURL', async () => {
            GetCSVlistModule.initializePagination();

            // Simulate the popstate event
            // Find the handler attached to 'popstate'
            const popstateHandler = window.eventListeners['popstate'][0];
            expect(popstateHandler).toBeDefined();

            // Mock getCurrentPage to return a valid state for renderCurrentPage to work
            Pagination.getCurrentPage.mockReturnValue(1);

            // Manually call the captured handler
            await popstateHandler();

            expect(Pagination.handlePopstate).toHaveBeenCalledTimes(1);
            // renderCurrentPage is called internally and uses updatePaginationDisplay
            expect(Pagination.updatePaginationDisplay).toHaveBeenCalled();
        });
    });
});