import { filterManager } from './Filter.js';
import { loadCurrentPageRows, loadGraphData } from './HandleCSV/LoadCSVpage.js';
import { getCurrentPage } from './Pagination.js';

const filterBuilder = document.getElementById('filter-builder');
const sortBuilder = document.getElementById('sort-builder');
const copyFilterUrl = document.getElementById('copy-filter-url');

// Function to update URL with current state
function updateURLWithFilters() {
    const params = new URLSearchParams();
    const state = filterManager.getState();

    // Add filters
    if (Object.keys(state.filters).length > 0) {
        params.set('filters', JSON.stringify(state.filters));
    }

    // Add sorts
    if (state.sorts.length > 0) {
        params.set('sortBy', state.sorts.map(s => s.column).join(','));
        params.set('sortOrder', state.sorts.map(s => s.direction).join(','));
    }

    // Add page
    const currentPage = getCurrentPage();
    if (currentPage > 1) {
        params.set('page', currentPage);
    }

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newURL);
}

// Filter Functions
function addFilterRow() {
    const newRow = document.querySelector('.filter-row').cloneNode(true);
    newRow.querySelector('.filter-column').value = '';
    newRow.querySelector('.filter-operator').value = '=';
    newRow.querySelector('.filter-value').value = '';

    // Change add button to remove button
    const button = newRow.querySelector('.add-filter');
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
        </svg>
    `;
    button.className = 'remove-filter-row bg-red-100 hover:bg-red-200 text-red-700 p-1 rounded-md';

    // Add click handler for the remove button
    button.addEventListener('click', () => {
        newRow.remove();
        applyFilters();
    });

    filterBuilder.appendChild(newRow);
}

function applyFilters() {
    const filterRows = document.querySelectorAll('.filter-row');
    filterManager.clearFilters();

    filterRows.forEach(row => {
        const column = row.querySelector('.filter-column').value;
        const operator = row.querySelector('.filter-operator').value;
        const value = row.querySelector('.filter-value').value;

        if (column && operator && value !== '') {
            filterManager.addFilter(column, operator, value);
        }
    });

    loadCurrentPageRows();
    loadGraphData();
    updateURLWithFilters();
}

function clearFilters() {
    filterManager.clearFilters();
    resetFilterUI();
    loadCurrentPageRows();
    loadGraphData();
    updateURLWithFilters();
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

function resetFilterUI() {
    // Reset filter UI
    const filterRows = document.querySelectorAll('.filter-row');
    for (let i = 1; i < filterRows.length; i++) {
        filterRows[i].remove();
    }
    const firstFilterRow = filterRows[0];
    firstFilterRow.querySelector('.filter-column').value = '';
    firstFilterRow.querySelector('.filter-operator').value = '=';
    firstFilterRow.querySelector('.filter-value').value = '';

    // Reset sort UI
    const sortRows = document.querySelectorAll('.sort-row');
    for (let i = 1; i < sortRows.length; i++) {
        sortRows[i].remove();
    }
    const firstSortRow = sortRows[0];
    firstSortRow.querySelector('.sort-column').value = '';
    firstSortRow.querySelector('.sort-direction').value = 'ASC';
}

// Sort Functions
function addSortRow() {
    const sortRowTemplate = document.querySelector('.sort-row');
    const newRow = sortRowTemplate.cloneNode(true);
    newRow.querySelector('.sort-column').value = '';
    newRow.querySelector('.sort-direction').value = 'ASC';

    // Change add button to remove button
    const button = newRow.querySelector('.add-sort');
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
        </svg>
    `;
    button.className = 'remove-sort-row bg-red-100 hover:bg-red-200 text-red-700 p-1 rounded-md';

    // Add click handler for the remove button
    button.addEventListener('click', () => {
        newRow.remove();
        applySorts();
    });

    sortBuilder.appendChild(newRow);
}

function applySorts() {
    const sortRows = document.querySelectorAll('.sort-row');
    filterManager.clearSorts();

    sortRows.forEach(row => {
        const column = row.querySelector('.sort-column').value;
        const direction = row.querySelector('.sort-direction').value;

        if (column) {
            filterManager.addSort(column, direction);
        }
    });

    loadCurrentPageRows();
    loadGraphData();
    updateURLWithFilters();
}

function clearSorts() {
    filterManager.clearSorts();
    resetFilterUI();
    loadCurrentPageRows();
    loadGraphData();
    updateURLWithFilters();
}

// URL Functions
function copyFilterUrlToClipboard() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const originalText = copyFilterUrl.textContent;
        copyFilterUrl.textContent = 'Copied!';

        setTimeout(() => {
            copyFilterUrl.textContent = originalText;
        }, 2000);
    });
}

function populateColumnDropdowns(columnsInfo) {
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

function getFilterUIEventHandlers() {
    return {
        addFilterRow,
        applyFilters,
        clearFilters,
        addSortRow,
        applySorts,
        clearSorts,
        copyFilterUrlToClipboard
    };
}

export { getFilterUIEventHandlers, resetFilterUI, updateFilterUI, populateColumnDropdowns };