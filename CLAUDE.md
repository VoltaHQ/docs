# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a documentation repository for Volta, containing integration guides and API documentation. There is no build system, tests, or application code - only Markdown documentation files.

## Structure

- `stellar/` - Soroban smart contract integration documentation
  - `README.md` - Comprehensive guide for integrating with the Volta multi-signature governance contract on Stellar's Soroban platform

## Volta Contract Overview

The documentation covers a multi-signature governance smart contract with:
- Multi-owner configuration with voting thresholds
- Proposal system (Config, Invoke, Upgrade)
- TypeScript/JavaScript and Golang integration examples

**WASM Hash:** `557c34220a7ecc4a7abf9e1762adefb69adda14e31a34f27b6c0d4edb10ef64c`

## Key Technical Constraints

When working with Volta contract documentation, note that the `invoke()` method requires `auth_entries` to be provided for sub-contract calls that need the Volta contract's authorization.
