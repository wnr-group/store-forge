set -a; . /c/Users/Eshwar/WNR/store-forge-integ/.env.local; set +a
export E2E_PLATFORM_ADMIN_EMAIL=platform@demo.test EVIDENCE_LABEL=after E2E_TICKET_ID=REGRESSION E2E_DEMO_PASSWORD=Demo1234 E2E_BASE_URL=http://localhost:3100 E2E_API_URL=http://localhost:4000/api/v1 E2E_DB_CONTAINER=supabase_db_sf-studio-ui-e2e E2E_STORE_SLUG=${E2E_STORE_SLUG:-urban-nest-demo}
