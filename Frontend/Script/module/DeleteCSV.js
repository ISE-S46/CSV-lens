import { showMessage, hideMessage } from "./ShowMessage.js";

const API_BASE_URL = '/api';

async function DeleteCSV(id) {
    const dashboardMessageDiv = document.querySelector('#Main-page-modal');

    hideMessage(dashboardMessageDiv);

    try {
        const response = await fetch(`${API_BASE_URL}/datasets/${id}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(dashboardMessageDiv, `Delete dataset failed, ${data.msg}`, false);
            return;
        }

        showMessage(dashboardMessageDiv, `Delete Dataset successfully.` , true);

    } catch (error) {
        console.error('Error deleting datasets', error);
        showMessage(dashboardMessageDiv, 'Error deleting datasets.', false);
    }

}

export { DeleteCSV };