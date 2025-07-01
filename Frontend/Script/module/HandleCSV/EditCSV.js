import { updateDatasetRow, fetchSingleRow, fetchDatasetNullRows } from "./FetchCSV.js";
import { showMessage } from "../ShowMessage.js";
import { renderNullTable } from "./RenderCSVrows.js";

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
            // No significant change, revert to original displayed text
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

function setupCellEditing(datasetId, refreshTableFunc, columns) {
    currentDatasetIdForEditing = datasetId;
    refreshMainTableFunction = refreshTableFunc;
    columnsInfo = columns;

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