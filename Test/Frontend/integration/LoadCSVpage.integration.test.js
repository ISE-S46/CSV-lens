import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to modules to mock (all external dependencies)
const showMessagePath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const pageInputPath = path.join(__dirname, '../../../Frontend/Script/module/PageInput.js');
const filterUIPath = path.join(__dirname, '../../../Frontend/Script/module/FilterUI.js');
const filterPath = path.join(__dirname, '../../../Frontend/Script/module/Filter.js');
const graphPath = path.join(__dirname, '../../../Frontend/Script/module/Graph.js');
const editCSVPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/EditCSV.js');
const fetchCSVPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/FetchCSV.js');
const renderCSVrowsPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/RenderCSVrows.js');
const paginationPath = path.join(__dirname, '../../../Frontend/Script/module/Pagination.js');

// Mock all dependencies

jest.unstable_mockModule(showMessagePath, () => ({ __esModule: true, showMessage: jest.fn() }));
jest.unstable_mockModule(pageInputPath, () => ({ __esModule: true, updateTotalPages: jest.fn() }));
jest.unstable_mockModule(filterUIPath, () => ({ __esModule: true, updateFilterUI: jest.fn() }));


const mockFilterManager = {
    clearFilters: jest.fn(),
    clearSorts: jest.fn(),
    addFilter: jest.fn(),
    addSort: jest.fn(),

};

jest.unstable_mockModule(filterPath, () => ({ __esModule: true, filterManager: mockFilterManager }));
jest.unstable_mockModule(graphPath, () => ({ __esModule: true, setGraphData: jest.fn() }));
jest.unstable_mockModule(editCSVPath, () => ({ __esModule: true, setupCellEditing: jest.fn() }));
jest.unstable_mockModule(fetchCSVPath, () => ({
    __esModule: true,
    fetchDatasetDetails: jest.fn(),
    fetchDatasetRows: jest.fn(),
    fetchDatasetGraph: jest.fn(),
    fetchDatasetNullRows: jest.fn(),
}));

jest.unstable_mockModule(renderCSVrowsPath, () => ({
    __esModule: true,
    renderDatasetMetadata: jest.fn(),
    renderTable: jest.fn(),
    renderNullTable: jest.fn(),
    toggleNullRowsDisplay: jest.fn(),

}));

jest.unstable_mockModule(paginationPath, () => ({
    __esModule: true,
    getCurrentPage: jest.fn(() => 1),
    setCurrentPage: jest.fn(),
    setTotalPages: jest.fn(),
    resetPagination: jest.fn(),
    updatePaginationDisplay: jest.fn(),
    bindPaginationButtons: jest.fn(),
    getPageFromUrl: jest.fn(() => 1),
    updateUrlWithPage: jest.fn(),
    handlePopstate: jest.fn(),
}));

// Import the module under test AFTER all dependencies are mocked
const LoadCSVpageModule = await import('../../../Frontend/Script/module/HandleCSV/LoadCSVpage.js');
const { loadCurrentPageRows, loadGraphData, setDatasetIdForTest } = LoadCSVpageModule;

// Import mocked functions for assertions
const FetchCSV = await import(fetchCSVPath);
const RenderCSVrows = await import(renderCSVrowsPath);
const Pagination = await import(paginationPath);
const { setGraphData } = await import(graphPath);

let mockMessageArea;
let mockDataQualityCheckSection;
let mockNullRowsCountText;
let mockNullRowsMessage;
let mockLoadingOverlay;

