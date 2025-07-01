import { currentData, columnsInfo, csvName } from '../Graph.js';
import { showMessage } from '../ShowMessage.js';

const saveCSVToggleButton = document.getElementById('save-csv-toggle-btn');
const saveCSVOptionsDropdown = document.getElementById('save-csv-options-dropdown');

const Modal = document.getElementById('csv-page-modal');

function setupSaveCSVEvents() {
    if (saveCSVToggleButton && saveCSVOptionsDropdown) {
        saveCSVToggleButton.addEventListener('click', (event) => {
            saveCSVOptionsDropdown.classList.toggle('hidden');
            event.stopPropagation();
        });

        // Handle clicks on the dropdown options (PNG, SVG)
        saveCSVOptionsDropdown.addEventListener('click', (event) => {
            const format = event.target.dataset.format;
            if (format) {
                saveDataAs(format, currentData, columnsInfo, csvName);
                saveCSVOptionsDropdown.classList.add('hidden');
            }
        });

    } else {
        console.warn("Save plot buttons or dropdown not found in DOM. Save functionality not initialized.");
    }
}

function saveDataAs(format, data, columnsInfo, defaultFilename) {
    if (!data || data.length === 0) {
        showMessage(Modal, 'No data to export.');
        return;
    }
    const orderedColumnNames = columnsInfo
        .slice() // Create a shallow copy to avoid modifying the original array
        .sort((a, b) => a.column_id - b.column_id) // Sort by column_id ascending
        .map(col => col.column_name); // Get only the names in order

    const cleanedFilename = defaultFilename.replace(/\.csv$/i, '');

    const filename = `${cleanedFilename}.${format}`;
    let blob;
    let mimeType;

    try {
        switch (format) {
            case 'csv':
                blob = new Blob([convertToCSV(data, orderedColumnNames)], { type: 'text/csv;charset=utf-8;' });
                mimeType = 'text/csv';
                break;
            case 'json':
                const orderedJsonData = data.map(row => {
                    const newRow = {};
                    orderedColumnNames.forEach(colName => {
                        newRow[colName] = row[colName];
                    });
                    return newRow;
                });
                blob = new Blob([JSON.stringify(orderedJsonData, null, 2)], { type: 'application/json;charset=utf-8;' });
                mimeType = 'application/json';
                break;
            default:
                showMessage(Modal, `Unsupported format: ${format}`);
                console.warn(`Unsupported save format: ${format}`);
                return;
        }

        // Create a download link and trigger click
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up the URL object

        showMessage(Modal, `Data successfully saved as ${filename}!`);

    } catch (error) {
        showMessage(Modal, `Error saving data as ${format}: ${error.message}`);
        console.error(`Error saving data as ${format}:`, error);
    }
}

function convertToCSV(data, orderedColumnNames) {
    const headers = orderedColumnNames;
    let csv = headers.join(',') + '\n';

    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header] === null || row[header] === undefined ? '' : row[header].toString();
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csv += values.join(',') + '\n';
    });
    return csv;
}

export { setupSaveCSVEvents };