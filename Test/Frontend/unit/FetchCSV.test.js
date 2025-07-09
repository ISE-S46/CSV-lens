import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to modules to mock
const showMessagePath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const filterPath = path.join(__dirname, '../../../Frontend/Script/module/Filter.js');
const handleSessionPath = path.join(__dirname, '../../../Frontend/Script/module/Auth/HandleSession.js');
const configPath = path.join(__dirname, '../../../Frontend/config.js');

// Mock `ShowMessage.js`
jest.unstable_mockModule(showMessagePath, () => ({
    __esModule: true,
    showMessage: jest.fn(),
}));

// Mock `Filter.js`
jest.unstable_mockModule(filterPath, () => ({
    __esModule: true,
    filterManager: {
        getFilters: jest.fn(() => ({})),
        getSorts: jest.fn(() => []),
    },
}));

// Mock `HandleSession.js`
jest.unstable_mockModule(handleSessionPath, () => ({
    __esModule: true,
    handleAuthError: jest.fn(() => false),
}));

const {
    fetchDatasetDetails,
    fetchDatasetRows,
    fetchDatasetGraph,
    fetchDatasetNullRows,
    updateDatasetRow,
    fetchSingleRow,
    updateColumnName
} = await import('../../../Frontend/Script/module/HandleCSV/FetchCSV.js');

// Import mocked dependencies
const { showMessage } = await import(showMessagePath);
const { filterManager } = await import(filterPath);
const { handleAuthError } = await import(handleSessionPath);
const { API_BASE_URL } = await import(configPath);

