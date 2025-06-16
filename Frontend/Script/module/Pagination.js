import { loadCurrentPageRows } from "./FetchCSV.js";

const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const currentPageDisplay = document.getElementById('current-page-display');
const totalPagesDisplay = document.getElementById('total-pages-display');

let currentPage = 1;
let totalPages = 1;
let isHandlingPopstate = false;

function getCurrentPage() {
    return currentPage;
}

function setCurrentPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
    }
}

function setTotalPages(count) {
    totalPages = count;
}

function resetPagination() {
    currentPage = 1;
}

function updatePaginationDisplay(pagination) {
    currentPage = pagination.currentPage;
    totalPages = pagination.totalPages;

    currentPageDisplay.textContent = pagination.currentPage;
    totalPagesDisplay.textContent = pagination.totalPages;

    prevPageBtn.disabled = !pagination.hasPreviousPage;
    nextPageBtn.disabled = !pagination.hasNextPage;
}

function bindPaginationButtons(onPageChange) {
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            onPageChange(-1);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            onPageChange(1);
        }
    });
}

// --- Navigation Helper Functions ---

function getPageFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = parseInt(urlParams.get('page'), 10);
    return !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
}

function updateUrlWithPage(page, pushState = true) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    
    if (pushState && !isHandlingPopstate) {
        window.history.pushState({ page: page }, '', url);
    } else if (!pushState) {
        window.history.replaceState({ page: page }, '', url);
    }
}

async function handlePopstate() {
    isHandlingPopstate = true;
    
    try {
        const targetPage = getPageFromUrl();
        // console.log('Popstate: navigating to page', targetPage);

        setCurrentPage(targetPage);

        await loadCurrentPageRows(false);
        
    } catch (error) {
        console.error('Error handling popstate:', error);
    } finally {
        isHandlingPopstate = false;
    }
}

export { 
    getCurrentPage, 
    setCurrentPage, 
    setTotalPages, 
    resetPagination, 
    updatePaginationDisplay, 
    bindPaginationButtons, 
    getPageFromUrl, 
    updateUrlWithPage, 
    handlePopstate 
};