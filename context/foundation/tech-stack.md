---
starter_id: 10x-astro-starter
package_manager: npm
project_name: bondify
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Bondify is a web app with auth, a short three-week after-hours MVP window, and a medium initial scale, which favors a mainstream, opinionated starter that reduces assembly work. 10x Astro Starter is the vetted JavaScript default for this shape and keeps auth, database, and deployment aligned in one stack rather than making you stitch together separate choices before shipping. Cloudflare Pages is the starter's default deployment path, GitHub Actions fits the repository workflow cleanly, and auto-deploy on merge keeps the delivery loop short. Scaffolding support is first-class rather than fully verified, so the setup should be mostly smooth with occasional manual adjustments.