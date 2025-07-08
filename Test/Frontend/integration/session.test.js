import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../../../Frontend/config.js');
const showMsgPath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');

jest.unstable_mockModule(showMsgPath, () => ({
    showMessage: jest.fn(),
}));

const {
    handleLogout,
    refreshAccessToken,
    resetIdleTimer,
    checkAuthAndRender,
    handleAuthError,
    checkExistingTokenAndRedirect
} = await import('../../../Frontend/Script/module/Auth/HandleSession.js');

// Await the real module AFTER the mocks are declared
const { showMessage } = await import(showMsgPath);
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
        jest.spyOn(global, 'clearTimeout');
        jest.spyOn(global, 'setTimeout');

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
                `${API_BASE_URL}/auth/refresh-token`,
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                })
            );
            expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockNewUser));
            expect(console.log).toHaveBeenCalledWith('Access token refreshed successfully.');
        });

        it('should force full logout on refresh token failure', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ msg: 'Refresh failed' }),
                status: 401
            });

            await refreshAccessToken();

            expect(global.fetch).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Refresh token failed. Forcing full logout.');
            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
        });

        it('should force full logout on network error during refresh', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Refresh network error'));

            await refreshAccessToken();

            expect(global.fetch).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Network error during token refresh:', expect.any(Error));
            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
        });
    });

    // --- resetIdleTimer Tests ---
    describe('resetIdleTimer', () => {
        const MAX_IDLE_LIMIT = 2 * 60 * 60 * 1000;

        it('should reset lastActivityTime and clear/set idle timer', () => {
            const initialActivityTime = Date.now();
            jest.setSystemTime(initialActivityTime);

            resetIdleTimer();

            expect(Date.now()).toBe(initialActivityTime); // lastActivityTime updated
            expect(clearTimeout).toHaveBeenCalledTimes(1); // Clears previous timer
            expect(setTimeout).toHaveBeenCalledWith(handleLogout, MAX_IDLE_LIMIT); // Sets new timer
        });

    });

    // --- checkAuthAndRender Tests ---
    describe('checkAuthAndRender', () => {
        it('should set user data and expiry, reset idle timer, and start refresh check on success', async () => {
            const mockUser = { id: 1, username: 'authuser', email: 'test@test.com' };
            const mockExpiry = Date.now() + 3600 * 1000; // 1 hour from now

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ user: mockUser, expiry: mockExpiry }),
            });

            await checkAuthAndRender(mockDashboardMessageDiv);

            expect(global.fetch).toHaveBeenCalledWith(
                `${process.env.API_BASE_URL}/auth/verify-token`,
                expect.objectContaining({ method: 'GET', credentials: 'include' })
            );
            expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
        });

        it('should remove user and redirect to login if unauthorized and not a refresh check', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ msg: 'Unauthorized' }),
            });

            await checkAuthAndRender(mockDashboardMessageDiv, false); // isRefreshCheck = false

            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Session expired or unauthorized. Please log in again.', false);
            expect(setTimeout).toHaveBeenCalledTimes(1); // For the redirect delay
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
        });

        it('should log error but not redirect if unauthorized and it IS a refresh check', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({ msg: 'Unauthorized' }),
            });

            await checkAuthAndRender(mockDashboardMessageDiv, true); // isRefreshCheck = true

            expect(console.log).toHaveBeenCalledWith("Access token expired, and refresh also failed. Not redirecting from checkAuthAndRender.");
            expect(window.localStorage.removeItem).not.toHaveBeenCalled(); // Should not remove user data here
            expect(showMessage).not.toHaveBeenCalled();
        });

        it('should handle network error during authentication check', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Auth network error'));

            await checkAuthAndRender(mockDashboardMessageDiv);

            expect(console.error).toHaveBeenCalledWith('Network error during authentication check:', expect.any(Error));
            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Network error. Could not verify session. Redirecting to login.', false);
        });
    });

    // --- handleAuthError Tests ---
    describe('handleAuthError', () => {
        it('should remove user, show message, redirect and return true for 401 status', () => {
            const mockResponse = { status: 401 };
            const result = handleAuthError(mockResponse);

            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(showMessage).toHaveBeenCalledWith(mockCsvPageModal, 'Session expired or unauthorized. Please log in again.');
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
            expect(result).toBe(true);
        });

        it('should remove user, show message, redirect and return true for 403 status', () => {
            const mockResponse = { status: 403 };
            const result = handleAuthError(mockResponse);

            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(showMessage).toHaveBeenCalledWith(mockCsvPageModal, 'Session expired or unauthorized. Please log in again.');
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
            expect(result).toBe(true);
        });

        it('should return false and not redirect for other status codes', () => {
            const mockResponse = { status: 200 };
            const result = handleAuthError(mockResponse);

            expect(window.localStorage.removeItem).not.toHaveBeenCalled();
            expect(showMessage).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    // --- checkExistingTokenAndRedirect Tests ---
    describe('checkExistingTokenAndRedirect', () => {
        it('should redirect to dashboard if token is valid', async () => {
            global.fetch.mockResolvedValueOnce({ ok: true });

            const result = await checkExistingTokenAndRedirect();

            expect(global.fetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/auth/verify-token`,
                expect.objectContaining({ method: 'GET', credentials: 'include' })
            );
            expect(console.log).toHaveBeenCalledWith('User already logged in, redirecting to dashboard...');
            expect(result).toBe(true);
        });

        it('should remove user from localStorage and return false if token is invalid', async () => {
            global.fetch.mockResolvedValueOnce({ ok: false });

            const result = await checkExistingTokenAndRedirect();

            expect(global.fetch).toHaveBeenCalled();
            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(console.log).toHaveBeenCalledWith('Session expired or invalid, user must log in.');
            expect(result).toBe(false);
        });

        it('should remove user from localStorage and return false on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error during token check'));

            const result = await checkExistingTokenAndRedirect();

            expect(global.fetch).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Error verifying token:', expect.any(Error));
            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(result).toBe(false);
        });
    });
});