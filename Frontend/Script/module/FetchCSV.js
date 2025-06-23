import { showMessage, hideMessage } from "./ShowMessage.js";
import { formatTimestamp } from "./getCSVlist.js";
import { updateTotalPages } from './PageInput.js';
import {
    getCurrentPage,
    setCurrentPage,
    setTotalPages,
    resetPagination,
    updatePaginationDisplay,
    bindPaginationButtons,
    getPageFromUrl,
    updateUrlWithPage,
    handlePopstate
} from './Pagination.js';
import { filterManager } from './Filter.js';
import { resetFilterUI } from "./FilterUI.js";

const API_BASE_URL = '/api';

let currentDatasetId = null;
const rowsPerPage = 50; // Api default is 50 but adjustable here as well
let columnsInfo = [];

const messageArea = document.getElementById('csv-page-modal');
const loadingSpinner = document.getElementById('loading-spinner');

function showLoadingSpinner() {
    loadingSpinner.style.display = 'block';
}

function hideLoadingSpinner() {
    loadingSpinner.style.display = 'none';
}

function handleAuthError(response) {
    hideMessage(messageArea);
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showMessage(messageArea, 'Session expired or unauthorized. Please log in again.');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        return true;
    }
    return false;
}

// --- Data Fetching Functions ---

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

// --- Rendering Functions ---
const CSVname = document.getElementById('CSV-name');
const metaName = document.getElementById('meta-name');
const metaDescription = document.getElementById('meta-description');
const metaRows = document.getElementById('meta-rows');
const metaDate = document.getElementById('meta-date');

function renderDatasetMetadata(dataset) {
    CSVname.textContent = dataset.csv_name;
    metaName.textContent = dataset.original_filename;
    metaDescription.textContent = dataset.description || 'No description provided.';
    metaRows.textContent = dataset.row_count;
    metaDate.textContent = formatTimestamp(dataset.upload_date);
    columnsInfo = dataset.columns.sort((a, b) => a.column_order - b.column_order);

    // Populate column dropdowns
    populateColumnDropdowns();
}

function populateColumnDropdowns() {
    if (!columnsInfo || columnsInfo.length === 0) return;

    const columnNames = columnsInfo.map(col => col.column_name);

    // Populate filter column dropdowns
    const filterDropdowns = document.querySelectorAll('.filter-column');
    filterDropdowns.forEach(select => {
        // Clear existing options except the first
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add new options
        columnNames.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });
    });

    // Populate sort column dropdown
    const sortDropdown = document.getElementById('sort-column');
    while (sortDropdown.options.length > 1) {
        sortDropdown.remove(1);
    }
    columnNames.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        sortDropdown.appendChild(option);
    });
}

const csvTableHeaderRow = document.getElementById('table-header-row');
const csvTableBody = document.getElementById('table-body');

function renderTable(rows) {
    hideMessage(messageArea);
    csvTableHeaderRow.innerHTML = '';
    csvTableBody.innerHTML = '';

    if (columnsInfo.length === 0) {
        showMessage(messageArea, 'No column information found for this dataset.');
        return;
    }

    if (rows.length === 0) {
        showMessage(messageArea, 'No data available for this page with current filters/sorts.');
        return;
    }

    // Render table headers
    columnsInfo.forEach(col => {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg';
        if (col.column_order === columnsInfo.length) {
            th.classList.add('rounded-tr-lg');
        }
        th.textContent = col.column_name;
        csvTableHeaderRow.appendChild(th);
    });

    // Render table rows
    rows.forEach(rowData => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        columnsInfo.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800 border-t border-gray-200';
            let cellValue = rowData[col.column_name];

            if (col.column_type === 'date' || col.column_type === 'timestamp') {
                try {
                    cellValue = cellValue ? new Date(cellValue).toLocaleDateString() : '';
                } catch (e) {
                    cellValue = cellValue;
                }
            } else if (col.column_type === true) {
                cellValue = cellValue ? 'True' : 'False';
            } else if (cellValue === null || cellValue === undefined || cellValue === '') {
                cellValue = 'N/A';
            }

            td.textContent = cellValue;
            tr.appendChild(td);
        });
        csvTableBody.appendChild(tr);
    });
}

const nullCsvTableHeaderRow = document.getElementById('null-table-header-row');
const nullCsvTableBody = document.getElementById('null-table-body');

let isNullRowsTableVisible = false; // Initial state: null rows table is hidden

