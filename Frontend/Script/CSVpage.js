import { checkAuthAndRender, handleLogout } from "./module/HandleLogin.js";
import { loadDatasetPage } from "./module/FetchCSV.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();
    loadDatasetPage();

    const userString = localStorage.getItem('user');
    const user = JSON.parse(userString);

    const UserName = document.getElementById("UserName");
    UserName.innerHTML = user.username;

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

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

        }

    });

});