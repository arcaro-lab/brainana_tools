# Shared launcher lifecycle

Every platform launcher must:

1. Resolve the bundled runtime for the current operating system and architecture.
2. Resolve platform-specific application, cache, log, and temporary directories.
3. Collect a local or remote data root.
4. Generate a cryptographically strong per-launch session token.
5. Start the shared local server with port `0` and a private launch directory.
6. Wait for atomic port publication and the tokenized health endpoint.
7. Open the system default browser only after the exact server instance is healthy.
8. Keep the server alive independently of browser startup state.
9. Clean launch-specific state and remote control connections on exit.

The frontend and server must not contain platform-specific browser or dialog logic.
