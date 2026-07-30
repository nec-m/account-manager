# Account Manager

Account Manager is a self-hosted Next.js application for organizing accounts, phone numbers, credentials, two-factor authentication details, and account-to-phone bindings. Data is stored locally in SQLite and access is protected by administrator and viewer roles.

## Requirements

- Node.js 22.12.0 or later
- npm

## Install and run

Install the exact dependency versions from the lock file:

```bash
npm ci
```

For local development, copy `.env.example` to `.env.local`, replace the placeholder administrator password, and start the development server:

```bash
npm run dev
```

For production, provide the variables from `.env.example` through your process environment, then build and start the application:

```bash
npm run build
npm start
```

## First administrator

When the database contains no users, `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` create the first administrator. The password must contain at least 10 characters. These variables never overwrite an existing user.

Remove bootstrap credentials from the process environment after the administrator has been created, and do not commit real credentials or environment files.

## Security and data

- Use HTTPS for any access outside a trusted local development environment and set `AUTH_COOKIE_SECURE=true` when HTTPS is enabled.
- Do not expose the application directly to the public internet without an HTTPS reverse proxy and appropriate network access controls.
- `data.db`, its WAL/SHM files, and database backups can contain passwords, two-factor secrets, sessions, and personal information. Keep them outside version control and protect backups accordingly.
- Repository tests use reserved `.invalid` domains, NANP `555-01xx` phone numbers, and intentionally non-production passwords, tokens, and hashes. They are fixtures only.

## License

Licensed under the [MIT License](LICENSE).