function renderNullTable(nullRows) {
    hideMessage(messageArea);

    nullCsvTableHeaderRow.innerHTML = '';
    nullCsvTableBody.innerHTML = '';

    if (columnsInfo.length === 0) {
        showMessage(messageArea, 'No column information found for null rows table.');
        return;
    }

    // Render null table headers (same as main table headers)
    columnsInfo.forEach(col => {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-lg';
        if (col.column_order === columnsInfo.length) {
            th.classList.add('rounded-tr-lg');
        }
        th.textContent = col.column_name;
        nullCsvTableHeaderRow.appendChild(th);
    });

    // Render null table rows
    nullRows.forEach(rowData => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        columnsInfo.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm border-t border-gray-200';
            let cellValue = rowData[col.column_name];

            // Highlight null/empty values specifically for the null table
            if (cellValue === null || cellValue === undefined || cellValue === '' || String(cellValue).toLowerCase() === 'null') {
                td.textContent = 'NULL'; // Display 'NULL' prominently
                td.classList.add('text-red-600', 'font-semibold');
            } else {
                // Apply type handling for non-null values
                if (col.column_type === 'date' || col.column_type === 'timestamp') {
                    try {
                        cellValue = new Date(cellValue).toLocaleDateString();
                    } catch (e) {
                        cellValue = cellValue;
                    }
                } else if (col.column_type === 'boolean') {
                    cellValue = cellValue ? 'True' : 'False';
                }
                td.textContent = cellValue;
                td.classList.add('text-gray-800'); // Regular color for non-null
            }
            tr.appendChild(td);
        });
        nullCsvTableBody.appendChild(tr);
    });
}

const hideNullRowsBtn = document.getElementById('hide-null-rows-btn');
const nullCsvTableContainer = document.getElementById('null-csv-table');

function toggleNullRowsDisplay() {
    isNullRowsTableVisible = !isNullRowsTableVisible;
    if (isNullRowsTableVisible) {
        nullCsvTableContainer.classList.remove('hidden');
        hideNullRowsBtn.textContent = 'Hide Null Rows';
    } else {
        nullCsvTableContainer.classList.add('hidden');
        hideNullRowsBtn.textContent = 'Show Null Rows';
    }
}

// --- Main Page Load Logic ---

function parseURLParameters() {
    const params = new URLSearchParams(window.location.search);
    const state = {};

    // Parse filters
    if (params.has('filters')) {
        try {
            state.filters = JSON.parse(params.get('filters'));
        } catch (e) {
            console.error('Error parsing filters from URL', e);
        }
    }

    // Parse sorts
    if (params.has('sortBy') && params.has('sortOrder')) {
        const sortColumns = params.get('sortBy').split(',');
        const sortDirections = params.get('sortOrder').split(',');

        state.sorts = sortColumns.map((column, index) => ({
            column,
            direction: sortDirections[index] || 'ASC'
        }));
    }

    return state;
}

const dataQualityCheckSection = document.getElementById('data-quality-check');
const nullRowsCountText = document.getElementById('null-rows-count-text');
const nullRowsMessage = document.getElementById('null-rows-message');

