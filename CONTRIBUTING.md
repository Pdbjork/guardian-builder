# Contributing to Guardian Builder

Thank you for interest in contributing. This repository is the **open public-goods home** for Guardian Builder Foundation: website, research materials, and governance templates.

## Ways to contribute

1. **Site & docs** — fix typos, improve accessibility, clarify FAQ/privacy language.  
2. **Open templates** — improve governance, decision-log, and working-group templates under `open/`.  
3. **Research** — propose open briefs under `research/` (no confidential data).  
4. **Issues** — report bugs or suggest public-good deliverables.

## Ground rules

- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).  
- **No secrets** in PRs (API keys, tokens, `.env`, private donor data).  
- **No scraped contact lists** or non-consensual outreach tooling.  
- Keep advocacy honest: formation before scale; no hype that overclaims legal or scientific certainty.  
- Separate **dissertation / personal** material from foundation public goods unless explicitly dual-licensed and approved.

## Development (static site)

```bash
# Serve locally (any static server)
python3 -m http.server 8080
# open http://localhost:8080
```

Optional serverless functions under `api/` expect environment variables documented in each file. Do **not** commit secrets.

## Pull requests

1. Fork and branch from `main`.  
2. Keep changes focused.  
3. Describe *why* and link issues.  
4. Maintain Apache-2.0 licensing for contributions (default under this project).

## Security

See [SECURITY.md](./SECURITY.md).
