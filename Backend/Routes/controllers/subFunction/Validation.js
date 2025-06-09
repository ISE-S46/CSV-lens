function validateDatasetId(datasetId, res) {
    if (isNaN(datasetId) || datasetId <= 0) {
        return res.status(400).json({ msg: 'Invalid Dataset ID provided.' });
    }
    return false;
}

export { validateDatasetId };