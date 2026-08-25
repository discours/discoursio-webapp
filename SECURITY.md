# Security policy

## Supported code

Security fixes target the current `dev` branch. This repository does not currently publish a supported-version matrix or GitHub releases, so older commits and untagged builds should be treated as unsupported unless a maintainer says otherwise.

## Reporting a vulnerability

Do not disclose exploitable details, credentials, private data, or proof-of-concept payloads in a public issue.

This repository does not yet publish a verified private security contact. If GitHub shows **Report a vulnerability** on the repository's Security tab, use that private channel. If it is unavailable, open a public issue containing only the title “Private security contact requested”; include no technical details. A maintainer will establish a private channel.

TODO(maintainers): enable GitHub private vulnerability reporting and publish a monitored security contact with response expectations.

Include privately, when a channel is established:

- affected commit, route, or component;
- impact and prerequisites;
- minimal reproduction steps;
- whether the issue appears to affect a deployed service;
- suggested mitigation, if known.

Never send real secrets. If exposure is suspected, identify only the affected credential type and rotate it at the source.
