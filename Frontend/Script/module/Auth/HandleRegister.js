import { showMessage } from "../ShowMessage.js";
import { API_BASE_URL } from "../../../config.js";

async function handleRegister(event) {
    event.preventDefault();

    const RegisterEmail = document.getElementById('registerEmail');
    const RegisterUser = document.getElementById('registerUsername');
    const registerPassword = document.getElementById('registerPassword');
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');

    const registerMessageDiv = document.getElementById('Register-modal');

    const email = RegisterEmail.value;
    const username = RegisterUser.value;
    const password = registerPassword.value;
    const confirmPassword = registerConfirmPassword.value;

    if (!email || !password || !username || !confirmPassword) {
        showMessage(registerMessageDiv, 'Please enter all credentials.', false);
        return;
    }

    if (password !== confirmPassword) {
        showMessage(registerMessageDiv, 'Passwords do not match.', false);
        return;
    }

    try {

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(registerMessageDiv, 'Register successful!', true);
            window.location.href = '/login';
        } else {
            showMessage(registerMessageDiv, `Register failed, ${data.msg}`, false);
        }
    } catch (error) {
        console.error('Register error:', error);
        showMessage(registerMessageDiv, 'Network error. Please try again later.', false);
    }
}

export { handleRegister };