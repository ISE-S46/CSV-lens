import { TogglePasswordIcon } from "./module/ShowPassword.js";
import { handleLogin, checkExistingTokenAndRedirect } from "./module/Auth/HandleSession.js";
import { hideMessage } from "./module/ShowMessage.js";

document.addEventListener('DOMContentLoaded', () => {

    checkExistingTokenAndRedirect();

    const Password = document.querySelector('#loginPassword');
    const showIcon = document.querySelector('#showIcon');
    const hideIcon = document.querySelector('#hideIcon');
    const Modal = document.querySelector('#login-modal');

    document.body.addEventListener('click', event => {

        const btn = event.target.closest('button');
        if (!btn) return;

        switch (true) {

            case btn.classList.contains('togglePassword'):
                TogglePasswordIcon(Password, showIcon, hideIcon);
                break;

            case btn.classList.contains('Login'):
                handleLogin(event);
                break;

            case btn.classList.contains('close-modal-btn'):
                hideMessage(Modal);
                break;
        }

    });

});