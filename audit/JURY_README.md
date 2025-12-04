# TriviAndo — Security Demo Artifacts

This folder contains the artifacts produced to demonstrate Escenario 2: "Prevención ante ataques comunes" for a jury.

Included files
- `security-audit.json` / `security-audit.md` / `security-audit.html` — static auditor output (validation coverage, vulnerabilities)
- `test-security-output.txt` — saved output summary from `npm run test:security` (functional attack tests)
- `audit-run-output.txt` — saved output from `npm run audit:security` (static auditor run)

How to reproduce locally

1. Run the security tests (Jest):
```pwsh
npm run test:security
```

2. Run the static security auditor:
```pwsh
npm run audit:security
```

Packaging artifacts for the jury

Use the provided PowerShell script to build a zip with the key artifacts:

```pwsh
powershell -ExecutionPolicy Bypass -File .\scripts\package-jury.ps1
# or to specify output path
powershell -ExecutionPolicy Bypass -File .\scripts\package-jury.ps1 -out "artifacts\triviando-security-demo.zip"
```

What the jury expects
- 100% of critical inputs validated with Zod (static audit)
- 0 vulnerabilities reported by static audit
- Functional proof: tests simulate malicious payloads and assert HTTP 400 rejections (see `test-security-output.txt`)

Notes
- CI might enforce Jest coverage thresholds; the functional tests pass independently of thresholds. If you need CI to return exit code 0, consider running the tests without coverage enforcement or relaxing thresholds temporarily.
