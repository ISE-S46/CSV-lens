import { renderCSVlist, getCSVlist } from "./HandleCSV/getCSVlist.js";

async function searchCSV(searchInput) {
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
        searchCSV(searchQuery);
    } else {
        searchInput.value = '';
        // console.log("from handlesearch") // might use in debugging later
        renderCSVlist();
    }
}

export { searchCSV, handleSearchFromURL };