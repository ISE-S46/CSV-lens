import { renderCSVlist, getCSVlist } from "./getCSVlist.js";

async function searchProducts(searchInput) {
    const Datasets = await getCSVlist();

    const query = searchInput.toLowerCase();
    const matchingDatasets = Datasets.filter(dataset =>
        dataset.csv_name.toLowerCase().includes(query.toLowerCase())
    );

    return renderCSVlist(matchingDatasets);
}

function handleSearchFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    const searchInput = document.getElementById("searchInput");

    if (searchQuery) {
        searchInput.value = searchQuery;
        searchProducts(searchQuery);
    } else {
        searchInput.value = '';
        // console.log("from handlesearch") // might use in debugging later
        renderCSVlist();
    }
}

export { searchProducts, handleSearchFromURL };