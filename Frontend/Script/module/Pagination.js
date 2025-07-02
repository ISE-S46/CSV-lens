const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const currentPageDisplay = document.getElementById('current-page-display');
const totalPagesDisplay = document.getElementById('total-pages-display');

let currentPage = 1;
let totalPages = 1;

function getCurrentPage() {
    return currentPage;
}

function setCurrentPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
    }
}

function getTotalPages() {
    return totalPages;
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
    const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    return page;
}

function updateUrlWithPage(page, pushState = true) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    
    if (pushState) {
        window.history.pushState({ page: page }, '', url.toString());
    } else {
        window.history.replaceState({ page: page }, '', url.toString());
    }
}

async function handlePopstate() {
    try {
        const targetPage = getPageFromUrl();
        setCurrentPage(targetPage);
    } catch (error) {
        console.error(error);
    }
}

export { 
    getCurrentPage, 
    setCurrentPage, 
    getTotalPages, 
    setTotalPages, 
    resetPagination, 
    updatePaginationDisplay, 
    bindPaginationButtons, 
    getPageFromUrl, 
    updateUrlWithPage, 
    handlePopstate 
};