import { showMessage } from "../ShowMessage.js";
import { renderCSVlist } from "./getCSVlist.js";
import { API_BASE_URL } from "../../../config.js";

let selectedFile = null;

function getFileElements() {
    return {
        fileInfo: document.getElementById('fileInfo'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        fileInput: document.getElementById('fileInput'),
        processBtn: document.getElementById('processBtn'),
        errorMessage: document.getElementById('errorMessage'),
        errorText: document.getElementById('errorText')
    };
}

function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('Please select a CSV file.');
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showError('File size must be less than 20MB.');
        return;
    }

    selectedFile = file;
    displayFileInfo(file);
    hideError();
}

function displayFileInfo(file) {
    const { fileInfo, fileName, fileSize, processBtn } = getFileElements();
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    processBtn.classList.remove('hidden');
}

function clearFile() {
    const { fileInfo, fileInput, processBtn } = getFileElements();
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    processBtn.classList.add('hidden');
    hideError();
}

function showError(message) {
    const { errorText, errorMessage } = getFileElements();
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    const { errorMessage } = getFileElements();
    errorMessage.classList.add('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.floor((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function processCSV() {
    const dashboardMessageDiv = document.querySelector('#Main-page-modal');

    if (!selectedFile) {
        showMessage(dashboardMessageDiv, 'No file selected', false);
        return;
    }

    const formData = new FormData();
    formData.append('csvName', selectedFile.name);
    formData.append('description', selectedFile.type);
    formData.append('csvFile', selectedFile);

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/upload`, {
            method: 'POST',
            body: formData
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            showMessage(dashboardMessageDiv, `Upload failed, ${data.msg}`, false);
        }

        showMessage(dashboardMessageDiv, 'Upload CSV file successfully', true);
        renderCSVlist();

    } catch (error) {
        console.error('Upload error:', error);
        showMessage(dashboardMessageDiv, 'Network error. Please try again later.', false);
    }
}

export { handleFile, clearFile, processCSV, formatFileSize };