# Architecture

Browser → bundled local Node server → LocalFilesystemAdapter or system SSH connection → files. Workstation mode starts no remote Node process, uploads no application code, and opens no remote HTTP port. A persistent system SSH ControlMaster connection handles authentication and supports normal SSH configuration, jump hosts, keys, and institutional interactive authentication.