async function loadDatasetPage() {
    hideMessage(messageArea);
    const pathSegments = window.location.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];

    if (!id) {
        showMessage(messageArea, 'No dataset ID provided in the URL.');
        return;
    }

    currentDatasetId = parseInt(id, 10);
    if (isNaN(currentDatasetId)) {
        showMessage(messageArea, 'Invalid dataset ID in the URL.');
        return;
    }

    // Reset filters and sort
    filterManager.clearFilters();
    filterManager.clearSorts();

    // Apply URL parameters if they exist
    const urlState = parseURLParameters();

    // Apply filters from URL
    if (urlState.filters) {
        for (const [column, conditions] of Object.entries(urlState.filters)) {
            conditions.forEach(({ operator, value }) => {
                filterManager.addFilter(column, operator, value);
            });
        }
    }

    // Apply sorts from URL
    if (urlState.sorts) {
        urlState.sorts.forEach(({ column, direction }) => {
            filterManager.addSort(column, direction);
        });
    }

    resetPagination();
    const datasetDetails = await fetchDatasetDetails(currentDatasetId);

    if (!datasetDetails) return;

    renderDatasetMetadata(datasetDetails);
    const totalPageCount = Math.ceil(datasetDetails.row_count / rowsPerPage);
    setTotalPages(totalPageCount);
    updateTotalPages(totalPageCount);

    const nullRowsResponse = await fetchDatasetNullRows(currentDatasetId);

    if (nullRowsResponse && nullRowsResponse.count > 0) {
        dataQualityCheckSection.classList.remove('hidden'); // Show the whole section
        nullRowsCountText.textContent = `${nullRowsResponse.count} rows across the dataset contain null or missing values. These may affect your data analysis and visualizations.`;

        renderNullTable(nullRowsResponse.data); // Render the null rows data

        isNullRowsTableVisible = true;
        toggleNullRowsDisplay();

        nullRowsMessage.classList.remove('hidden');

    } else {
        dataQualityCheckSection.classList.add('hidden');
    }

    // Get initial page from URL
    const initialPage = getPageFromUrl();
    setCurrentPage(initialPage);

    updateUrlWithPage(initialPage, false);

    await loadCurrentPageRows(false); // Don't update URL again

    bindPaginationButtons(async (direction) => {
        const newPage = getCurrentPage() + direction;
        const maxPages = Math.ceil(datasetDetails.row_count / rowsPerPage);
        if (newPage >= 1 && newPage <= maxPages) {
            setCurrentPage(newPage);
            await loadCurrentPageRows();
        }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', async () => {
        await handlePopstate();
        // Restore filter/sort state from URL
        const urlState = parseURLParameters();

        // Clear existing state
        filterManager.clearFilters();
        filterManager.clearSorts();

        // Apply filters from URL
        if (urlState.filters) {
            for (const [column, conditions] of Object.entries(urlState.filters)) {
                conditions.forEach(({ operator, value }) => {
                    filterManager.addFilter(column, operator, value);
                });
            }
        }

        // Apply sorts from URL
        if (urlState.sorts) {
            urlState.sorts.forEach(({ column, direction }) => {
                filterManager.addSort(column, direction);
            });
        }

        // Update UI to reflect restored state
        updateFilterUI();
        await loadCurrentPageRows(false);
    });

}

async function loadCurrentPageRows(updateUrl = true) {
    const page = getCurrentPage();

    // Update URL if requested (for programmatic navigation)
    if (updateUrl) {
        updateUrlWithPage(page);
    }

    const dataResponse = await fetchDatasetRows(currentDatasetId, page, rowsPerPage);
    if (dataResponse && dataResponse.data) {
        renderTable(dataResponse.data);
        updatePaginationDisplay(dataResponse.pagination);
    }
}

function updateFilterUI() {

    const filterRows = document.querySelectorAll('.filter-row');
    const sortRows = document.querySelectorAll('.sort-row');

    if (filterRows.length !== 0 || sortRows.length !== 0) {
        resetFilterUI();
    }

    // // Reset first row
    const firstFilterRow = document.querySelector('.filter-row');
    const firstSortRow = document.querySelector('.sort-row');

    // Restore filter UI
    const filters = filterManager.getFilters();
    const filterEntries = Object.entries(filters);

    filterEntries.forEach(([column, conditions], columnIndex) => {
        conditions.forEach((condition, conditionIndex) => {
            if (columnIndex === 0 && conditionIndex === 0) {
                // Update first row
                firstFilterRow.querySelector('.filter-column').value = column;
                firstFilterRow.querySelector('.filter-operator').value = condition.operator;
                firstFilterRow.querySelector('.filter-value').value = condition.value;
            } else {
                // Create new row - simulate click on add button
                document.querySelector('.add-filter').click();
                const rows = document.querySelectorAll('.filter-row');
                const newRow = rows[rows.length - 1];
                newRow.querySelector('.filter-column').value = column;
                newRow.querySelector('.filter-operator').value = condition.operator;
                newRow.querySelector('.filter-value').value = condition.value;
            }
        });
    });

    // Restore sort UI
    const sorts = filterManager.getSorts();
    sorts.forEach((sort, index) => {
        if (index === 0) {
            // Update first sort row
            firstSortRow.querySelector('.sort-column').value = sort.column;
            firstSortRow.querySelector('.sort-direction').value = sort.direction;
        } else {
            // Create new row
            document.querySelector('.add-sort').click();
            const sortRows = document.querySelectorAll('.sort-row');
            const newRow = sortRows[sortRows.length - 1];
            newRow.querySelector('.sort-column').value = sort.column;
            newRow.querySelector('.sort-direction').value = sort.direction;
        }
    });
}

export { loadDatasetPage, loadCurrentPageRows, toggleNullRowsDisplay };