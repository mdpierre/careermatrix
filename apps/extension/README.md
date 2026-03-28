# applybot extension

This directory contains the Chrome extension companion for the local desktop app.

It is mirrored from the standalone extension workspace during the transition to the unified `careermatrix` product repo.

Current responsibilities:
- fetch the active profile slot from the local backend
- create application sessions before autofill
- autofill supported job forms in-browser
- report fill events and final results back to the backend

Load it in Chrome as an unpacked extension from this directory:

```bash
apps/extension/
```

The extension expects the local API at:

```bash
http://localhost:8000
```
