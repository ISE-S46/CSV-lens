import { showMessage } from "../ShowMessage.js";
import { filterManager } from '../Filter.js';
import { handleAuthError } from "../Auth/HandleLogin.js";
import { API_BASE_URL } from "../../../config.js";

const messageArea = document.getElementById('csv-page-modal');
const loadingSpinner = document.getElementById('loading-spinner');

function showLoadingSpinner() {
    loadingSpinner.style.display = 'block';
}

function hideLoadingSpinner() {
    loadingSpinner.style.display = 'none';
}

async function fetchDatasetDetails(datasetId) {
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

function appendFilterAndSortParams(queryParams) {
    const filters = filterManager.getFilters();
    if (Object.keys(filters).length > 0) {
        queryParams.append('filters', JSON.stringify(filters));
    }

    const sorts = filterManager.getSorts();
    if (sorts.length > 0) {
        queryParams.append('sortBy', sorts.map(sort => sort.column).join(','));
        queryParams.append('sortOrder', sorts.map(sort => sort.direction).join(','));
    }
}

async function fetchDatasetRows(datasetId, page, limit) {
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    try {
        const queryParams = new URLSearchParams({ page, limit });

        appendFilterAndSortParams(queryParams);

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

async function fetchDatasetGraph(datasetId) {
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    try {
        const queryParams = new URLSearchParams();
        
        appendFilterAndSortParams(queryParams);

        const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/GraphData?${queryParams.toString()}`);

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

async function fetchSingleRow(datasetId, rowNumber) {
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    datasetId = parseInt(datasetId);
    rowNumber = parseInt(rowNumber);

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/rows/${rowNumber}`);

        if (handleAuthError(response)) return null;

        if (!response.ok) {
            const errorData = await response.json();
            showMessage(messageArea, `Error fetching single row: ${errorData.msg || response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data.row || null;

    } catch (error) {
        console.error('Network error fetching single row:', error);
        showMessage(messageArea, 'Error fetching single row.');
        return null;
    } finally {
        hideLoadingSpinner();
    }
}

async function updateDatasetRow(datasetId, rowNumber, rowData) {
    showLoadingSpinner();
    const token = localStorage.getItem('token');
    if (!token) {
        handleAuthError({ status: 401 });
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/rows/${rowNumber}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(rowData)
        });

        if (handleAuthError(response)) return null;

        const data = await response.json();

        if (!response.ok) {
            showMessage(messageArea, `Error updating row: ${data.msg || response.statusText}`);
            return null;
        }

        showMessage(messageArea, `Row ${rowNumber} updated successfully!`, 'success');
        return data.updatedRow;

    } catch (error) {
        console.error('Network error updating row:', error);
        showMessage(messageArea, 'Network error updating row.');
        return null;
    } finally {
        hideLoadingSpinner();
    }
}

async function updateColumnName(datasetId, oldColumnName, newColumnName) {
    try {
        const response = await fetch(`/api/datasets/${datasetId}/columns/${encodeURIComponent(oldColumnName)}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ newColumnName: newColumnName })
        });

        if (response.ok) {
            console.log(`Column '${oldColumnName}' updated to '${newColumnName}' successfully.`);
            return true;
        } else {
            const errorData = await response.json();
            console.error(`Failed to update column name: ${errorData.message || response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error('Error updating column name:', error);
        return false;
    }
}

export {
    fetchDatasetDetails, 
    fetchDatasetRows, 
    fetchDatasetGraph, 
    fetchDatasetNullRows, 
    updateDatasetRow, 
    fetchSingleRow,
    updateColumnName
};