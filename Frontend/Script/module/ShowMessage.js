function showMessage(elementId, message, isSuccess = false) {
    // const msgElement = document.getElementById(elementId);
    // if (msgElement) {
    //     msgElement.textContent = message;
    //     msgElement.className = `message ${isSuccess ? 'success-message' : 'error-message'}`;
    //     msgElement.style.display = 'block';
    // }
    console.log(message);
}

function hideMessage(elementId) {
    // const msgElement = document.getElementById(elementId);
    // if (msgElement) {
    //     msgElement.style.display = 'none';
    //     msgElement.textContent = '';
    // }
    console.log("hide pop up");
}

export { showMessage, hideMessage };