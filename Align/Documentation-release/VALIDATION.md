# Validation report: 0.16.6-testing.1

## Completed

- Clean dependency installation from `package-lock.json`
- TypeScript compilation
- Vite production build
- Single-source release identity check
- Source architecture checks
- Coordinate, crosshair, and landmark checks
- Optimization-window optional-plane checks
- Session migration and export-artifact checks
- Runtime integration module checks
- Deterministic scientific rigid-transform reference tests
- Local server startup, port publication, and health check
- Headless Chromium UI regression test using the packaged frontend build
- macOS launcher shell syntax check
- Server syntax check
- Exact source-build to packaged-frontend comparison
- Apple Silicon and Intel bundled Node Mach-O checks
- Executable permission checks
- ZIP integrity checks

## Browser-test coverage

The browser suite confirms initial MRI and CT placeholders, the default status message, the default optimization summary, all six window interaction layers, activation for MRI plus CT, activation for MRI only, and deactivation after finishing definition.

## Scientific-test coverage

The scientific suite confirms deterministic rigid-transform recovery, inverse consistency, point round trips, per-plane optimization constraints, intersection of defined planes, and unrestricted behavior when no plane is defined.

## Remaining real-machine tests

Interactive NiiVue WebGL rendering, real MRI/CT file loading, landmark dragging, zoom/pan marker projection, session export, and institutional SSH/Duo workflows still require testing on a real Mac with representative data.
