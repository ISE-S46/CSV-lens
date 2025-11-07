import { showMessage } from "./ShowMessage.js";

const Plotly = window.Plotly;

const graphSection = document.getElementById('graph-section');
const graphTypeSelect = document.getElementById('graph-type');
const xAxisSelect = document.getElementById('x-axis');
const yAxisSelect = document.getElementById('y-axis');
const colorBySelect = document.getElementById('color-by');
const graphContainer = document.getElementById('graph-container');

const CsvPageModal = document.getElementById('csv-page-modal');

let csvName
let columnsInfo = [];
let currentData = [];

function initGraph(columns, csv_name) {
    csvName = csv_name
    columnsInfo = columns;

    populateAxisDropdowns();

    graphTypeSelect.value = 'bar';

    graphSection.classList.remove('hidden');
}

function populateAxisDropdowns() {
    xAxisSelect.innerHTML = '';
    yAxisSelect.innerHTML = '';
    colorBySelect.innerHTML = '';

    // Add default options
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select column';
    xAxisSelect.appendChild(defaultOption.cloneNode(true));
    yAxisSelect.appendChild(defaultOption.cloneNode(true));

    // Add "None" option for color by
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    colorBySelect.appendChild(noneOption);

    // Add column options
    columnsInfo.forEach(column => {
        const option = document.createElement('option');
        option.value = column.column_name;
        option.textContent = column.column_name;
        xAxisSelect.appendChild(option.cloneNode(true));
        yAxisSelect.appendChild(option.cloneNode(true));
        colorBySelect.appendChild(option.cloneNode(true));
    });
}

function setGraphData(data) {
    currentData = data;
}

function plotGraph() {
    const graphType = graphTypeSelect.value;
    const xAxis = xAxisSelect.value;
    const yAxis = yAxisSelect.value;
    const colorBy = colorBySelect.value;

    // Validate inputs based on graph type
    if (!xAxis) {
        showMessage(CsvPageModal, 'Please select an X-axis column');
        return;
    }

    if ((graphType === 'heatmap' || (graphType !== 'pie' && graphType !== 'histogram')) && !yAxis) {
        showMessage(CsvPageModal, 'Please select a Y-axis column');
        return;
    }

    graphContainer.classList.remove('hidden');

    let traces = [];

    if (colorBy && graphType !== 'pie' && graphType !== 'histogram') {
        const groupedData = {};
        currentData.forEach(row => {
            if (row[xAxis] !== undefined && row[yAxis] !== undefined && row[colorBy] !== undefined) {
                const category = row[colorBy];
                if (!groupedData[category]) {
                    groupedData[category] = {
                        x: [],
                        y: []
                    };
                }
                groupedData[category].x.push(row[xAxis]);
                groupedData[category].y.push(row[yAxis]);
            }
        });

        // Create a trace for each category
        const categories = Object.keys(groupedData);
        const colors = getCategoryColors(categories.length);

        categories.forEach((category, index) => {
            const trace = createTrace(
                graphType,
                groupedData[category].x,
                groupedData[category].y,
                category,
                colors[index]
            );
            traces.push(trace);
        });
    } else {
        // No color category - single trace
        const xValues = [];
        const yValues = [];

        currentData.forEach(row => {
            if (row[xAxis] !== undefined &&
                (graphType === 'pie' || graphType === 'histogram' || row[yAxis] !== undefined)) {
                xValues.push(row[xAxis]);
                if (graphType !== 'pie' && graphType !== 'histogram') {
                    yValues.push(row[yAxis]);
                }
            }
        });

        const trace = createTrace(
            graphType,
            xValues,
            yValues,
            null,
            '#25b9ed'
        );
        traces.push(trace);
    }

    // Layout configuration
    const graphTitle = getGraphTitle(graphType, xAxis, yAxis);

    const layout = {
        title: { text: graphTitle },
        xaxis: { title: { text: xAxis } },
        yaxis: { title: { text: graphType === 'histogram' ? 'Count' : yAxis }},
        autosize: true,
        margin: { l: 50, r: 50, b: 100, t: 100, pad: 4 },
        showlegend: traces.length > 1 || graphType === 'pie'
    };

    // Clear previous plot and render new one
    Plotly.purge(graphContainer);
    Plotly.newPlot(graphContainer, traces, layout, { responsive: true });
}