describe('LoadCSVpage Integration Test (Simplified)', () => {
    let originalLocation;
    let originalURLSearchParams;
    let originalAddEventListener;
    let originalGetElementById;
    let originalConsoleError;

    function createMockElement(id = '', tagName = 'div') {
        const el = document.createElement(tagName);
        el.id = id;
        el._textContent = '';
        Object.defineProperty(el, 'textContent', {
            set: function (val) { this._textContent = val; },
            get: function () { return this._textContent; },
            configurable: true
        });
        el.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn(),
        };
        return el;
    }

    function mockLocation(pathname, search = '') {
        const fullSearch = search && !search.startsWith('?') ? `?${search}` : search;
        delete window.location;
        window.location = {
            pathname,
            search: fullSearch,
            href: `http://localhost${pathname}${fullSearch}`,
            origin: 'http://localhost',
            protocol: 'http:',
            host: 'localhost',
            hostname: 'localhost',
            port: '',
            hash: '',
            replace: jest.fn(),
        };
    }

    beforeAll(() => {
        originalLocation = window.location;
        originalURLSearchParams = global.URLSearchParams;
        originalAddEventListener = window.addEventListener;
        originalGetElementById = document.getElementById;
        originalConsoleError = console.error;

        // Keep Mock URLSearchParams globally for a consistent environment
        global.URLSearchParams = class MockURLSearchParams {
            constructor(query) {
                this.params = new Map();
                if (query) {
                    const cleanQuery = query.startsWith('?') ? query.slice(1) : query;
                    if (cleanQuery) {
                        cleanQuery.split('&').forEach(param => {
                            const [key, value] = param.split('=');
                            if (key) {
                                this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
                            }
                        });
                    }
                }
            }
            has(key) { return this.params.has(key); }
            get(key) { return this.params.get(key); }
            append(key, value) { this.params.set(key, value); }
            toString() {
                const pairs = [];
                for (const [key, value] of this.params) {
                    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                }
                return pairs.join('&');
            }
        };

        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        setDatasetIdForTest(null);

        document.body.innerHTML = '';

        // Initialize mock DOM elements
        mockMessageArea = createMockElement('csv-page-modal');
        mockDataQualityCheckSection = createMockElement('data-quality-check');
        mockNullRowsCountText = createMockElement('null-rows-count-text');
        mockNullRowsMessage = createMockElement('null-rows-message');
        mockLoadingOverlay = createMockElement('loading-overlay'); // If loadDatasetPage interacts with this

        // Set initial classes for the mock elements as your app might expect
        mockDataQualityCheckSection.classList.add('hidden');
        mockNullRowsMessage.classList.add('hidden');

        jest.spyOn(document, 'getElementById').mockImplementation((id) => {
            switch (id) {
                case 'csv-page-modal': return mockMessageArea;
                case 'data-quality-check': return mockDataQualityCheckSection;
                case 'null-rows-count-text': return mockNullRowsCountText;
                case 'null-rows-message': return mockNullRowsMessage;
                case 'loading-overlay': return mockLoadingOverlay;
                // Add other necessary document.getElementById mocks here if loadDatasetPage uses them
                default: return null;
            }
        });
        window.addEventListener = jest.fn(); // Re-mock for each test

        mockLocation('/datasets/123', ''); // Default location
    });
    
    afterAll(() => {
        window.location = originalLocation;
        global.URLSearchParams = originalURLSearchParams;
        window.addEventListener = originalAddEventListener;
        document.getElementById = originalGetElementById;
        console.error = originalConsoleError;
        jest.restoreAllMocks();
    });

    describe('loadCurrentPageRows', () => {
        beforeEach(() => {
            setDatasetIdForTest(123);
            Pagination.getCurrentPage.mockReturnValue(2);
            FetchCSV.fetchDatasetRows.mockResolvedValue({
                data: [{ id: 1, col1: 'val1' }],
                pagination: { currentPage: 2, totalPages: 20 }
            });
        });

        it('should load current page rows with URL update', async () => {
            await loadCurrentPageRows(true);

            expect(Pagination.updateUrlWithPage).toHaveBeenCalledWith(2);
            expect(FetchCSV.fetchDatasetRows).toHaveBeenCalledWith(123, 2, 50);
            expect(RenderCSVrows.renderTable).toHaveBeenCalledWith([{ id: 1, col1: 'val1' }]);
        });

        it('should load current page rows without URL update', async () => {
            await loadCurrentPageRows(false);

            expect(Pagination.updateUrlWithPage).not.toHaveBeenCalled();
            expect(FetchCSV.fetchDatasetRows).toHaveBeenCalledWith(123, 2, 50);
            expect(RenderCSVrows.renderTable).toHaveBeenCalledWith([{ id: 1, col1: 'val1' }]);
        });

        it('should handle null response gracefully', async () => {
            FetchCSV.fetchDatasetRows.mockResolvedValue(null);

            await loadCurrentPageRows();

            expect(RenderCSVrows.renderTable).not.toHaveBeenCalled();
            expect(Pagination.updatePaginationDisplay).not.toHaveBeenCalled();
        });
    });

    describe('loadGraphData', () => {
        beforeEach(() => {
            setDatasetIdForTest(456);
        });

        it('should load and set graph data', async () => {
            const mockGraphData = { labels: ['A', 'B'], values: [10, 20] };
            FetchCSV.fetchDatasetGraph.mockResolvedValue({ data: mockGraphData });

            await loadGraphData();

            expect(FetchCSV.fetchDatasetGraph).toHaveBeenCalledWith(456);
            expect(setGraphData).toHaveBeenCalledWith(mockGraphData);
        });

        it('should handle null graph response', async () => {
            FetchCSV.fetchDatasetGraph.mockResolvedValue(null);

            await loadGraphData();

            expect(FetchCSV.fetchDatasetGraph).toHaveBeenCalledWith(456);
            expect(setGraphData).not.toHaveBeenCalled();
        });

        it('should handle response without data property', async () => {
            FetchCSV.fetchDatasetGraph.mockResolvedValue({});

            await loadGraphData();

            expect(setGraphData).not.toHaveBeenCalled();
        });
    });
});