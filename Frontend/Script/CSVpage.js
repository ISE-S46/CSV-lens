import { checkAuthAndRender, handleLogout, resetIdleTimer } from "./module/Auth/HandleSession.js";
import { loadDatasetPage, loadCurrentPageRows } from "./module/HandleCSV/LoadCSVpage.js";
import { hidePageInputModal, showPageInputModal, initializePageInput } from "./module/PageInput.js";
import { hideMessage } from "./module/ShowMessage.js";
import { getFilterUIEventHandlers } from "./module/FilterUI.js";
import { toggleNullRowsDisplay } from "./module/HandleCSV/RenderCSVrows.js";
import { setupGraphEvents, plotGraph } from "./module/Graph.js";
import { setupSaveGraphEvents } from "./module/GraphDownload.js";
import { setupSaveCSVEvents } from "./module/HandleCSV/CSVdownload.js";

document.addEventListener('DOMContentLoaded', () => {
    const Modal = document.getElementById('csv-page-modal');

    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);
    document.addEventListener('click', resetIdleTimer);
    document.addEventListener('scroll', resetIdleTimer);

    checkAuthAndRender(Modal);
    loadDatasetPage();
    initializePageInput(loadCurrentPageRows);

    setupGraphEvents();
    setupSaveGraphEvents();
    setupSaveCSVEvents();

    const {
        addFilterRow,
        applyFilters,
        clearFilters,
        addSortRow,
        applySorts,
        clearSorts,
        copyFilterUrlToClipboard
    } = getFilterUIEventHandlers();

    const userString = localStorage.getItem('user');
    const user = JSON.parse(userString);

    const UserName = document.getElementById("UserName");
    UserName.innerHTML = user.username;

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

    const savePlotToggleButton = document.getElementById('save-plot-toggle-btn');
    const saveOptionsDropdown = document.getElementById('save-options-dropdown');

    const saveCSVToggleButton = document.getElementById('save-csv-toggle-btn');
    const saveCSVOptionsDropdown = document.getElementById('save-csv-options-dropdown');

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');

        if (!menuButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.add('hidden');
        }

        if (!saveOptionsDropdown.contains(event.target) && !savePlotToggleButton.contains(event.target)) {
            saveCSVOptionsDropdown.classList.add('hidden');
        }

        if (!saveOptionsDropdown.contains(event.target) && !saveCSVToggleButton.contains(event.target)) {
            saveCSVOptionsDropdown.classList.add('hidden');
        }

        if (!btn) return;

        switch (true) {
            case btn.classList.contains('user-menu-button'):
                event.stopPropagation();
                dropdownMenu.classList.toggle('hidden');
                break;

            case btn.classList.contains('logout-btn'):
                handleLogout();
                break;

            case btn.classList.contains('Inputpage-btn'):
                showPageInputModal();
                break;

            case btn.classList.contains('cancel-page-btn'):
                hidePageInputModal();
                break;

            case btn.classList.contains('close-modal-btn'):
                hideMessage(Modal);
                break;

            case btn.classList.contains('hide-null-rows-btn'):
                toggleNullRowsDisplay();
                break;

            case btn.classList.contains('add-filter'):
                addFilterRow();
                break;

            case btn.classList.contains('apply-filters'):
                applyFilters();
                break;

            case btn.classList.contains('clear-filters'):
                clearFilters();
                break;

            case btn.classList.contains('add-sort'):
                addSortRow();
                break;

            case btn.classList.contains('apply-sort'):
                applySorts();
                break;

            case btn.classList.contains('clear-sort'):
                clearSorts();
                break;

            case btn.classList.contains('copy-filter-url'):
                copyFilterUrlToClipboard();
                break;

            case btn.classList.contains('plot-btn'):
                plotGraph();
                break;

        }

    });

});