import { showMessage, hideMessage } from "../ShowMessage.js";
import { filterManager } from '../Filter.js';
import { handleAuthError } from "../Auth/HandleLogin.js";

const API_BASE_URL = '/api';

const messageArea = document.getElementById('csv-page-modal');
const loadingSpinner = document.getElementById('loading-spinner');

function showLoadingSpinner() {
    loadingSpinner.style.display = 'block';
}

function hideLoadingSpinner() {
    loadingSpinner.style.display = 'none';
}

async function fetchDatasetDetails(datasetId) {
    hideMessage(messageArea);
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}`);

        if (handleAuthError(response)) return null;

        const data = await response.json();

        if (!response.ok) {
            showMessage(messageArea, `Error fetching dataset details: ${data.msg || response.statusText}`);
            return null;
        }

        return data.dataset;

    } catch (error) {
        console.error('Network error fetching dataset:', error);
        showMessage(messageArea, 'Error fetching dataset.');
        return null;
    } finally {
        hideLoadingSpinner();
    }
}

async function fetchDatasetRows(datasetId, page, limit) {
    hideMessage(messageArea);
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    try {
        const queryParams = new URLSearchParams({
            page: page,
            limit: limit
        });

        // Add filters
        const filters = filterManager.getFilters();
        if (Object.keys(filters).length > 0) {
            queryParams.append('filters', JSON.stringify(filters));
        }

        // Add sorts - now supports multiple
        const sorts = filterManager.getSorts();
        if (sorts.length > 0) {
            queryParams.append('sortBy', sorts.map(sort => sort.column).join(','));
            queryParams.append('sortOrder', sorts.map(sort => sort.direction).join(','));
        }

        const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/rows?${queryParams.toString()}`);

        if (handleAuthError(response)) return null;

        if (!response.ok) {
            const errorData = await response.json();
            showMessage(messageArea, `Error fetching dataset rows: ${errorData.msg || response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Network error fetching dataset rows:', error);
        showMessage(messageArea, 'Error fetching dataset rows.');
        return null;
    } finally {
        hideLoadingSpinner();
    }
}

async function fetchDatasetNullRows(datasetId) {
    hideMessage(messageArea);
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/null-rows`);

        if (handleAuthError(response)) return null;

        if (!response.ok) {
            const errorData = await response.json();
            showMessage(messageArea, `Error fetching null rows: ${errorData.msg || response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Network error fetching null rows:', error);
        showMessage(messageArea, 'Error fetching null rows.');
        return null;
    } finally {
        hideLoadingSpinner();
    }
}

export { fetchDatasetDetails, fetchDatasetRows, fetchDatasetNullRows };