class FilterManager {
    constructor() {
        this.filters = new Map();
        this.sorts = [];
    }

    addFilter(column, operator, value) {
        if (!this.filters.has(column)) {
            this.filters.set(column, []);
        }
        this.filters.get(column).push({ operator, value });
    }

    removeFilter(column, index) {
        if (this.filters.has(column)) {
            const conditions = this.filters.get(column);
            conditions.splice(index, 1);
            if (conditions.length === 0) {
                this.filters.delete(column);
            }
        }
    }

    clearFilters() {
        this.filters.clear();
    }

    getFilters() {
        const filterObj = {};
        for (const [column, conditions] of this.filters) {
            filterObj[column] = conditions;
        }
        return filterObj;
    }

    hasFilters() {
        return this.filters.size > 0;
    }

    addSort(column, direction = 'ASC') {
        // Remove existing sort for this column if it exists
        this.sorts = this.sorts.filter(sort => sort.column !== column);
        this.sorts.push({ column, direction });
    }

    removeSort(column) {
        this.sorts = this.sorts.filter(sort => sort.column !== column);
    }

    clearSorts() {
        this.sorts = [];
    }

    getSorts() {
        return [...this.sorts];
    }

    // URL serialization
    serializeToURL() {
        const params = new URLSearchParams();

        // Add filters
        for (const [column, { operator, value }] of this.filters) {
            params.append('filters', JSON.stringify({
                column,
                operator,
                value
            }));
        }

        // Add sorts
        this.sorts.forEach(sort => {
            params.append('sortBy', sort.column);
            params.append('sortOrder', sort.direction);
        });

        return params.toString();
    }

    // get serializable state
    getState() {
        return {
            filters: this.getFilters(),
            sorts: this.getSorts()
        };
    }
}

export const filterManager = new FilterManager();