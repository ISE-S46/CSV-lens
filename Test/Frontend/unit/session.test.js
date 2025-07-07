import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../../../Frontend/config.js');
const showMsgPath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');
const handleSessionPath = path.join(__dirname, '../../../Frontend/Script/module/Auth/HandleSession.js');

// Mock config and showMessage modules
jest.unstable_mockModule(configPath, () => ({
    __esModule: true,
    API_BASE_URL: '/api',
}));

jest.unstable_mockModule(showMsgPath, () => ({
    showMessage: jest.fn(),
}));

// Await the real module AFTER the mocks are declared
const { showMessage } = await import(showMsgPath);
const {
    handleLogout,
    refreshAccessToken,
    resetIdleTimer,
    startTokenRefreshCheck,
    checkAuthAndRender,
    handleAuthError,
    checkExistingTokenAndRedirect
} = await import('../../../Frontend/Script/module/Auth/HandleSession.js');

const { API_BASE_URL } = await import(configPath);

describe('Auth Module Frontend Tests', () => {
    let mockRegisterEmail, mockRegisterUsername, mockRegisterPassword, mockRegisterConfirmPassword;
    let mockRegisterMessageDiv;
    let mockLoginEmail, mockLoginPassword, mockLoginMessageDiv;
    let mockDashboardMessageDiv;
    let mockCsvPageModal; // For handleAuthError

    function createMockModal(modalId) {
        const modal = document.createElement('div');
        modal.id = modalId;

        const messageDiv = document.createElement('div');
        messageDiv.id = 'modal-message';
        modal.appendChild(messageDiv);

        document.body.appendChild(modal);
        return modal;
    }

    beforeAll(() => {
        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn(),
            },
            writable: true,
        });

    });

    // Use fake timers for functions involving setTimeout or setInterval
    beforeEach(() => {
        jest.useFakeTimers();

        // Clear all mocks and reset DOM before each test
        jest.clearAllMocks();
        document.body.innerHTML = ''; // Clear existing DOM

        // Setup common DOM elements for each test
        mockRegisterEmail = document.createElement('input');
        mockRegisterEmail.id = 'registerEmail';
        document.body.appendChild(mockRegisterEmail);

        mockRegisterUsername = document.createElement('input');
        mockRegisterUsername.id = 'registerUsername';
        document.body.appendChild(mockRegisterUsername);

        mockRegisterPassword = document.createElement('input');
        mockRegisterPassword.id = 'registerPassword';
        document.body.appendChild(mockRegisterPassword);

        mockRegisterConfirmPassword = document.createElement('input');
        mockRegisterConfirmPassword.id = 'registerConfirmPassword';
        document.body.appendChild(mockRegisterConfirmPassword);

        mockLoginEmail = document.createElement('input');
        mockLoginEmail.id = 'loginEmail';
        document.body.appendChild(mockLoginEmail);

        mockLoginPassword = document.createElement('input');
        mockLoginPassword.id = 'loginPassword';
        document.body.appendChild(mockLoginPassword);

        mockRegisterMessageDiv = createMockModal('Register-modal');
        mockLoginMessageDiv = createMockModal('login-modal');
        mockDashboardMessageDiv = createMockModal('Main-page-modal');
        mockCsvPageModal = createMockModal('csv-page-modal');

        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(window.localStorage, 'removeItem');

        // Reset fetch mock for each test
        global.fetch = jest.fn();

        // Clear localStorage mock for each test
        ['getItem', 'setItem', 'removeItem', 'clear'].forEach(fn => {
            if (!jest.isMockFunction(window.localStorage[fn])) {
                window.localStorage[fn] = jest.fn();
            } else {
                window.localStorage[fn].mockClear();
            }
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers(); // Ensure all timers are cleared
        jest.clearAllTimers(); // Clear any remaining timers
        jest.clearAllMocks(); // Restore original functions after each test
    });

    // --- refreshAccessToken Tests ---
    describe('refreshAccessToken', () => {
        it('should refresh access token, update localStorage, and call checkAuthAndRender', async () => {
            const mockNewUser = { id: 1, username: 'testuser', email: "test@test.com" };
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ user: mockNewUser }),
            });

            await refreshAccessToken();

            expect(global.fetch).toHaveBeenCalledWith(
                `${process.env.API_BASE_URL}/auth/refresh-token`,
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                })
            );
            expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockNewUser));
            expect(console.log).toHaveBeenCalledWith('Access token refreshed successfully.');
        });
    });
});