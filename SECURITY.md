# Security Policy

## Supported versions

The static site and published templates on `main` are the supported line.

## Reporting a vulnerability

Please email **admin@guardianbuilder.org** with:

- Description of the issue  
- Steps to reproduce (if applicable)  
- Impact assessment  

Do **not** open a public GitHub issue for sensitive vulnerabilities.

We aim to acknowledge reports within 7 days and provide a remediation plan when confirmed.

## Scope notes

- Interest-form and API handlers must not log secrets or full raw PII beyond intentional fields.  
- Prefer privacy-preserving defaults; no third-party tracking pixels on public pages.  
