import { setTotalPages, getCurrentPage, setCurrentPage, getTotalPages } from './Pagination.js';
import { updateUrlWithPage } from './Pagination.js';

const modal = document.getElementById('page-input-modal');
const pageNumberInput = document.getElementById('page-number-input');
const goToPageBtn = document.getElementById('go-to-page-btn');
const pageError = document.getElementById('page-error');
const modalTotalPages = document.getElementById('modal-total-pages');

function showPageInputModal() {
    const currentPage = getCurrentPage();
    const total = getTotalPages();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    pageNumberInput.value = currentPage;
    pageNumberInput.max = total;
    modalTotalPages.textContent = total;
    pageError.classList.add('hidden');
    
    // Focus and select the input
    setTimeout(() => {
        pageNumberInput.focus();
        pageNumberInput.select();
    }, 100);
}

function hidePageInputModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    pageNumberInput.value = '';
    pageError.classList.add('hidden');
}

function validatePageNumber(pageNum) {
    const total = getTotalPages();
    return pageNum >= 1 && pageNum <= total && !isNaN(pageNum);
}

async function goToPage(pageNum) {
    if (validatePageNumber(pageNum)) {
        setCurrentPage(pageNum);
        updateUrlWithPage(pageNum);
        hidePageInputModal();

        return true;
    } else {
        pageError.classList.remove('hidden');
        pageNumberInput.focus();
        pageNumberInput.select();

        return false;
    }
}

// Update total pages when dataset changes
function updateTotalPages(count) {
    setTotalPages(count);

    const total = getTotalPages();
    if (modalTotalPages) {
        modalTotalPages.textContent = total;
    }
    if (pageNumberInput) {
        pageNumberInput.max = total;
    }
}

function initializePageInput(InputFunction) {
    if (!modal) return;

    goToPageBtn.addEventListener('click', async () => {
        const pageNum = parseInt(pageNumberInput.value, 10);
        if (goToPage(pageNum)) {
            await InputFunction();
        }
    });

    // Handle Enter key in input
    pageNumberInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const pageNum = parseInt(pageNumberInput.value, 10);
            if (goToPage(pageNum)) {
                await InputFunction();
            }
        } else if (e.key === 'Escape') {
            hidePageInputModal();
        }
    });

    // Hide modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hidePageInputModal();
        }
    });

    // Real-time validation
    pageNumberInput.addEventListener('input', () => {
        const pageNum = parseInt(pageNumberInput.value, 10);
        if (pageNumberInput.value && !validatePageNumber(pageNum)) {
            pageError.classList.remove('hidden');
        } else {
            pageError.classList.add('hidden');
        }
    });
}

export {
    showPageInputModal,
    hidePageInputModal,
    updateTotalPages,
    initializePageInput
};