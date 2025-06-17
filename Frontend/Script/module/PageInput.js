import { getCurrentPage, setCurrentPage } from './Pagination.js';
import { loadCurrentPageRows } from './FetchCSV.js';

const modal = document.getElementById('page-input-modal');
const pageNumberInput = document.getElementById('page-number-input');
const goToPageBtn = document.getElementById('go-to-page-btn');
const pageError = document.getElementById('page-error');
const modalTotalPages = document.getElementById('modal-total-pages');

let totalPages = 1;

function showPageInputModal() {
    const currentPage = getCurrentPage();
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    pageNumberInput.value = currentPage;
    pageNumberInput.max = totalPages;
    modalTotalPages.textContent = totalPages;
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
    return pageNum >= 1 && pageNum <= totalPages && !isNaN(pageNum);
}

async function goToPage(pageNum) {
    if (validatePageNumber(pageNum)) {
        setCurrentPage(pageNum);
        hidePageInputModal();
        
        // Load the requested page
        await loadCurrentPageRows();
    } else {
        pageError.classList.remove('hidden');
        pageNumberInput.focus();
        pageNumberInput.select();
    }
}

// Update total pages when dataset changes
function updateTotalPages(count) {
    totalPages = count;
    if (modalTotalPages) {
        modalTotalPages.textContent = totalPages;
    }
    if (pageNumberInput) {
        pageNumberInput.max = totalPages;
    }
}

function initializePageInput() {
    if (!modal) return;

    goToPageBtn.addEventListener('click', async () => {
        const pageNum = parseInt(pageNumberInput.value, 10);
        await goToPage(pageNum);
    });

    // Handle Enter key in input
    pageNumberInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const pageNum = parseInt(pageNumberInput.value, 10);
            await goToPage(pageNum);
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