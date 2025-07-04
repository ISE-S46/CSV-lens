import { showMessage } from "../ShowMessage.js";
import { API_BASE_URL } from "../../../config.js";

async function handleLogin(event) {
    event.preventDefault();

    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginMessageDiv = document.querySelector('#login-modal');

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
        showMessage(loginMessageDiv, 'Please enter both email and password.', false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage(loginMessageDiv, 'Login successful! Redirecting...', true);
            window.location.href = '/';
        } else {
            showMessage(loginMessageDiv, `Login failed, ${data.msg}.`, false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage(loginMessageDiv, 'Network error. Please try again later.', false);
    }
}

async function handleLogout(dashboardMessageDiv) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        const data = await response.json();
        showMessage(dashboardMessageDiv, `Session expired, ${data.msg}`, false);
        localStorage.removeItem('user');

        window.location.href = '/login';
    } catch (err) {
        console.error('Logout error:', err);
        showMessage(dashboardMessageDiv, `Logout error: ${err}`, false);
    }
}

const MAX_IDLE_LIMIT = 2 * 60 * 60 * 1000;
const REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // Try to refresh 15 minutes before access token expires

let idleTimer;
let lastActivityTime = Date.now();
let accessTokenExpiryTime = null;

async function refreshAccessToken() {
    console.log('Attempting to refresh access token...');
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Access token refreshed successfully.');
            localStorage.setItem('user', JSON.stringify(data.user)); // Update user data if it changed
            await checkAuthAndRender(true); // Re-run auth check to update expiry, but don't redirect if valid
        } else {
            console.error('Refresh token failed. Forcing full logout.');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Network error during token refresh:', error);
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
}

function resetIdleTimer() {
    lastActivityTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(handleLogout, MAX_IDLE_LIMIT);
}

let refreshCheckInterval;

function startTokenRefreshCheck() {
    if (refreshCheckInterval) clearInterval(refreshCheckInterval);

    refreshCheckInterval = setInterval(() => {
        const now = Date.now();
        if (accessTokenExpiryTime && (accessTokenExpiryTime - now < REFRESH_THRESHOLD_MS) && (now - lastActivityTime < MAX_IDLE_LIMIT)) {
            refreshAccessToken();
        }
    }, REFRESH_THRESHOLD_MS / 2);
}

async function checkAuthAndRender(dashboardMessageDiv, isRefreshCheck = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok && !isRefreshCheck) {
            localStorage.removeItem('user');
            showMessage(dashboardMessageDiv, 'Session expired or unauthorized. Please log in again.', false);
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
            return;
        } else if (!response.ok && isRefreshCheck) {
            console.log("Access token expired, and refresh also failed. Not redirecting from checkAuthAndRender.");
            return;
        }

        // Access token is valid.
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));

        if (!accessTokenExpiryTime) {
            accessTokenExpiryTime = data.expiry;
        }

        resetIdleTimer();
        startTokenRefreshCheck();

    } catch (error) {
        console.error('Network error during authentication check:', error);
        localStorage.removeItem('user');
        showMessage(dashboardMessageDiv, 'Network error. Could not verify session. Redirecting to login.', false);
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }
}

function handleAuthError(response) {
    const messageArea = document.getElementById('csv-page-modal');

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('user');
        showMessage(messageArea, 'Session expired or unauthorized. Please log in again.');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        return true;
    }
    return false;
}

async function checkExistingTokenAndRedirect() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            console.log('User already logged in, redirecting to dashboard...');
            window.location.href = '/';
            return true;
        } else {
            localStorage.removeItem('user');
            console.log('Session expired or invalid, user must log in.');
        }
    } catch (error) {
        console.error('Error verifying token:', error);
        localStorage.removeItem('user');
    }
    return false;
}

export {
    handleLogin,
    handleLogout,
    checkAuthAndRender,
    handleAuthError,
    checkExistingTokenAndRedirect,
    resetIdleTimer
};