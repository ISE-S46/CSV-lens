import { RowDataModel } from './rowData.model.js';
import { getDatasetColumns } from './get.model.js';
import { convertValueToType } from '../controllers/utils/typeConverter.js';

const updateSpecificRowMongo = async (datasetId, rowNumber, newRowData) => {
    try {
        const columnDefinitions = await getDatasetColumns(datasetId);
        if (!columnDefinitions || columnDefinitions.length === 0) {
            throw new Error('Dataset columns not found. Cannot proceed with update.');
        }

        const columnTypeMap = new Map(columnDefinitions.map(col => [col.column_name, col.column_type]));

        const transformedRowData = {};
        for (const [key, value] of Object.entries(newRowData)) {
            const columnType = columnTypeMap.get(key);
            if (columnType) {
                transformedRowData[key] = convertValueToType(value, columnType);
            } else {
                console.warn(`Attempted to update non-existent column: ${key}. Skipping type conversion.`);
                transformedRowData[key] = value;
            }
        }

        const updatePayload = {};
        for (const [key, value] of Object.entries(transformedRowData)) {
            updatePayload[`row_data.${key}`] = value;
        }

        const result = await RowDataModel.findOneAndUpdate(
            { dataset_id: datasetId, row_number: rowNumber },
            { $set: updatePayload },
            { new: true, runValidators: true }
        ).lean();

        if (!result) {
            throw new Error(`Row ${rowNumber} not found for dataset ${datasetId}.`);
        }

        return result.row_data;

    } catch (error) {
        console.error('Error in updateSpecificRowMongo:', error);
        throw error;
    }
};

const renameColumnNameMongo = async (datasetId, oldColumnName, newColumnName) => {
    const renameKey = `row_data.${oldColumnName}`;
    const newKey = `row_data.${newColumnName}`;

    const result = await RowDataModel.updateMany(
        { dataset_id: datasetId },
        { $rename: { [renameKey]: newKey } }
    );

    if (result.matchedCount === 0) {
        console.warn(`MongoDB rename: No rows found for dataset ${datasetId}.`);
    } else {
        console.log(`MongoDB rename: Renamed column in ${result.modifiedCount} documents.`);
    }

    return result;
};

export { updateSpecificRowMongo, renameColumnNameMongo };