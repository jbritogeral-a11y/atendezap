# Architecture rules

- Master cross-company mutations must authenticate and check the protected super-admin role before dynamically importing the privileged client; this prevents ordinary users from changing other companies.
- Manual plan assignment uses the existing company and subscription tables and preserves subscription identity on renewal; no separate billing schema is needed.