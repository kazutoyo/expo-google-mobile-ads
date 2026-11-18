# Security Policy

## Supported Versions

Security fixes are provided for the latest stable release of
`@kazutoyo/expo-google-mobile-ads`. Please upgrade to the latest stable
release before reporting a vulnerability when possible.

Older releases and prereleases do not receive security fixes. Fixes are not
backported to older releases.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/kazutoyo/expo-google-mobile-ads/security/advisories/new).

Do not disclose vulnerability details in public issues, pull requests, or
discussions. If the private reporting form is unavailable, open an issue
requesting a private security contact without including vulnerability details.

Include the following information when available:

- The affected package version.
- Your Expo, React Native, operating system, and Google Mobile Ads SDK versions.
- A description of the vulnerability and its potential impact.
- Steps to reproduce it and a minimal reproduction or proof of concept.
- Relevant logs or screenshots with credentials, tokens, personal data, and
  other sensitive information removed.

Incomplete reports are welcome if you are unsure which component is affected.
Use test accounts and test ad units for reproductions.

## Scope

Reports may cover this repository's TypeScript API, iOS and Android native
implementations, Expo config plugin, or build and release tooling.

Vulnerabilities originating solely in the Google Mobile Ads SDK, Expo, React
Native, or another dependency should also be reported privately to the
respective upstream project through its security reporting process. We can
coordinate changes needed in this package. If you are unsure whether a problem
originates in this wrapper or an upstream dependency, please report it here.

For ordinary bugs and feature requests, use
[GitHub Issues](https://github.com/kazutoyo/expo-google-mobile-ads/issues).

## Response and Disclosure

This project is maintained on a best-effort basis:

- We aim to acknowledge reports within 7 calendar days.
- While a report is being investigated or a fix is in progress, we aim to
  provide an update at least every 14 calendar days.
- We will assess the impact and affected versions, and discuss next steps
  privately with the reporter.
- If a report is accepted, we will work toward a fix in the latest stable
  release and coordinate disclosure with the reporter. There is no guaranteed
  resolution deadline.
- If a report is declined or belongs to another project, we will explain why
  and provide an upstream reporting direction when possible.

Please coordinate public disclosure with us so that users have an opportunity
to update. For confirmed vulnerabilities, we will publish a GitHub Security
Advisory with affected versions, the fixed version, and any available
mitigations. We will request a CVE when appropriate and credit reporters with
their consent.
