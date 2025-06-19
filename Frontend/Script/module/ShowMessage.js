function showMessage(Modal, message, isSuccess = false) {
    document.getElementById('modal-message').textContent = message || 'Default message';

    if (Modal) {
        Modal.classList.remove('hidden');
        Modal.classList.add('flex');
        Modal.className = `message ${isSuccess ? 'success-message' : 'error-message'}`;
    }

}

function hideMessage(Modal) {
    if (Modal) {
        Modal.classList.add('hidden');
        Modal.classList.remove('flex');
    }

}

export { showMessage, hideMessage };