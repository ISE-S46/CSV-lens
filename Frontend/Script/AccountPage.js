import { checkAuthAndRender, handleLogout, resetIdleTimer } from "./module/Auth/HandleSession.js";
import { hideMessage } from "./module/ShowMessage.js";

document.addEventListener('DOMContentLoaded', () => {
    const Modal = document.querySelector('Account-page-modal');

    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);
    document.addEventListener('click', resetIdleTimer);
    document.addEventListener('scroll', resetIdleTimer);

    checkAuthAndRender(Modal);

    const userString = localStorage.getItem('user');
    const user = JSON.parse(userString);

    const UserNameNav = document.getElementById("UserName");
    UserNameNav.innerHTML = user.username;

    const UserName = document.getElementById("username-account");
    UserName.innerHTML = user.username;

    const email = document.getElementById("email");
    email.innerHTML = user.email;

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
                handleLogout(Modal);
                break;

            case btn.classList.contains('account-logout-btn'):
                handleLogout(Modal);
                break;

            case btn.classList.contains('close-modal-btn'):
                hideMessage(Modal);
                break;

        }

    });

});