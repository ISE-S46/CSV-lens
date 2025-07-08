import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to modules to mock
const configPath = path.join(__dirname, '../../../Frontend/config.js');
const showMsgPath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');

jest.unstable_mockModule(showMsgPath, () => ({
    __esModule: true,
    showMessage: jest.fn(),
}));

const { DeleteCSV } = await import('../../../Frontend/Script/module/HandleCSV/DeleteCSV.js');

const { showMessage } = await import(showMsgPath);
const { API_BASE_URL } = await import(configPath);

describe('DeleteCSV', () => {
    let mockDashboardMessageDiv;
    const mockDatasetId = 'test-dataset-id-123';

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

        mockDashboardMessageDiv = createMockModal('Main-page-modal');

        global.fetch = jest.fn();

        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restore original console.error
    });

    it('should successfully delete a CSV and show a success message', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ msg: 'Dataset deleted' }),
        });

        await DeleteCSV(mockDatasetId);

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`${API_BASE_URL}/datasets/${mockDatasetId}`),
            expect.any(Object)
        );
        expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Delete Dataset successfully.', true);
        expect(console.error).not.toHaveBeenCalled(); // No error should be logged
    });

    it('should show an error message if the API response is not ok', async () => {
        const errorMessage = 'Dataset not found';
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ msg: errorMessage }),
        });

        await DeleteCSV(mockDatasetId);

        expect(global.fetch).toHaveBeenCalledTimes(1); // Still called once
        expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, `Delete dataset failed, ${errorMessage}`, false);
        expect(console.error).not.toHaveBeenCalled(); // No client-side error, just an API error
    });

    it('should handle API response without a "msg" property', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Something went wrong' }), // No 'msg' property
        });

        await DeleteCSV(mockDatasetId);

        expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, `Delete dataset failed, undefined`, false); // Expect "undefined" if msg is missing
        expect(console.error).not.toHaveBeenCalled();
    });

    it('should show a network error message if fetch fails', async () => {
        const networkError = new Error('Network is down');
        global.fetch.mockRejectedValueOnce(networkError);

        await DeleteCSV(mockDatasetId);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Error deleting datasets.', false);
        expect(console.error).toHaveBeenCalledWith('Error deleting datasets', networkError); // Expect error to be logged
    });

    it('should gracefully handle if the message modal is not found', async () => {
        document.body.innerHTML = ''; // Ensure modal is NOT in the DOM
        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ msg: 'Deleted' }),
        });

        // Calling DeleteCSV when modal is not present
        await DeleteCSV(mockDatasetId);

        expect(showMessage).toHaveBeenCalledWith(null, 'Delete Dataset successfully.', true); // Expect null if modal not found
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();
    });
});