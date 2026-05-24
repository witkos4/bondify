# Bondify

Bondify helps newly formed teams build rapport through quick, repeatable micro-games that fit naturally into standups, kickoffs, and short check-ins.

## Product Summary

The MVP centers on one core flow:

- A user signs in with OAuth
- A user creates a team and adds teammates by username
- Any team member opens a micro-game
- Each participant submits one anonymous response
- The team sees all responses together on a shared results screen

The goal is to create lightweight daily rituals that improve trust and reduce early-team friction without adding meeting overhead.

## Current Status

This repository currently holds the product planning and stack-selection artifacts for the Bondify MVP.

- PRD is in place
- Tech stack has been selected
- Project scaffolding is the next step

## Planned Stack

- Starter: 10x Astro Starter
- Language family: JavaScript
- Package manager: npm
- Deployment target: Cloudflare Workers
- CI provider: GitHub Actions

## Repository Layout

- `context/foundation/shape-notes.md` - shaping notes for the product
- `context/foundation/prd.md` - MVP product requirements
- `context/foundation/tech-stack.md` - selected stack and starter hand-off
- `context/changes/` - workflow artifacts for tracked changes
- `context/archive/` - archived change records

## MVP Principles

- Fast enough for short team rituals
- Minimal friction between opening the app and participating
- Anonymous responses by default
- Shared reveal as the core team moment
- Mobile web support from the start

## Next Step

Scaffold the selected starter into this repository and begin implementing the MVP flow.
