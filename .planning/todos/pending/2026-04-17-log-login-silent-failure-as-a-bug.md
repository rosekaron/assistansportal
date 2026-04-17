---
created: "2026-04-17T19:39:28.193Z"
title: Log login silent failure as a bug
area: auth
files:
  - client/src/pages/Login.tsx
  - server/src/routes/auth.ts
---

## Problem

During Phase 05 browser verification, the login form silently reset on invalid credentials — the email/password fields cleared and returned to placeholder state with no error message shown to the user. The API (`POST /api/auth/login`) correctly returns `{"error":"Invalid email or password"}` with a 4xx status, but the UI does not surface this to the user.

This makes login failures invisible: the user submits wrong credentials, the form just appears to reset, and they have no idea whether the email doesn't exist, the password is wrong, or if there's a network issue.

## Solution

In `client/src/pages/Login.tsx`, read the error from the API response and display it inline below the submit button (or on the relevant field). Pattern already used on the Register page — apply the same approach to the Sign In form.
