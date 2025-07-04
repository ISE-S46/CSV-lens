import { formatTimestamp } from "./getCSVlist.js";
import { populateColumnDropdowns } from "../FilterUI.js";
import { showMessage } from "../ShowMessage.js";
import { initGraph } from "../Graph.js";

const CSVname = document.getElementById('CSV-name');
const metaName = document.getElementById('meta-name');
const metaDescription = document.getElementById('meta-description');
const metaRows = document.getElementById('meta-rows');
const metaDate = document.getElementById('meta-date');
const messageArea = document.getElementById('csv-page-modal');

let columnsInfo = [];

function renderDatasetMetadata(dataset) {
    CSVname.textContent = dataset.csv_name;
    metaName.textContent = dataset.original_filename;
    metaDescription.textContent = dataset.description || 'No description provided.';
    metaRows.textContent = dataset.row_count;
    metaDate.textContent = formatTimestamp(dataset.upload_date);
    columnsInfo = dataset.columns.sort((a, b) => a.column_order - b.column_order);

    populateColumnDropdowns(columnsInfo);

    initGraph(columnsInfo, dataset.csv_name);
}

function updateColumnsInfo(newColumnsInfo, csv_name) {
    columnsInfo = newColumnsInfo;
    populateColumnDropdowns(columnsInfo);
    initGraph(columnsInfo, csv_name);
}

const csvTableHeaderRow = document.getElementById('table-header-row');
const csvTableBody = document.getElementById('table-body');

function renderTable(rows) {
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
        th.dataset.columnName = col.column_name;
        th.dataset.columnType = col.column_type;
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
        tr.dataset.rowNumber = rowData.row_number;

        columnsInfo.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800 border-t border-gray-200';
            td.dataset.columnName = col.column_name;
            td.dataset.columnType = col.column_type;
            let cellValue = rowData.row_data[col.column_name];

            if (col.column_type === 'date' || col.column_type === 'timestamp') {
                try {
                    td.dataset.originalValue = cellValue;
                    cellValue = cellValue;
                } catch (e) {
                    cellValue = cellValue;
                }
            } else if (col.column_type === true) {
                td.dataset.originalValue = cellValue;
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

let isNullRowsTableVisible = true; // Initial state: null rows table is hidden

function renderNullTable(nullRows) {
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
        th.dataset.columnName = col.column_name;
        th.dataset.columnType = col.column_type;
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
        tr.dataset.rowNumber = rowData.row_number;

        columnsInfo.forEach(col => {
            const td = document.createElement('td');
            td.className = 'px-6 py-4 whitespace-nowrap text-sm border-t border-gray-200';
            td.dataset.columnName = col.column_name;
            td.dataset.columnType = col.column_type;
            let cellValue = rowData.row_data[col.column_name];

            // Highlight null/empty values specifically for the null table
            if (cellValue === null || cellValue === undefined || cellValue === '' || String(cellValue).toLowerCase() === 'null') {
                td.textContent = 'NULL';
                td.classList.add('text-red-600', 'font-semibold', 'bg-red-50');
            } else {
                if (col.column_type === 'date' || col.column_type === 'timestamp') {
                    try {
                        cellValue = cellValue;
                    } catch (e) {
                        cellValue = cellValue;
                    }
                } else if (col.column_type === true) {
                    cellValue = cellValue ? 'True' : 'False';
                }
                td.textContent = cellValue;
                td.classList.add('text-gray-800');
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

export {
    renderDatasetMetadata,
    renderTable,
    renderNullTable,
    toggleNullRowsDisplay,
    updateColumnsInfo
};