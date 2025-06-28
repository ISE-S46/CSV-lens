const Plotly = window.Plotly; // will change to import from npm package later

const graphSection = document.getElementById('graph-section');
const graphTypeSelect = document.getElementById('graph-type');
const xAxisSelect = document.getElementById('x-axis');
const yAxisSelect = document.getElementById('y-axis');
const colorBySelect = document.getElementById('color-by');
const plotBtn = document.getElementById('plot-btn');
const graphContainer = document.getElementById('graph-container');

let columnsInfo = [];
let currentData = [];

// Initialize graph UI
function initGraph(columns) {
    columnsInfo = columns;
    
    populateAxisDropdowns();
    
    // Set default graph type
    graphTypeSelect.value = 'bar';
    
    // Show graph section
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
        alert('Please select an X-axis column');
        return;
    }
    
    if (graphType !== 'pie' && graphType !== 'histogram' && !yAxis) {
        alert('Please select a Y-axis column');
        return;
    }
    
    // Prepare data
    let traces = [];
    
    if (colorBy && graphType !== 'pie' && graphType !== 'histogram') {
        // Group data by the color category
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
            '#1f77b4' // Default blue color
        );
        traces.push(trace);
    }
    
    // Layout configuration
    const layout = {
        title: getGraphTitle(graphType, xAxis, yAxis),
        xaxis: { title: xAxis },
        yaxis: { title: graphType === 'histogram' ? 'Count' : yAxis },
        autosize: true,
        margin: { l: 50, r: 50, b: 100, t: 100, pad: 4 },
        showlegend: traces.length > 1 || graphType === 'pie'
    };
    
    // Clear previous plot and render new one
    Plotly.purge(graphContainer);
    Plotly.newPlot(graphContainer, traces, layout);
}

function createTrace(graphType, x, y, name, color) {
    switch(graphType) {
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
            // For pie charts, we need to count frequencies
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
        default: // bar
            return {
                x: x,
                y: y,
                type: 'bar',
                name: name,
                marker: { color: color }
            };
    }
}

// Generate a title based on graph type
function getGraphTitle(graphType, xAxis, yAxis) {
    const titles = {
        bar: `Bar Chart: ${xAxis} vs ${yAxis}`,
        line: `Line Chart: ${xAxis} vs ${yAxis}`,
        scatter: `Scatter Plot: ${xAxis} vs ${yAxis}`,
        histogram: `Histogram: ${xAxis}`,
        pie: `Pie Chart: ${xAxis}`
    };
    
    return titles[graphType] || `Data Visualization: ${xAxis}${yAxis ? ` vs ${yAxis}` : ''}`;
}

// Generate distinct colors for categories
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
    plotBtn.addEventListener('click', plotGraph);

    graphTypeSelect.addEventListener('change', () => {
        const type = graphTypeSelect.value;
        if (type === 'pie' || type === 'histogram') {
            yAxisSelect.disabled = true;
            yAxisSelect.value = '';
        } else {
            yAxisSelect.disabled = false;
        }
    });
}

export { initGraph, setGraphData, plotGraph, setupGraphEvents };