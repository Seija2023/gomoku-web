# Security Policy

## Scope

Gomoku Web is a client-side application. Security reports are especially relevant when they involve:

- unsafe parsing of shared game / challenge payloads
- DOM injection or XSS
- corrupted localStorage data causing unsafe execution
- build / CI supply-chain behavior
- browser API misuse that exposes user data unexpectedly

AI move quality, game strategy and ordinary UI bugs are not security vulnerabilities.

## Reporting

Please avoid publishing exploit details in a public issue before the problem is understood.

If GitHub private vulnerability reporting is available for this repository, use that channel. Otherwise, open a minimal public issue stating that you have a security concern and need a private reporting channel; do not include working exploit payloads or sensitive details in that issue.

## Response

A valid report should include:

- affected version or commit
- browser / environment
- reproducible steps
- expected security boundary
- observed impact

Fixes should follow the normal pull-request quality gates before release whenever the issue does not require an emergency response.

## Supported Versions

The latest version on `main` is the actively maintained version. Older historical versions are not maintained as separate security branches.