function createTrace(graphType, x, y, name, color) {
    switch (graphType) {
        case 'scatter':
            return {
                x: x,
                y: y,
                mode: 'markers',
                type: 'scatter',
                name: name,
                marker: {
                    size: 8,
                    color: color
                }
            };
        case 'line':
            return {
                x: x,
                y: y,
                type: 'scatter',
                mode: 'lines+markers',
                name: name,
                line: {
                    shape: 'spline',
                    color: color
                }
            };
        case 'histogram':
            return {
                x: x,
                type: 'histogram',
                name: name,
                marker: { color: color }
            };
        case 'pie':
            const counts = {};
            x.forEach(val => {
                counts[val] = (counts[val] || 0) + 1;
            });

            return {
                labels: Object.keys(counts),
                values: Object.values(counts),
                type: 'pie',
                name: name,
                marker: { colors: getCategoryColors(Object.keys(counts).length) }
            };
        case 'heatmap':
            const heatmapData = aggregateHeatmapData(x, y);
            return {
                z: heatmapData.z,
                x: heatmapData.xLabels,
                y: heatmapData.yLabels,
                type: 'heatmap',
                colorscale: 'Viridis',
                name: name,
                hoverongaps: false,
                showscale: true
            };
        default:
            return {
                x: x,
                y: y,
                type: 'bar',
                name: name,
                marker: { color: color }
            };
    }
}

function aggregateHeatmapData(xValues, yValues) {
    const xLabels = [...new Set(xValues)].sort();
    const yLabels = [...new Set(yValues)].sort();

    // Initialize count matrix
    const z = Array(yLabels.length).fill().map(() => Array(xLabels.length).fill(0));

    // Create mappings for quick lookup
    const xIndexMap = new Map(xLabels.map((label, i) => [label, i]));
    const yIndexMap = new Map(yLabels.map((label, i) => [label, i]));

    // Count occurrences of each (x,y) pair
    xValues.forEach((xVal, i) => {
        const yVal = yValues[i];
        const xIdx = xIndexMap.get(xVal);
        const yIdx = yIndexMap.get(yVal);

        if (xIdx !== undefined && yIdx !== undefined) {
            z[yIdx][xIdx]++;
        }
    });

    return { z, xLabels, yLabels };
}

function getGraphTitle(graphType, xAxis, yAxis) {
    const titles = {
        bar: `Bar Chart: ${xAxis} vs ${yAxis}`,
        line: `Line Chart: ${xAxis} vs ${yAxis}`,
        scatter: `Scatter Plot: ${xAxis} vs ${yAxis}`,
        histogram: `Histogram: ${xAxis}`,
        pie: `Pie Chart: ${xAxis}`,
        heatmap: `Heatmap: ${xAxis} vs ${yAxis}`
    };

    return titles[graphType];
}

function getCategoryColors(count) {
    const defaultColors = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];

    if (count > defaultColors.length) {
        const additionalColors = [];
        for (let i = defaultColors.length; i < count; i++) {
            // Generate distinct HSL colors
            additionalColors.push(`hsl(${(i * 360) / count}, 70%, 50%)`);
        }
        return [...defaultColors, ...additionalColors];
    }

    return defaultColors.slice(0, count);
}

function setupGraphEvents() {
    graphTypeSelect.addEventListener('change', () => {
        const type = graphTypeSelect.value;
        yAxisSelect.disabled = type === 'pie' || type === 'histogram';
        if (yAxisSelect.disabled) yAxisSelect.value = '';

        colorBySelect.disabled = type === 'heatmap' || type === 'pie' || type === 'histogram';
        if (colorBySelect.disabled) colorBySelect.value = '';
    });
}

export { 
    initGraph, 
    setGraphData, 
    plotGraph, 
    setupGraphEvents, 
    getGraphTitle, 
    currentData, 
    columnsInfo,
    csvName
};