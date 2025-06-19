import { TogglePasswordIcon } from "./module/ShowPassword.js";
import { handleRegister } from "./module/HandleRegister.js";
import { hideMessage } from "./module/ShowMessage.js";

document.addEventListener('DOMContentLoaded', () => {

    const registerPassword = document.querySelector('#registerPassword');
    const registerConfirmPassword = document.querySelector('#registerConfirmPassword');
    const Modal = document.querySelector('#Register-modal');

    const showIcon = document.querySelector('#showIcon');
    const hideIcon = document.querySelector('#hideIcon');

    const showIcon2 = document.querySelector('#showIcon2');
    const hideIcon2 = document.querySelector('#hideIcon2');

    document.body.addEventListener('click', event => {
        const btn = event.target.closest('button');
        if (!btn) return;

        switch (true) {

            case btn.classList.contains('togglePassword'):
                TogglePasswordIcon(registerPassword, showIcon, hideIcon);
                break;

            case btn.classList.contains('toggleConfirmPassword'):
                TogglePasswordIcon(registerConfirmPassword, showIcon2, hideIcon2);
                break;

            case btn.classList.contains('Register-btn'):
                handleRegister(event);
                break;
                
            case btn.classList.contains('close-modal-btn'):
                hideMessage(Modal);
                break;
        }

    });

});