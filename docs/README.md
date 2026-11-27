# StoreForge Frontend Documentation

Documentation for the StoreForge Next.js app. For setup and a product overview, see the [root README](../README.md).

## Contents

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | How the app, the API and the database fit together, and why the API is called from the server |
| [Authentication](./authentication.md) | Sign-in, sessions and cookies through the API; required environment variables |
| [API Integration](./api-integration.md) | How to add or change an API-backed service; error mapping; rules |
| [API Endpoints](./api-endpoints.md) | Which service function calls which API endpoint |
| [Migration Status](./migration-status.md) | State of the move to the API, open items, and what is out of scope |
| [Testing](./testing.md) | Automated checks and the live verification checklist |
| [Roles and Permissions](./roles-and-permissions.md) | What each role can do |
| [Data Model](./data-model.md) | Database tables, relationships and columns |
| [Catalog hierarchy](./catalog-hierarchy.md) | The configurable level > item tree: dashboard, import and export, part number, and the storefront route every template shares |
| [Security Review](./security.md) | Platform Admin security review: findings, fixes and recommendations |

## Related

- The API lives in the `store-forge-api` repository. Its Swagger UI (`/api/docs`) is the contract of record for endpoints.
- The database schema and migrations are owned by `store-forge-api`.
