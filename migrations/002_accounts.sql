create unique index if not exists users_username_lower on users (lower(username));
create unique index if not exists users_single_owner on users (role) where role = 'owner';
