insert into users (username, email, password_hash, created_at)
values (
        'yatta',
        'yatta@something.com',
        'AlreadyHashPassword',
        CURRENT_TIMESTAMP
    );

select *
from users;

select *
from datasets;

select *
from columns;

select *
from csv_data;

TRUNCATE TABLE datasets, columns, csv_data RESTART IDENTITY;

TRUNCATE TABLE users, datasets, columns, csv_data RESTART identity;

SELECT *
FROM csv_data
WHERE dataset_id = 6
and jsonb_path_exists(row_data, '$.** ? (@ == null)');

SELECT COUNT(*) AS row_count,
    AVG(pg_column_size(row_data)) AS avg_jsonb_bytes,
    MAX(pg_column_size(row_data)) AS largest_row_bytes
FROM csv_data
WHERE dataset_id = 3;

SELECT *
FROM csv_data
WHERE dataset_id = 8;