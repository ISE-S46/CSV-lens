import { checkAuthAndRender, handleLogout } from "./module/HandleLogin.js";
import { hideMessage } from "./module/ShowMessage.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();

    const userString = localStorage.getItem('user');
    const user = JSON.parse(userString);

    const UserName = document.getElementById("UserName");
    UserName.innerHTML = user.username;

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

    const Modal = document.querySelector('#Edit-page-modal');

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

            case btn.classList.contains('close-modal-btn'):
                hideMessage(Modal);
                break;

        }

    });

});