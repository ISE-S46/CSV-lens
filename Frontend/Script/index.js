import { checkAuthAndRender } from "./module/HandleLogin.js";

document.addEventListener('DOMContentLoaded', () => {

    checkAuthAndRender();

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