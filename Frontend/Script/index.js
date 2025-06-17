import { checkAuthAndRender, handleLogout } from "./module/HandleLogin.js";
import { handleFile, clearFile, processCSV } from "./module/CSVupload.js";
import { searchProducts, handleSearchFromURL } from "./module/SearchDatasets.js";
import { DeleteCSV } from "./module/DeleteCSV.js";
import { hidePageInputModal, showPageInputModal, initializePageInput } from "./module/PageInput.js";
import { initializePagination } from "./module/getCSVlist.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();
    initializePageInput();
    initializePagination();

    const userString = localStorage.getItem('user');
    const user = JSON.parse(userString);

    const UserName = document.getElementById("UserName");
    UserName.innerHTML = user.username;

    const searchInput = document.getElementById("searchInput");

    handleSearchFromURL();

    document.querySelector('form[role="search"]').addEventListener('submit', function (e) {
        e.preventDefault();

        const query = searchInput.value.trim();
        const newUrl = `?search=${encodeURIComponent(query)}`;

        history.pushState({}, '', newUrl);

        searchProducts(query);
    });

    const dropZone = document.getElementById('dropZone');

    // Drag and drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    const fileInput = document.getElementById('fileInput');

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');
        const fileInput = document.getElementById('fileInput');

        if (!menuButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.add('hidden');
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

            case btn.classList.contains('dropZone'):
                fileInput.click();
                break;

            case btn.classList.contains('browseBtn'):
                event.stopPropagation();
                fileInput.click();
                break;

            case btn.classList.contains('removeFile'):
                clearFile();
                break;

            case btn.classList.contains('processBtn'):
                processCSV();
                break;

            case btn.classList.contains('delete-btn'):
                const row = event.target.closest('tr.Dataset');
                if (!row) return;

                const datasetId = row.dataset.id;
                DeleteCSV(datasetId);

                row.remove();
                break;

            case btn.classList.contains('Inputpage-btn'):
                showPageInputModal();
                break;

            case btn.classList.contains('cancel-page-btn'):
                hidePageInputModal();
                break;

        }

    });

    window.addEventListener('popstate', handleSearchFromURL);

});