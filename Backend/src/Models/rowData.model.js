import mongoose, { Schema } from "mongoose";

const CsvDataSchema = new Schema({
    dataset_id: {
        type: Number,
        required: true,
        index: true
    },

    row_number: {
        type: Number,
        required: true,
        index: true
    },

    row_data: {
        type: Schema.Types.Mixed, 
        required: true,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, 
});

CsvDataSchema.index({ dataset_id: 1, row_number: 1 }, { unique: true });

export const RowDataModel = mongoose.model('RowData', CsvDataSchema, 'csv_data');