describe('FetchCSV.js', () => {
    let messageArea;
    let loadingSpinner;

    const mockDatasetId = 'test-dataset-id';
    const mockRowNumber = 123;

    // Helper to create a mock div
    function createMockDiv(id) {
        const div = document.createElement('div');
        div.id = id;
        document.body.appendChild(div);
        return div;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = ''; // Clean up DOM

        // Create mock DOM elements
        messageArea = createMockDiv('csv-page-modal');
        loadingSpinner = createMockDiv('loading-spinner');
        loadingSpinner.style.display = 'none';

        // Mock global fetch
        global.fetch = jest.fn();

        // Spy on console
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Helper for common fetch scenarios
    const mockFetchSuccess = (data, status = 200) => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: status,
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(JSON.stringify(data)), // In case a function defaults to text()
            headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        });
    };

    const mockFetchFailure = (errorData, status = 400, statusText = 'Bad Request') => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: status,
            statusText: statusText,
            json: () => Promise.resolve(errorData),
            text: () => Promise.resolve(JSON.stringify(errorData)),
            headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        });
    };

    // --- Spinner behavior tests ---
    const testSpinnerBehavior = async (fetchFunc) => {
        // Test with success
        mockFetchSuccess({ success: true });
        await fetchFunc();
        expect(loadingSpinner.style.display).toBe('none');
        jest.clearAllMocks();

        // Test with API failure
        mockFetchFailure({ msg: 'Error' });
        await fetchFunc();
        expect(loadingSpinner.style.display).toBe('none');
        jest.clearAllMocks();

        // Test with network error
        global.fetch.mockRejectedValueOnce(new Error('Network error'));
        await fetchFunc();
        expect(loadingSpinner.style.display).toBe('none');
    };

    // --- fetchDatasetDetails Tests ---
    describe('fetchDatasetDetails', () => {
        it('should fetch dataset details successfully', async () => {
            const mockData = { dataset: { id: mockDatasetId, name: 'test_dataset', columns: [] } };
            mockFetchSuccess(mockData);

            const result = await fetchDatasetDetails(mockDatasetId);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets/${mockDatasetId}`,
                expect.objectContaining({ credentials: 'include' })
            );
            expect(result).toEqual(mockData.dataset);
            expect(showMessage).not.toHaveBeenCalled();
            expect(handleAuthError).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
        });

        it('should show error message and return null on API failure', async () => {
            const errorMsg = 'Dataset not found';
            mockFetchFailure({ msg: errorMsg }, 404);

            const result = await fetchDatasetDetails(mockDatasetId);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(showMessage).toHaveBeenCalledWith(messageArea, `Error fetching dataset details: ${errorMsg}`);
            expect(result).toBeNull();
            expect(handleAuthError).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
        });

        it('should return null if authentication error occurs', async () => {
            handleAuthError.mockReturnValueOnce(true); // Simulate auth error
            mockFetchFailure({ msg: 'Unauthorized' }, 401); // Fetch will still be called

            const result = await fetchDatasetDetails(mockDatasetId);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
            expect(showMessage).not.toHaveBeenCalled(); // handleAuthError should prevent showMessage here
        });

        it('should show network error message and return null on network failure', async () => {
            const networkError = new Error('Failed to fetch');
            global.fetch.mockRejectedValueOnce(networkError);

            const result = await fetchDatasetDetails(mockDatasetId);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(showMessage).toHaveBeenCalledWith(messageArea, 'Error fetching dataset.');
            expect(console.error).toHaveBeenCalledWith('Network error fetching dataset:', networkError);
            expect(result).toBeNull();
        });

        it('should manage loading spinner visibility', async () => {
            await testSpinnerBehavior(() => fetchDatasetDetails(mockDatasetId));
        });
    });

    // --- fetchDatasetRows Tests ---
    describe('fetchDatasetRows', () => {
        const page = 1;
        const limit = 10;
        const mockRows = { total_rows: 20, data: [{ id: 1 }, { id: 2 }] };

        it('should fetch dataset rows successfully with default filters/sorts', async () => {
            mockFetchSuccess(mockRows);

            const result = await fetchDatasetRows(mockDatasetId, page, limit);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets/${mockDatasetId}/rows?page=${page}&limit=${limit}`,
                expect.objectContaining({ credentials: 'include' })
            );
            expect(result).toEqual(mockRows);
            expect(showMessage).not.toHaveBeenCalled();
            expect(filterManager.getFilters).toHaveBeenCalledTimes(1);
            expect(filterManager.getSorts).toHaveBeenCalledTimes(1);
        });

        it('should fetch dataset rows with filters and sorts', async () => {
            filterManager.getFilters.mockReturnValueOnce({ column1: 'value1' });
            filterManager.getSorts.mockReturnValueOnce([
                { column: 'col1', direction: 'asc' },
                { column: 'col2', direction: 'desc' }
            ]);
            mockFetchSuccess(mockRows);

            await fetchDatasetRows(mockDatasetId, page, limit);

            const queryParams = new URLSearchParams({ page, limit });
            queryParams.append('filters', JSON.stringify({ column1: 'value1' }));
            queryParams.append('sortBy', 'col1,col2');
            queryParams.append('sortOrder', 'asc,desc');

            const expectedUrl = `${API_BASE_URL}/datasets/${mockDatasetId}/rows?${queryParams.toString()}`;

            expect(global.fetch).toHaveBeenCalledWith(
                expectedUrl,
                expect.objectContaining({ credentials: 'include' })
            );
        });

        it('should show error message and return null on API failure', async () => {
            const errorMsg = 'Failed to get rows';
            mockFetchFailure({ msg: errorMsg }, 500);

            const result = await fetchDatasetRows(mockDatasetId, page, limit);

            expect(showMessage).toHaveBeenCalledWith(messageArea, `Error fetching dataset rows: ${errorMsg}`);
            expect(result).toBeNull();
        });

        it('should manage loading spinner visibility', async () => {
            await testSpinnerBehavior(() => fetchDatasetRows(mockDatasetId, page, limit));
        });
    });

    // --- fetchDatasetGraph Tests ---
    describe('fetchDatasetGraph', () => {
        const mockGraphData = { labels: ['A', 'B'], data: [10, 20] };

        it('should fetch dataset graph data successfully', async () => {
            mockFetchSuccess(mockGraphData);

            const result = await fetchDatasetGraph(mockDatasetId);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets/${mockDatasetId}/GraphData?`, // No page/limit for graph data
                expect.objectContaining({ credentials: 'include' })
            );
            expect(result).toEqual(mockGraphData);
            expect(showMessage).not.toHaveBeenCalled();
            expect(filterManager.getFilters).toHaveBeenCalledTimes(1);
            expect(filterManager.getSorts).toHaveBeenCalledTimes(1);
        });

        it('should fetch dataset graph with filters and sorts', async () => {
            filterManager.getFilters.mockReturnValueOnce({ category: 'charts' });
            filterManager.getSorts.mockReturnValueOnce([
                { column: 'date', direction: 'asc' }
            ]);
            mockFetchSuccess(mockGraphData);

            await fetchDatasetGraph(mockDatasetId);

            const queryParams = new URLSearchParams();
            queryParams.append('filters', JSON.stringify({ category: 'charts' }));
            queryParams.append('sortBy', 'date');
            queryParams.append('sortOrder', 'asc');

            const expectedUrl = `${API_BASE_URL}/datasets/${mockDatasetId}/GraphData?${queryParams.toString()}`;

            expect(global.fetch).toHaveBeenCalledWith(
                expectedUrl, // Compare against the string
                expect.objectContaining({ credentials: 'include' })
            );
        });


        it('should show error message and return null on API failure', async () => {
            const errorMsg = 'Graph data unavailable';
            mockFetchFailure({ msg: errorMsg }, 404);

            const result = await fetchDatasetGraph(mockDatasetId);

            expect(showMessage).toHaveBeenCalledWith(messageArea, `Error fetching dataset rows: ${errorMsg}`); // Note: current code uses 'Error fetching dataset rows' for graph error
            expect(result).toBeNull();
        });

        it('should manage loading spinner visibility', async () => {
            await testSpinnerBehavior(() => fetchDatasetGraph(mockDatasetId));
        });
    });

    // --- fetchDatasetNullRows Tests ---
    describe('fetchDatasetNullRows', () => {
        const mockNullRows = { count: 2, data: [{ row_number: 1, column: 'A' }] };

        it('should fetch null rows successfully', async () => {
            mockFetchSuccess(mockNullRows);

            const result = await fetchDatasetNullRows(mockDatasetId);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets/${mockDatasetId}/null-rows`,
                expect.objectContaining({ credentials: 'include' })
            );
            expect(result).toEqual(mockNullRows);
            expect(showMessage).not.toHaveBeenCalled();
        });

        it('should show error message and return null on API failure', async () => {
            const errorMsg = 'No null rows found (error)'; // Different error message from previous functions
            mockFetchFailure({ msg: errorMsg }, 404);

            const result = await fetchDatasetNullRows(mockDatasetId);

            expect(showMessage).toHaveBeenCalledWith(messageArea, `Error fetching null rows: ${errorMsg}`);
            expect(result).toBeNull();
        });

        it('should manage loading spinner visibility', async () => {
            await testSpinnerBehavior(() => fetchDatasetNullRows(mockDatasetId));
        });
    });

    // --- fetchSingleRow Tests ---
    describe('fetchSingleRow', () => {
        const mockRowData = { id: 1, name: 'Row 1' };

        it('should fetch a single row successfully', async () => {
            mockFetchSuccess({ row: mockRowData });

            const result = await fetchSingleRow(mockDatasetId, mockRowNumber);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets/${parseInt(mockDatasetId)}/rows/${mockRowNumber}`,
                expect.objectContaining({ credentials: 'include' })
            );
            expect(result).toEqual(mockRowData);
            expect(showMessage).not.toHaveBeenCalled();
        });

        it('should show error message and return null on API failure', async () => {
            const errorMsg = 'Row not found';
            mockFetchFailure({ msg: errorMsg }, 404);

            const result = await fetchSingleRow(mockDatasetId, mockRowNumber);

            expect(showMessage).toHaveBeenCalledWith(messageArea, `Error fetching single row: ${errorMsg}`);
            expect(result).toBeNull();
        });

        it('should manage loading spinner visibility', async () => {
            await testSpinnerBehavior(() => fetchSingleRow(mockDatasetId, mockRowNumber));
        });
    });

    // --- updateDatasetRow Tests ---
    describe('updateDatasetRow', () => {
        const mockRowData = { name: 'Updated Name', age: 30 };
        const updatedRowResponse = { updatedRow: { id: 1, name: 'Updated Name', age: 30 } };

        it('should update a dataset row successfully', async () => {
            mockFetchSuccess(updatedRowResponse);

            const result = await updateDatasetRow(mockDatasetId, mockRowNumber, mockRowData);

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/datasets/${mockDatasetId}/rows/${mockRowNumber}`,
                expect.objectContaining({
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mockRowData),
                    credentials: 'include'
                })
            );
            expect(result).toEqual(updatedRowResponse.updatedRow);
            expect(showMessage).toHaveBeenCalledWith(messageArea, `Row ${mockRowNumber} updated successfully!`, 'success');
        });

        it('should show error message and return null on API failure', async () => {
            const errorMsg = 'Validation failed';
            mockFetchFailure({ msg: errorMsg }, 422);

            const result = await updateDatasetRow(mockDatasetId, mockRowNumber, mockRowData);

            expect(showMessage).toHaveBeenCalledWith(messageArea, `Error updating row: ${errorMsg}`);
            expect(result).toBeNull();
        });

        it('should manage loading spinner visibility', async () => {
            await testSpinnerBehavior(() => updateDatasetRow(mockDatasetId, mockRowNumber, mockRowData));
        });
    });

    // --- updateColumnName Tests ---
    describe('updateColumnName', () => {
        const oldName = 'OldColumn';
        const newName = 'NewColumn';

        it('should update a column name successfully', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ msg: 'Column updated' }), // Backend might return JSON
            });

            const result = await updateColumnName(mockDatasetId, oldName, newName);

            expect(global.fetch).toHaveBeenCalledWith(
                `/api/datasets/${mockDatasetId}/columns/${encodeURIComponent(oldName)}`, // Note: URL starts with /api
                expect.objectContaining({
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newColumnName: newName }),
                    credentials: 'include'
                })
            );
            expect(result).toBe(true);
            expect(console.log).toHaveBeenCalledWith(`Column '${oldName}' updated to '${newName}' successfully.`);
            expect(console.error).not.toHaveBeenCalled();
        });

        it('should return false and log error on API failure', async () => {
            const errorMsg = 'Column name already exists';
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 409,
                json: () => Promise.resolve({ message: errorMsg }), // Note: uses 'message' not 'msg'
                statusText: 'Conflict',
            });
            jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy for this test

            const result = await updateColumnName(mockDatasetId, oldName, newName);

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalledWith(`Failed to update column name: ${errorMsg}`);
        });

        it('should return false and log network error on fetch failure', async () => {
            const networkError = new Error('Connection lost');
            global.fetch.mockRejectedValueOnce(networkError);
            jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy for this test

            const result = await updateColumnName(mockDatasetId, oldName, newName);

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalledWith('Error updating column name:', networkError);
        });
        
    });
});