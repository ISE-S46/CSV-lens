import { updateDatasetRow, fetchSingleRow, fetchDatasetNullRows, updateColumnName } from "./FetchCSV.js";
import { showMessage } from "../ShowMessage.js";
import { renderNullTable, updateColumnsInfo } from "./RenderCSVrows.js";

let currentDatasetIdForEditing = null;
let refreshMainTableFunction = null;
let columnsInfo = [];

const messageArea = document.getElementById('csv-page-modal');

function convertValueForAPI(value, columnType) {
    if (value.toLowerCase() === 'n/a' || value === '' || value === null || value === undefined) {
        return null;
    }
    switch (columnType) {
        case 'integer':
            const intVal = parseInt(value, 10);
            return isNaN(intVal) ? null : intVal;
        case 'float':
            const floatVal = parseFloat(value);
            return isNaN(floatVal) ? null : floatVal;
        case 'boolean':
            return value.toLowerCase() === 'true';
        case 'date':
            try {
                const parsedDate = new Date(value);
                if (isNaN(parsedDate.getTime())) {
                    return value;
                }
                return parsedDate.toISOString().split('T')[0];
            } catch (e) {
                return value;
            }
        case 'timestamp':
            try {
                const parsedDate = new Date(value);
                if (isNaN(parsedDate.getTime())) {
                    return value;
                }
                const iso = parsedDate.toISOString();
                return iso.replace('.000', '');
            } catch (e) {
                return value;
            }
        default:
            return value;
    }
}

function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    context.font = font || getComputedStyle(document.body).font;
    return context.measureText(text).width;
}

async function handleColumnHeaderEdit(event, datasetDetails) {

    const th = event.target.closest('th');

    if (!th || th.querySelector('input') || !th.dataset.columnName) {
        return;
    }

    const oldColumnName = th.dataset.columnName;
    const originalDisplayedText = th.textContent.trim();

    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'h-full p-0.5 border rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800';

    const computedStyle = getComputedStyle(th);
    const font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    const textWidth = getTextWidth(originalDisplayedText, font);
    inputElement.style.width = `${textWidth + 16}px`;
    inputElement.value = originalDisplayedText;

    th.textContent = '';
    th.appendChild(inputElement);
    inputElement.focus();

    const commitColumnEdit = async () => {
        const newColumnName = inputElement.value.trim();

        if (newColumnName === '' || newColumnName === originalDisplayedText) {
            th.textContent = originalDisplayedText;
            return;
        }

        const success = await updateColumnName(currentDatasetIdForEditing, oldColumnName, newColumnName);

        if (success) {
            // Update the local columnsInfo array
            const columnIndex = columnsInfo.findIndex(col => col.column_name === oldColumnName);
            if (columnIndex !== -1) {
                columnsInfo[columnIndex].column_name = newColumnName;
            }

            updateColumnsInfo(columnsInfo, datasetDetails.csv_name);

            showMessage(messageArea, `Column name "${oldColumnName}" successfully updated to "${newColumnName}"!`);
            if (refreshMainTableFunction) {
                await refreshMainTableFunction();
            }
            await refreshNullRowsTable();
        } else {
            showMessage(messageArea, `Failed to update column name "${oldColumnName}". Please try again.`);
            th.textContent = originalDisplayedText;
        }
    };

    inputElement.addEventListener('blur', commitColumnEdit);
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitColumnEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            th.textContent = originalDisplayedText;
            inputElement.removeEventListener('blur', commitColumnEdit);
        }
    });
}

