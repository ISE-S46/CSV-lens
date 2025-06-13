import { showMessage, hideMessage } from "./ShowMessage.js";

const API_BASE_URL = '/api';

async function DeleteCSV(id) {
    const token = localStorage.getItem('token');
    const dashboardMessageDiv = document.getElementById('dashboard-message');

    hideMessage(dashboardMessageDiv);

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/${id}`, {
            method: 'DELETE',
            headers: { 'x-auth-token': token }
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(dashboardMessageDiv, data.msg || `Delete dataset id = ${id} failed.`, false);
            return;
        }

        showMessage(dashboardMessageDiv, `Delete Dataset id = ${id}.` , true);

    } catch (error) {
        console.error('Error deleting datasets', error);
        showMessage(dashboardMessageDiv, 'Error deleting datasets.', false);
    }

}

export { DeleteCSV };