import { showMessage } from "./ShowMessage.js";
import { formatFileSize } from "./CSVupload.js";

const API_BASE_URL = '/api';

async function getCSVlist() {
    const token = localStorage.getItem('token');
    const dashboardMessageDiv = document.getElementById('dashboard-message');

    try {
        const response = await fetch(`${API_BASE_URL}/datasets`, {
            method: 'GET',
            headers: { 'x-auth-token': token }
        });

        if (!response.ok) {
            showMessage(dashboardMessageDiv, data.msg || 'fetching datasets failed.', false);
            return;
        }

        const data = await response.json();

        return data.datasets;

    } catch (error) {
        console.error('Error fetching datasets', error);
        showMessage(dashboardMessageDiv, 'Error fetching datasets.', false);
    }
}

async function renderCSVlist(matchingDatasets) {
    let datasets = await getCSVlist();

    if (matchingDatasets) {
        datasets = matchingDatasets;
    }

    const DatasetsContainer = document.getElementById("DatasetsContainer");
    DatasetsContainer.innerHTML = '';

    datasets.forEach(dataset => {
        DatasetsContainer.innerHTML += renderData(dataset);
    });

}

function renderData(data) {
    const { dataset_id, csv_name, file_size_bytes, row_count, upload_date } = data;
    return `
    <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                    fill="currentColor" class="w-6 h-6 text-gray-500 mr-3">
                    <path fill-rule="evenodd"
                        d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13ZM13.25 9a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm-6.5 4a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-1.5 0v-.5a.75.75 0 0 1 .75-.75Zm4-1.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5Z"
                        clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium text-gray-900">
                    <a href="/datasets/${dataset_id}" class="hover:text-blue-600">${csv_name}</a>
                </span>
            </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatFileSize(file_size_bytes)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatTimestamp(upload_date)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${row_count}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
            <button class="text-blue-600 hover:text-blue-800 font-medium">
                <a href="/datasets/${dataset_id}/edit">Edit</a>
            </button>
            <button class="text-red-600 hover:text-red-800 font-medium">Delete</button>
        </td>
    </tr>
    `;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    const pad = (num) => num.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${day}-${month}-${year} ${hours}:${minutes}`;
}


export { renderCSVlist, getCSVlist };