async function handleCellEdit(event) {

    const td = event.target;

    if (td.querySelector('input') || !td.dataset.columnName) {
        return;
    }

    const rowNumber = td.closest('tr').dataset.rowNumber;
    const columnName = td.dataset.columnName;
    const columnType = td.dataset.columnType;
    let originalValue = td.dataset.originalValue !== undefined ? td.dataset.originalValue : td.textContent;

    if (originalValue.toLowerCase() === 'n/a' && (td.dataset.originalValue === undefined || td.dataset.originalValue === '')) {
        originalValue = '';
    } else if (columnType === true) {
        originalValue = td.dataset.originalValue === 'true' || td.dataset.originalValue === true ? 'True' : 'False';
    }

    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.className = 'h-full p-0.5 border rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800';

    const computedStyle = getComputedStyle(td);
    const font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    const textWidth = getTextWidth(originalValue, font);
    inputElement.style.width = `${textWidth + 16}px`;
    inputElement.value = originalValue;

    td.dataset.originalDisplayedText = td.textContent;
    td.textContent = '';
    td.appendChild(inputElement);
    inputElement.focus();

    const commitEdit = async () => {
        const newValue = inputElement.value;

        const processedNewValue = convertValueForAPI(newValue, columnType);

        const originalRawValueNormalized = originalValue.trim() === '' ? null : originalValue;
        if (processedNewValue === originalRawValueNormalized ||
            (processedNewValue === null && originalRawValueNormalized === null)) {
            // No change, revert to original displayed text
            td.textContent = td.dataset.originalDisplayedText;
            return;
        }

        const currentRowData = await fetchSingleRow(currentDatasetIdForEditing, rowNumber);

        if (!currentRowData) {
            showMessage(messageArea, 'Failed to fetch current row data for update. Please try again.');
            td.textContent = td.dataset.originalDisplayedText || originalValue;
            return;
        }

        currentRowData[columnName] = convertValueForAPI(newValue, columnType);

        const updatedRowResponse = await updateDatasetRow(currentDatasetIdForEditing, rowNumber, currentRowData);

        if (updatedRowResponse) {
            showMessage(messageArea, 'Cell updated successfully!');
            if (refreshMainTableFunction) {
                await refreshMainTableFunction();
            }
            await refreshNullRowsTable();
        } else {
            td.textContent = td.dataset.originalDisplayedText;
        }
    };

    inputElement.addEventListener('blur', commitEdit);
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            td.textContent = td.dataset.originalDisplayedText;
            inputElement.removeEventListener('blur', commitEdit);
        }
    });
}

const csvTableBody = document.getElementById('table-body');
const nullCsvTableBody = document.getElementById('null-table-body');
const csvTableHeaderRow = document.getElementById('table-header-row');
const nullCsvTableHeaderRow = document.getElementById('null-table-header-row');

function setupCellEditing(datasetId, refreshTableFunc, datasetDetails) {
    currentDatasetIdForEditing = datasetId;
    refreshMainTableFunction = refreshTableFunc;
    columnsInfo = datasetDetails.columns;

    csvTableBody.addEventListener('dblclick', (event) => {
        const targetTd = event.target.closest('td');
        if (targetTd && targetTd.closest('#csv-table')) {
            handleCellEdit(event);
        }
    });

    nullCsvTableBody.addEventListener('dblclick', (event) => {
        const targetTd = event.target.closest('td');
        if (targetTd && targetTd.closest('#null-csv-table')) {
            handleCellEdit(event);
        }
    });

    csvTableHeaderRow.addEventListener('dblclick', (event) => {
        const targetTh = event.target.closest('th');
        if (targetTh && targetTh.closest('#table-header-row')) {
            handleColumnHeaderEdit(event, datasetDetails);
        }
    });

    nullCsvTableHeaderRow.addEventListener('dblclick', (event) => {
        const targetTh = event.target.closest('th');
        if (targetTh && targetTh.closest('#null-table-header-row')) {
            handleColumnHeaderEdit(event, datasetDetails);
        }
    });

}

const dataQualityCheckSection = document.getElementById('data-quality-check');
const nullRowsCountText = document.getElementById('null-rows-count-text');

async function refreshNullRowsTable() {
    const nullRowsResponse = await fetchDatasetNullRows(currentDatasetIdForEditing);

    if (nullRowsResponse && nullRowsResponse.count > 0) {
        dataQualityCheckSection.classList.remove('hidden');
        nullRowsCountText.textContent = `${nullRowsResponse.count} rows across the dataset contain null or missing values. These may affect your data analysis and visualizations.`;

        renderNullTable(nullRowsResponse.data);
    } else {
        dataQualityCheckSection.classList.add('hidden');
        nullCsvTableBody.innerHTML = '';
        nullRowsCountText.textContent = '';
    }
}

export { setupCellEditing };