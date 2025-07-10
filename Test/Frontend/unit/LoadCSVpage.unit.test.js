import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fetchCSVPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/FetchCSV.js');
const renderCSVrowsPath = path.join(__dirname, '../../../Frontend/Script/module/HandleCSV/RenderCSVrows.js');
const paginationPath = path.join(__dirname, '../../../Frontend/Script/module/Pagination.js');

// Mock the direct dependencies of loadCurrentPageRows
jest.unstable_mockModule(fetchCSVPath, () => ({
    __esModule: true,
    fetchDatasetRows: jest.fn(),
    fetchDatasetNullRows: jest.fn(),
    fetchSingleRow: jest.fn(),
    updateColumnName: jest.fn(),
    updateDatasetRow: jest.fn(),
    fetchDatasetDetails: jest.fn(),
    fetchDatasetGraph: jest.fn(),
}));
jest.unstable_mockModule(renderCSVrowsPath, () => ({
    __esModule: true,
    renderTable: jest.fn(),
    renderNullTable: jest.fn(),
    updateColumnsInfo: jest.fn(),
    renderDatasetMetadata: jest.fn(),
    toggleNullRowsDisplay: jest.fn(),
}));
jest.unstable_mockModule(paginationPath, () => ({
    __esModule: true,
    getCurrentPage: jest.fn(),
    updateUrlWithPage: jest.fn(),
    updatePaginationDisplay: jest.fn(),
    getTotalPages: jest.fn(),
    setCurrentPage: jest.fn(),
    setTotalPages: jest.fn(),
    bindPaginationButtons: jest.fn(),
    getPageFromUrl: jest.fn(),
    handlePopstate: jest.fn(),
    resetPagination: jest.fn(),
}));

// Import the module under test and its necessary components
const LoadCSVpageModule = await import('../../../Frontend/Script/module/HandleCSV/LoadCSVpage.js');
const { loadCurrentPageRows, setDatasetIdForTest } = LoadCSVpageModule;

// Import mocked functions for assertions
const FetchCSV = await import(fetchCSVPath);
const RenderCSVrows = await import(renderCSVrowsPath);
const Pagination = await import(paginationPath);

describe('Unit Test: loadCurrentPageRows', () => {
    let originalConsoleError;

    beforeAll(() => {
        originalConsoleError = console.error;
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test to prevent bleed-over
        // Ensure dataset ID is set as loadCurrentPageRows relies on this internal state
        setDatasetIdForTest(123);
    });

    afterAll(() => {
        // Restore original console.error
        console.error = originalConsoleError;
        jest.restoreAllMocks();
    });

    it('should fetch and render current page rows with URL update', async () => {
        // Arrange
        const currentPage = 2;
        const mockResponseData = [{ id: 1, col1: 'val1' }];
        const mockPagination = { currentPage: 2, totalPages: 20 };

        // Mock the return values of the dependencies
        Pagination.getCurrentPage.mockReturnValue(currentPage);
        FetchCSV.fetchDatasetRows.mockResolvedValue({
            data: mockResponseData,
            pagination: mockPagination
        });

        // Act
        await loadCurrentPageRows(true); // Simulate a call that updates URL

        // Assert
        expect(Pagination.getCurrentPage).toHaveBeenCalledTimes(1);
        expect(FetchCSV.fetchDatasetRows).toHaveBeenCalledWith(123, currentPage, 50); // Assuming 50 is a default page size
        expect(RenderCSVrows.renderTable).toHaveBeenCalledWith(mockResponseData);
        expect(Pagination.updateUrlWithPage).toHaveBeenCalledWith(currentPage); // Expect URL update
        expect(Pagination.updatePaginationDisplay).toHaveBeenCalledWith(mockPagination);
    });

    it('should fetch and render current page rows WITHOUT URL update', async () => {
        // Arrange
        const currentPage = 3;
        const mockResponseData = [{ id: 2, col1: 'val2' }];
        const mockPagination = { currentPage: 3, totalPages: 20 };

        Pagination.getCurrentPage.mockReturnValue(currentPage);
        FetchCSV.fetchDatasetRows.mockResolvedValue({
            data: mockResponseData,
            pagination: mockPagination
        });

        // Act
        await loadCurrentPageRows(false); // Simulate a call that does NOT update URL

        // Assert
        expect(Pagination.getCurrentPage).toHaveBeenCalledTimes(1);
        expect(FetchCSV.fetchDatasetRows).toHaveBeenCalledWith(123, currentPage, 50);
        expect(RenderCSVrows.renderTable).toHaveBeenCalledWith(mockResponseData);
        expect(Pagination.updateUrlWithPage).not.toHaveBeenCalled(); // Expect NO URL update
        expect(Pagination.updatePaginationDisplay).toHaveBeenCalledWith(mockPagination);
    });

    it('should handle null response from fetchDatasetRows gracefully', async () => {
        // Arrange
        const currentPage = 1;
        Pagination.getCurrentPage.mockReturnValue(currentPage);
        FetchCSV.fetchDatasetRows.mockResolvedValue(null); // Simulate API returning null

        // Act
        await loadCurrentPageRows(true);

        // Assert
        expect(FetchCSV.fetchDatasetRows).toHaveBeenCalledWith(123, currentPage, 50);
        expect(RenderCSVrows.renderTable).not.toHaveBeenCalled(); // Should not try to render
        expect(Pagination.updatePaginationDisplay).not.toHaveBeenCalled(); // Should not update display
    });

    it('should handle response without data property from fetchDatasetRows gracefully', async () => {
        // Arrange
        const currentPage = 1;
        Pagination.getCurrentPage.mockReturnValue(currentPage);
        FetchCSV.fetchDatasetRows.mockResolvedValue({}); // Simulate API returning empty object

        // Act
        await loadCurrentPageRows(true);

        // Assert
        expect(FetchCSV.fetchDatasetRows).toHaveBeenCalledWith(123, currentPage, 50);
        expect(RenderCSVrows.renderTable).not.toHaveBeenCalled(); // Should not try to render invalid data
        expect(Pagination.updatePaginationDisplay).not.toHaveBeenCalled(); // Should not update display
    });
});