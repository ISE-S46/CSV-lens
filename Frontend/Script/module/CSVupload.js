import { showMessage, hideMessage } from "./ShowMessage.js";
import { renderCSVlist } from "./getCSVlist.js";

let selectedFile = null;

const API_BASE_URL = '/api';

function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('Please select a CSV file.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showError('File size must be less than 10MB.');
        return;
    }

    selectedFile = file;
    displayFileInfo(file);
    hideError();
}

const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileInput = document.getElementById('fileInput');

const processBtn = document.getElementById('processBtn');

function displayFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    processBtn.classList.remove('hidden');
}

function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    processBtn.classList.add('hidden');
    hideError();
}

const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function processCSV() {
    const dashboardMessageDiv = document.querySelector('#Main-page-modal');

    hideMessage(dashboardMessageDiv);

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
            showMessage(dashboardMessageDiv,`Upload failed, ${data.msg}`, false);
        } 

        showMessage(dashboardMessageDiv, 'Upload CSV file successfully', true);
        renderCSVlist();

    } catch (error) {
        console.error('Upload error:', error);
        showMessage(dashboardMessageDiv, 'Network error. Please try again later.', false);
    }
}

export { handleFile, clearFile, processCSV, formatFileSize };