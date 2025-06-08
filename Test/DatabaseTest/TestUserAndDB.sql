insert into users (username, email, password_hash, created_at)
values ('yatta', 'yatta@something.com', 'AlreadyHashPassword', CURRENT_TIMESTAMP);

select *
from users;

select *
from datasets;

select *
from columns;

select *
from csv_data;

TRUNCATE TABLE datasets, columns, csv_data RESTART IDENTITY;