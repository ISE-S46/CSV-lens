function showMessage(elementId, message, isSuccess = false) {
    // const msgElement = document.getElementById(elementId);
    // if (msgElement) {
    //     msgElement.textContent = message;
    //     msgElement.className = `message ${isSuccess ? 'success-message' : 'error-message'}`;
    //     msgElement.style.display = 'block';
    // }
    alert(message);
}

function hideMessage(elementId) {
    // const msgElement = document.getElementById(elementId);
    // if (msgElement) {
    //     msgElement.style.display = 'none';
    //     msgElement.textContent = '';
    // }
    console.log("will add another message pop up later");
}

export { showMessage, hideMessage };