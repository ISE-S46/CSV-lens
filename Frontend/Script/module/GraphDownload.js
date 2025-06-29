import { getGraphTitle } from './Graph.js';
import { showMessage, hideMessage } from './ShowMessage.js';

const Plotly = window.Plotly;

const graphContainer = document.getElementById('graph-container');
const graphTypeSelect = document.getElementById('graph-type');
const xAxisSelect = document.getElementById('x-axis');
const yAxisSelect = document.getElementById('y-axis');

const savePlotToggleButton = document.getElementById('save-plot-toggle-btn');
const saveOptionsDropdown = document.getElementById('save-options-dropdown');

const Modal = document.getElementById('csv-page-modal');

function setupSaveGraphEvents() {
    if (savePlotToggleButton && saveOptionsDropdown) {
        savePlotToggleButton.addEventListener('click', (event) => {
            saveOptionsDropdown.classList.toggle('hidden');
            event.stopPropagation();
        });

        // Handle clicks on the dropdown options (PNG, SVG)
        saveOptionsDropdown.addEventListener('click', (event) => {
            const format = event.target.dataset.format;
            if (format) {
                savePlotAs(format);
                saveOptionsDropdown.classList.add('hidden');
            }
        });
    } else {
        console.warn("Save plot buttons or dropdown not found in DOM. Save functionality not initialized.");
    }
}

function savePlotAs(format) {
    const graphType = graphTypeSelect.value;
    const xAxis = xAxisSelect.value;
    const yAxis = yAxisSelect.value;

    const graphTitle = getGraphTitle(graphType, xAxis, yAxis);

    const sanitizedFilename = (graphTitle || 'plot').replace(/:/g, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    hideMessage(Modal);

    if (!(format === 'png' || format === 'svg')) {
        console.warn(`Unsupported save format: ${format}`);
        showMessage(Modal, `Unsupported save format: ${format}`);
        return;
    }

    if (!Plotly || !graphContainer) {
        console.error("Plotly or graphContainer is not available. Cannot save plot.");
        showMessage(Modal, 'Error: Plotly graph not ready for download.');
        return;
    }

    Plotly.downloadImage(graphContainer, {
        format: format,
        filename: sanitizedFilename,
        width: graphContainer.clientWidth,
        height: graphContainer.clientHeight
    });

    showMessage(Modal, `Successfully download ${sanitizedFilename}.${format}`);

}

export { setupSaveGraphEvents };