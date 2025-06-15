import { showMessage, hideMessage } from "./ShowMessage.js";

const API_BASE_URL = '/api';

async function handleLogin(event) {
    event.preventDefault();

    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginMessageDiv = document.getElementById('login-message');

    hideMessage(loginMessageDiv);

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
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage(loginMessageDiv, 'Login successful! Redirecting...', true);
            window.location.href = '/';
        } else {
            showMessage(loginMessageDiv, data.msg || 'Login failed. Please check your credentials.', false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage(loginMessageDiv, 'Network error. Please try again later.', false);
    }
}

async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
        const data = await response.json();
        console.log(data.msg);

        localStorage.removeItem('user');

        window.location.href = '/login';
    } catch (err) {
        console.error('Logout error:', err);
    }
}

async function checkAuthAndRender() {
    const token = localStorage.getItem('token');
    const dashboardMessageDiv = document.getElementById('dashboard-message');

    if (!token) {
        // No token found, redirect to login page
        window.location.href = '/login';
        return;
    }

    hideMessage(dashboardMessageDiv);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
            method: 'GET',
            headers: { 'x-auth-token': token }
        });

        if (!response.ok) {
            // Token invalid or expired, force logout and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showMessage(dashboardMessageDiv, 'Session expired. Please log in again.', false);
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
            return;
        }

        console.log('User is authenticated. Loading content...');

    } catch (error) {
        console.error('Error verifying token:', error);
        localStorage.removeItem('token');
        showMessage(dashboardMessageDiv, 'Network error during authentication check. Redirecting to login.', false);
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }
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

export { handleLogin, handleLogout, checkAuthAndRender, checkExistingTokenAndRedirect };