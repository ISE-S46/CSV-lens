import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../../../Frontend/config.js');
const showMsgPath = path.join(__dirname, '../../../Frontend/Script/module/ShowMessage.js');

// Mock showMessage modules
jest.unstable_mockModule(showMsgPath, () => ({
    showMessage: jest.fn(),
}));

// Await the real module AFTER the mocks are declared
const { handleRegister } = await import('../../../Frontend/Script/module/Auth/HandleRegister.js');
const { handleLogin, handleLogout } = await import('../../../Frontend/Script/module/Auth/HandleSession.js');

const { API_BASE_URL } = await import(configPath);
const { showMessage } = await import(showMsgPath);

test('uses mocked API_BASE_URL', () => {
    expect(API_BASE_URL).toBe('/api'); // or other custom api endpoint
});

describe('Auth Module Frontend Tests', () => {
    let mockRegisterEmail, mockRegisterUsername, mockRegisterPassword, mockRegisterConfirmPassword;
    let mockRegisterMessageDiv;
    let mockLoginEmail, mockLoginPassword, mockLoginMessageDiv;
    let mockDashboardMessageDiv;
    let mockCsvPageModal;

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
        jest.spyOn(console, 'error').mockImplementation(() => {});
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

    // --- handleRegister Tests ---
    describe('handleRegister', () => {
        it('should show error if any field is empty', async () => {
            mockRegisterEmail.value = '';
            mockRegisterUsername.value = 'testuser';
            mockRegisterPassword.value = 'password';
            mockRegisterConfirmPassword.value = 'password';

            await handleRegister({ preventDefault: jest.fn() });

            expect(showMessage).toHaveBeenCalledWith(mockRegisterMessageDiv, 'Please enter all credentials.', false);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should show error if passwords do not match', async () => {
            mockRegisterEmail.value = 'test@example.com';
            mockRegisterUsername.value = 'testuser';
            mockRegisterPassword.value = 'password123';
            mockRegisterConfirmPassword.value = 'password456';

            await handleRegister({ preventDefault: jest.fn() });

            expect(showMessage).toHaveBeenCalledWith(mockRegisterMessageDiv, 'Passwords do not match.', false);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should register successfully', async () => {
            mockRegisterEmail.value = 'test@example.com';
            mockRegisterUsername.value = 'testuser';
            mockRegisterPassword.value = 'password123';
            mockRegisterConfirmPassword.value = 'password123';

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ msg: 'Registration successful' }),
            });

            await handleRegister({ preventDefault: jest.fn() });

            expect(global.fetch).toHaveBeenCalledWith(
                `${process.env.API_BASE_URL}/auth/register`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'testuser', email: 'test@example.com', password: 'password123' }),
                })
            );
            expect(showMessage).toHaveBeenCalledWith(mockRegisterMessageDiv, 'Register successful!', true);
        });

        it('should show error message on registration failure (API returns !ok)', async () => {
            mockRegisterEmail.value = 'test@example.com';
            mockRegisterUsername.value = 'testuser';
            mockRegisterPassword.value = 'password123';
            mockRegisterConfirmPassword.value = 'password123';

            global.fetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ msg: 'User already exists' }),
                status: 400 // Example status code
            });

            await handleRegister({ preventDefault: jest.fn() });

            expect(global.fetch).toHaveBeenCalled();
            expect(showMessage).toHaveBeenCalledWith(mockRegisterMessageDiv, 'Register failed, User already exists', false);
        });

        it('should show network error message on fetch failure', async () => {
            mockRegisterEmail.value = 'test@example.com';
            mockRegisterUsername.value = 'testuser';
            mockRegisterPassword.value = 'password123';
            mockRegisterConfirmPassword.value = 'password123';

            global.fetch.mockRejectedValueOnce(new Error('Network Down'));

            await handleRegister({ preventDefault: jest.fn() });

            expect(global.fetch).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Register error:', expect.any(Error)); // Check console error
            expect(showMessage).toHaveBeenCalledWith(mockRegisterMessageDiv, 'Network error. Please try again later.', false);
        });
    });

    // --- handleLogin Tests ---
    describe('handleLogin', () => {
        it('should show error if email or password is empty', async () => {
            mockLoginEmail.value = '';
            mockLoginPassword.value = 'password';

            await handleLogin({ preventDefault: jest.fn() });

            expect(showMessage).toHaveBeenCalledWith(mockLoginMessageDiv, 'Please enter both email and password.', false);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should login successfully and store user data', async () => {
            mockLoginEmail.value = 'test@example.com';
            mockLoginPassword.value = 'password123';
            const mockUser = { user_id: 1, username: 'testuser', email: 'test@example.com' };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ user: mockUser, msg: 'Login successful' }),
            });

            await handleLogin({ preventDefault: jest.fn() });

            expect(global.fetch).toHaveBeenCalledWith(
                `${process.env.API_BASE_URL}/auth/login`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
                })
            );
            expect(window.localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
            expect(showMessage).toHaveBeenCalledWith(mockLoginMessageDiv, 'Login successful! Redirecting...', true);
        });

        it('should show error message on login failure (API returns !ok)', async () => {
            mockLoginEmail.value = 'wrong@example.com';
            mockLoginPassword.value = 'wrongpass';

            global.fetch.mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ msg: 'Invalid credentials' }),
                status: 401
            });

            await handleLogin({ preventDefault: jest.fn() });

            expect(global.fetch).toHaveBeenCalled();
            expect(window.localStorage.setItem).not.toHaveBeenCalled();
            expect(showMessage).toHaveBeenCalledWith(mockLoginMessageDiv, 'Login failed, Invalid credentials.', false);
        });

        it('should show network error message on fetch failure', async () => {
            mockLoginEmail.value = 'test@example.com';
            mockLoginPassword.value = 'password123';

            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            await handleLogin({ preventDefault: jest.fn() });

            expect(global.fetch).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Login error:', expect.any(Error));
            expect(showMessage).toHaveBeenCalledWith(mockLoginMessageDiv, 'Network error. Please try again later.', false);
        });
    });

    // --- handleLogout Tests ---
    describe('handleLogout', () => {
        it('should clear local storage, show message, and redirect to login', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ msg: 'Logged out successfully' }),
            });

            await handleLogout(mockDashboardMessageDiv);

            expect(global.fetch).toHaveBeenCalledWith(
                `${process.env.API_BASE_URL}/auth/logout`,
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                })
            );
            expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
            expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Session expired, Logged out successfully', false);
        });

        it('should handle network error during logout', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Logout network error'));

            await handleLogout(mockDashboardMessageDiv);

            expect(global.fetch).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith('Logout error:', expect.any(Error));
            expect(showMessage).toHaveBeenCalledWith(mockDashboardMessageDiv, 'Logout error: Error: Logout network error', false);
        });
    });
});