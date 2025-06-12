import { renderCSVlist, getCSVlist } from "./getCSVlist.js";

async function searchProducts(searchInput, ) {
    const Datasets = await getCSVlist();

    const query = searchInput.toLowerCase();
    const matchingDatasets = Datasets.filter(dataset =>
        dataset.csv_name.toLowerCase().includes(query.toLowerCase())
    );

    return renderCSVlist(matchingDatasets);
}

export { searchProducts };