import { checkAuthAndRender, handleLogout } from "./module/HandleLogin.js";
import { loadDatasetPage, loadCurrentPageRows } from "./module/FetchCSV.js";
import { hidePageInputModal, showPageInputModal, initializePageInput } from "./module/PageInput.js";
import { hideMessage } from "./module/ShowMessage.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();
    loadDatasetPage();
    initializePageInput(loadCurrentPageRows);

    const userString = localStorage.getItem('user');
    const user = JSON.parse(userString);

    const UserName = document.getElementById("UserName");
    UserName.innerHTML = user.username;

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

    const Modal = document.getElementById('csv-page-modal');

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');

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

            case btn.classList.contains('Inputpage-btn'):
                showPageInputModal();
                break;

            case btn.classList.contains('cancel-page-btn'):
                hidePageInputModal();
                break;

            case btn.classList.contains('close-modal-btn'):
                hideMessage(Modal);
                break;

        }

    });

});