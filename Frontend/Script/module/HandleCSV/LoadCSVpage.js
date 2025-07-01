import { showMessage } from "../ShowMessage.js";
import { updateTotalPages } from '../PageInput.js';
import { updateFilterUI } from "../FilterUI.js";
import { filterManager } from '../Filter.js';
import { setGraphData } from "../Graph.js";
import { setupCellEditing } from "./EditCSV.js";
import { 
    fetchDatasetDetails, 
    fetchDatasetRows, 
    fetchDatasetGraph, 
    fetchDatasetNullRows 
} from "./FetchCSV.js";

import { 
    renderDatasetMetadata, 
    renderTable, 
    renderNullTable, 
    toggleNullRowsDisplay
} from "./RenderCSVrows.js";

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
} from '../Pagination.js';

let currentDatasetId = null;
const rowsPerPage = 50; // Api default is 50 but adjustable here as well

const messageArea = document.getElementById('csv-page-modal');

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

        toggleNullRowsDisplay();

        nullRowsMessage.classList.remove('hidden');

    } else {
        dataQualityCheckSection.classList.add('hidden');
    }

    // Get initial page from URL
    const initialPage = getPageFromUrl();
    setCurrentPage(initialPage);

    updateUrlWithPage(initialPage, false);

    setupCellEditing(currentDatasetId, async () => {
        await loadCurrentPageRows(false);
    }, datasetDetails.columns);

    await loadCurrentPageRows(false); // Don't update URL again
    await loadGraphData();

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
        await loadGraphData();
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

async function loadGraphData() {
    const GraphResponse = await fetchDatasetGraph(currentDatasetId);
    if (GraphResponse && GraphResponse.data) {
        // console.log(GraphResponse.data)
        setGraphData(GraphResponse.data);
    }
}

export { loadDatasetPage, loadCurrentPageRows, loadGraphData };