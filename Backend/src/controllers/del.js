import { validateDatasetId } from './utils/Validation.js';
import { deleteDatasetAndData } from '../Models/del.model.js';

const DeleteDatasets = async (req, res) => {
    const userId = req.user.id;
    const datasetId = parseInt(req.params.datasetId, 10);

    if (validateDatasetId(datasetId, res)) return;

    try {
        const result = await deleteDatasetAndData(datasetId, userId);

        switch (result) {
            case 'success':
                return res.status(200).json({ msg: `Dataset ${datasetId} and all associated data deleted successfully.` });
            case 'not_found':
                return res.status(404).json({ msg: 'Dataset not found.' });
            case 'access_denied':
                return res.status(403).json({ msg: 'Access denied. This dataset does not belong to you.' });
            default:
                return res.status(500).json({ msg: 'Server error during dataset deletion.' });
        }

    } catch (err) {
        console.error(`Error deleting dataset ${datasetId}:`, err.message);
        res.status(500).json({ msg: 'Server error during dataset deletion.', error: err.message });
    }
}

export { DeleteDatasets };