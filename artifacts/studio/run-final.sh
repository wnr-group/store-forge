cd /c/Users/Eshwar/WNR/store-forge-integ
export E2E_VIEWER_EMAIL=read-only@demo.test
T=tests/e2e
artifacts/studio/pw-files.sh artifacts/studio/final2/pr8 $T/studio-a11y.spec.ts $T/studio-evidence.spec.ts $T/studio-f6a.spec.ts $T/studio-filters.spec.ts $T/studio-modules.spec.ts $T/studio-restricted.spec.ts $T/studio-scope.spec.ts $T/studio-sidebar.spec.ts $T/studio-submit-dialogs.spec.ts $T/studio-submit-focus.spec.ts $T/studio-viewports.spec.ts $T/studio-timezone.spec.ts $T/studio-baseline.spec.ts $T/studio-func.spec.ts $T/product-regression.spec.ts
artifacts/studio/pw-files.sh artifacts/studio/final2/studio $T/studio-nav-group.spec.ts $T/studio-restricted-members.spec.ts $T/studio-collection-picker.spec.ts $T/studio-collection-legacy-slug.spec.ts $T/studio-collection-delete.spec.ts $T/studio-category-delete.spec.ts $T/studio-product-presentation.spec.ts $T/studio-virtual-pages.spec.ts $T/studio-virtual-state.spec.ts $T/studio-config-persistence.spec.ts $T/studio-visibility-live.spec.ts $T/studio-theme-matrix.spec.ts
echo DONE
