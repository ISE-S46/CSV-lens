import { checkAuthAndRender } from "./module/HandleLogin.js";
import { handleFile, clearFile, processCSV } from "./module/CSVupload.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

    document.addEventListener('click', function (e) {
        if (!menuButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
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

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');
        const fileInput = document.getElementById('fileInput');

        if (!btn) return;

        switch (true) {
            case btn.classList.contains('user-menu-button'):
                event.stopPropagation();
                dropdownMenu.classList.toggle('hidden');
                break;

            case btn.classList.contains('logout-btn'):
                localStorage.removeItem('token');
                window.location.href = '/login';
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
        }

    });

});