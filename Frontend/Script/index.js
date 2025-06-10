import { checkAuthAndRender } from "./module/HandleLogin.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();

    const menuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('user-dropdown');

    menuButton.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
        if (!menuButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');
        if (!btn) return;

        switch (true) {
            case btn.classList.contains('logout-btn'):
                localStorage.removeItem('token');
                window.location.href = '/login';
                break;
        }

    });

});