import { TogglePasswordIcon } from "./module/ShowPassword.js";
import { handleLogin } from "./module/HandleLogin.js";

document.addEventListener('DOMContentLoaded', () => {

    const Password = document.querySelector('#loginPassword');

    const showIcon = document.querySelector('#showIcon');
    const hideIcon = document.querySelector('#hideIcon');

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');
        if (!btn) return;

        const id = btn.dataset.productId;
        const type = btn.dataset.productType;

        switch (true) {

            case btn.classList.contains('togglePassword'):
                TogglePasswordIcon(Password, showIcon, hideIcon);
                break;

            case btn.classList.contains('Login'):
                handleLogin(event);
                break;
        }

    });

});