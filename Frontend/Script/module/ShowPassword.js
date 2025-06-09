function TogglePasswordIcon(passwordInput, showIcon, hideIcon) {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

    showIcon.classList.toggle('hidden', !isPassword);
    hideIcon.classList.toggle('hidden', isPassword);

}

export { TogglePasswordIcon };