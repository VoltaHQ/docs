# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a documentation repository for Volta, containing integration guides and API documentation for Stellar/Soroban. There is no build system, tests, or application code - only Markdown documentation files and TypeScript examples.

## Structure

- `stellar/` - Soroban smart contract integration documentation
  - `README.md` - Complete API reference with TypeScript and Go code examples
  - `troubleshooting.md` - Error codes and common issues
  - `tutorials/` - Step-by-step guides (getting-started, first-proposal, integration)
  - `examples/typescript/` - Runnable TypeScript example project

## Volta Contract Overview

The documentation covers a multi-signature governance contract (M-of-N voting) with:
- Multi-owner configuration with configurable voting thresholds (minimum 2 owners, threshold 2 to N)
- Proposal system: Config (change owners/threshold), Invoke (call other contracts), Upgrade (contract upgrades)
- Proposal lifecycle: Pending → Approved/Rejected/Revoked → Executed (with ~1 week TTL)

**Mainnet WASM Hash:** `ce84b965f3fdbf4ff9ea4c28813a7a30d6dd65c69d0d1bc19834d907a5e0d27b`

## Key Technical Constraints

- The `invoke()` method requires `auth_entries` to be provided for sub-contract calls that need the Volta contract's authorization
- Invoke proposals auto-count the creator's vote as Yes, requiring only `threshold - 1` additional votes
- Config and Upgrade proposal execution invalidates all pending proposals
- Cannot use `propose()` to create Invoke proposals - must use `invoke()` directly
