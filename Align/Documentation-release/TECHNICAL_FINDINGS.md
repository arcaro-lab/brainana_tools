# Brainana Align Technical Findings

## Executive finding

The available v0.11.1 package is a genuine readable TypeScript/Vite project, but it predates most launcher, workstation, remote browsing, and remote export functionality. The packaged v0.15.4 application is the appropriate behavioral baseline, although it is not a maintainable source release and does not satisfy the desired self-contained architecture.

A reconstruction is feasible because the important materials are split across three forms:

1. readable v0.11.1 frontend and algorithm source;
2. readable v0.15.4 launcher, server, remote-launch helper, and export patch;
3. inspectable v0.15.4 compiled frontend containing newer interface and workflow behavior.

## Inspected inputs

### v0.11.1 source package

Readable project files include:

- `src/main.ts`
- `src/rigid.ts`
- `src/roiWarp.ts`
- `src/style.css`
- `package.json`
- `package-lock.json`
- TypeScript and Vite configuration
- compiled `dist` output

The main TypeScript file is 61,087 bytes. No automated tests or release-building scripts were found.

### v0.15.4 packaged application

Readable files include:

- macOS launcher shell script
- remote launch shell script
- local/remote HTTP server module
- remote/local export integration script
- `Info.plist`
- minimal README

The main frontend is a 934,891-byte compiled JavaScript bundle. No readable current frontend source, package manifest, lockfile, build configuration, source map, tests, or complete release documentation were found.

## Version inconsistencies

The package contains at least four identities:

- `Info.plist`: 0.15.4
- launcher deployment argument: `app-v0.15.3`
- compiled frontend session and transform metadata: 0.15.3
- README heading: 0.15.2

This prevents reliable diagnosis and makes it impossible to prove which frontend, server, and launcher revisions belong together. The rebuild should generate all identities from one version file at build time.

## Current local architecture

For local mode, the launcher selects a local directory, resolves a port, searches the user's machine for Node, starts `server.mjs`, waits for `/api/config`, and opens the default browser.

The launcher searches an interactive shell, Homebrew locations, Conda locations, and NVM directories. The package therefore is not self-contained and may behave differently based on the user's shell setup.

## Current workstation architecture

The workstation path currently:

1. establishes an SSH control connection;
2. archives and uploads the packaged runtime into the user's home directory;
3. searches for Node through the remote login shell;
4. starts the application server on the workstation;
5. adds an SSH local port forward;
6. serves the browser through that forwarded remote HTTP server.

This design explains why the app depends on workstation Node availability and why remote deployment state can survive between versions. It should not be carried into the rebuilt application.

## Server findings

The readable server provides useful behavior that can be retained behind adapters:

- directory listing with directory-first sorting;
- neuroimaging-file extension filtering;
- file streaming;
- export-directory listing;
- directory creation;
- binary request streaming to disk;
- temporary-file writes followed by rename;
- explicit overwrite protection;
- path containment beneath the configured root.

However, it directly binds all operations to one local filesystem root. In workstation mode it only works because the entire server is running remotely. The rebuilt server should call a `FilesystemAdapter` interface instead.

The existing overwrite implementation removes the destination before renaming the temporary file. This protects against partial writes but can briefly leave no destination file. A stronger replacement strategy should be selected and tested for each supported filesystem.

## Export integration findings

Workstation and local-folder export were added through `remote-export-v0153.js`, which injects controls into the compiled export dialog and overrides saving through `window.brainanaAlignSaveBlob`.

Useful behavior to preserve includes:

- local download fallback;
- optional local folder selection;
- explicit local versus workstation destination;
- workstation folder browsing;
- workstation directory creation;
- overwrite confirmation;
- serialized export operations;
- rechecking runtime mode at export time.

The injection mechanism should be removed. These controls and save calls should be native TypeScript application code.

## Profile findings

The launcher stores profiles in a tab-separated file under Application Support and sanitizes tab and newline characters. Editing and deletion are implemented.

Problems include:

- hard-coded example profiles containing institutional usernames, hosts, IP addresses, and data paths;
- no structured schema version;
- no migration framework;
- connection port stored as part of the profile even though v0.15.4 now generates a fresh random candidate each launch;
- UI implemented entirely through sequential AppleScript dialogs.

The rebuild should use a versioned structured profile format and ship with no personal or institution-specific default profiles.

## Source-recovery assessment

The v0.15.4 compiled bundle still retains enough literal interface markup and readable application-specific symbols to recover behavior. Inspection confirms the newer bundle includes the same major registration workflow as v0.11.1 plus server browsing and export integration.

The safe approach is not deminification into a purported original source tree. It is behavioral reconstruction:

- identify every current control and state transition;
- define session and export schemas;
- compare algorithms with v0.11.1;
- write regression fixtures;
- implement missing behavior in readable modules.

## Risks

### Numerical behavior drift

Rigid fitting, interpolation, refinement sampling, image-affine handling, and NIfTI writing must be compared using fixed datasets. Interface parity alone is not sufficient.

### Session compatibility

Current package output labels itself 0.15.3. Existing user sessions may rely on fields added after v0.11.1. A migration layer should accept known historical schemas and preserve unknown metadata where practical.

### SSH authentication compatibility

Penn and Harvard environments may use keys, passphrases, Duo, jump hosts, and login-shell differences. The local SSH/SFTP design should prefer the system OpenSSH client and persistent control sockets. Real institutional tests remain necessary.

### Browser folder APIs

The File System Access API is not uniformly available. Local direct-folder export must remain optional, with normal downloads as a fallback.

### Large remote files

Remote neuroimaging files should be streamed or cached without loading entire files into server memory. Cache keys must include connection identity, path, size, and modification time.

## Recommended reconstruction boundary

Use the old source for application logic that can be verified. Use the packaged app only as a behavioral and schema reference. Recover readable launcher and server concepts, but replace remote runtime deployment, remote Node discovery, remote HTTP serving, and SSH tunneling.

## Validation completed in this audit

- ZIP extraction and content inventory
- identification of readable versus compiled files
- version-identity comparison
- static launcher flow inspection
- static server endpoint and path-safety inspection
- static export integration inspection
- static comparison of major v0.11.1 and v0.15.4 user-interface strings

## Validation not yet completed

- clean dependency installation and source build
- numerical registration comparison
- browser rendering and interaction
- macOS launcher execution
- Apple Silicon and Intel runtime validation
- local export to a selected folder
- institutional SSH, Duo, or jump-host testing
- remote large-file streaming
- binary output validation in AFNI, FSL, Freeview, or NiiVue


## Recovery release note

This release intentionally packages the verified v0.15.4 production bundle unchanged for immediate behavioral recovery. It does not claim that newer frontend code has already been reconstructed into readable TypeScript.
