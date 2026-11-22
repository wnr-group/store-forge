#!/bin/bash
# usage: pw-files.sh <outdir> <spec files...>  -- clears the LOCAL login rate-limit table before each spec file (local E2E DB only)
. /c/Users/Eshwar/WNR/store-forge-integ/artifacts/studio/env.sh
out=$1; shift; mkdir -p $out
for f in "$@"; do
  docker exec supabase_db_sf-studio-ui-e2e psql -U postgres -c "delete from public.rate_limits" >/dev/null 2>&1
  n=$(basename $f .spec.ts)
  PLAYWRIGHT_JSON_OUTPUT_NAME=$out/$n.json npx playwright test $f --reporter=json,list --output=/c/Users/Eshwar/AppData/Local/Temp/pw-out > $out/$n.txt 2>&1
  echo "$n exit=$? $(grep -E '^\s+[0-9]+ (passed|failed|skipped)' $out/$n.txt | tr -s ' ' | tr '\n' ' ')"
done
