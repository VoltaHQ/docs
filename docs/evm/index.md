# Volta EVM Smart Account Integration Guide

This guide provides comprehensive documentation for integrating with the Volta ERC-4337 smart account deployed on EVM-compatible chains.

## Table of Contents

- [Overview](#overview)
- [Contract Architecture](#contract-architecture)
- [Contract Methods](#contract-methods)
- [TypeScript/JavaScript Examples](#typescriptjavascript-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Tutorials & Guides

New to Volta on EVM? Start here:

- **[Getting Started](./tutorials/getting-started.md)** - Deploy and initialize your first Volta smart account
- **[Session Keys](./tutorials/session-keys.md)** - Configure session keys with granular permissions
- **[Troubleshooting](./troubleshooting.md)** - Common errors and solutions

## Overview

The Volta smart account is an ERC-4337 account abstraction wallet that enables:

- **Multi-owner configuration**: M-of-N multi-signature with a configurable quorum threshold
- **Session keys**: Delegated signing keys with granular permission rules (target addresses, function selectors, parameter constraints, value limits, and time bounds)
- **Batch execution**: Execute multiple transactions atomically in a single UserOperation
- **Gas sponsorship**: Verifying paymaster for gasless transactions
- **Modular architecture**: Upgradeable executor and session key validator modules via UUPS proxy
- **ERC-1271 signatures**: On-chain signature validation for both owners and session keys

> **Key Design Note**
>
> The first owner in the owners array is always the Volta platform address. Volta's signature is required for privileged operations (enable/disable session keys, upgrades, owner changes), but is **not** counted toward the quorum for regular transactions.

## Contract Architecture

### Core Contracts

| Contract | Description |
|----------|-------------|
| **VoltaAccount** | Main smart account (ERC-4337 `BaseAccount` + UUPS upgradeable) |
| **VoltaFactory** | Deterministic account deployment via CREATE2 |
| **SessionKeyValidator** | Session key permission engine (delegatecalled by account) |
| **DefaultExecutor** | Transaction execution module (delegatecalled by account) |
| **VoltaVerifyingPaymaster** | Gas sponsorship via signed paymaster data |

### Key Concepts

- **Owners**: Addresses that can co-sign UserOperations. The first owner is always Volta.
- **Min Quorum**: Minimum number of **non-Volta** owner signatures required
- **Session Keys**: Delegated signers with scoped permissions (target contracts, function selectors, parameter rules, value limits, time bounds)
- **EntryPoint**: The ERC-4337 singleton that validates and executes UserOperations

### Signature Validation Flow

```
UserOperation received
    │
    ├─ Multiple signatures (len > 65)?
    │   └─ Validate as M-of-N owners
    │       ├─ Count unique non-Volta owner sigs
    │       ├─ Check quorum met
    │       └─ Check Volta signed (if privileged operation)
    │
    └─ Single signature (len == 65)?
        ├─ minQuorum == 1? Try as owner first
        └─ Validate as session key
            ├─ Check session key is enabled
            ├─ Check time bounds (validAfter/validUntil)
            └─ Validate call permissions (targets, selectors, params)
```

### Privileged Operations

The following operations require Volta's signature as part of the quorum:

- `enable` / `disable` (session key management)
- `upgradeTo` / `upgradeToAndCall` (account implementation upgrade)
- `upgradeSessionKeyValidator` / `upgradeExecutor` / `multiUpgrade`
- `updateOwners`
- `updateEntryPoint`

## Contract Methods

### `initialize(sessionKeyValidator, executor, owners, minQuorum, entryPoint)`

Initializes the smart account. Called once by the factory during deployment.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `sessionKeyValidator` | `address` | Session key validator contract |
| `executor` | `address` | Executor contract |
| `owners` | `address[]` | Owner addresses (first must be Volta) |
| `minQuorum` | `uint256` | Minimum non-Volta owner signatures required |
| `entryPoint` | `IEntryPoint` | ERC-4337 EntryPoint address |

**Requirements:**
- At least 3 addresses in `owners` (Volta + 2 non-Volta owners minimum)
- `minQuorum >= 1` and `minQuorum <= owners.length - 1`

---

### `execute(dest, value, data)`

Executes a single transaction. Must be called via the EntryPoint.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `dest` | `address` | Target contract address |
| `value` | `uint256` | ETH value to send (in wei) |
| `data` | `bytes` | Calldata for the target |

---

### `executeBatch(batchCall)`

Executes multiple transactions atomically. Must be called via the EntryPoint.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `batchCall` | `ExecuteBatchCall` | Struct containing an array of `Call` structs |

**Structs:**
```solidity
struct Call {
    address target;
    uint256 value;
    bytes data;
}

struct ExecuteBatchCall {
    Call[] calls;
}
```

---

### `enable(instructions)`

Enables session keys with permission rules. Requires Volta's signature.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `instructions` | `EnableUserInstruction[]` | Array of session key configurations |

**`EnableUserInstruction` struct:**

| Field | Type | Description |
|-------|------|-------------|
| `userAddress` | `address` | Session key address |
| `rules` | `AccessRuleRecipe[]` | Per-target permission rules |
| `globalMaxValue` | `uint256` | Global ETH send limit (when no calldata) |
| `validAfterUntil` | `uint96` | Two packed `uint48` timestamps: `validAfter \|\| validUntil` |
| `signaturesEnabled` | `bool` | Allow ERC-1271 signature validation for this key |

**`AccessRuleRecipe` struct:**

| Field | Type | Description |
|-------|------|-------------|
| `targetAddress` | `address` | Contract the session key can interact with |
| `enabled` | `bool` | Whether this target is accessible |
| `whitelisted` | `bool` | If true, all calls to this target are allowed |
| `maxValue` | `uint256` | Max ETH value for calls to this target |
| `selectorRules` | `SelectorRuleRecipe[]` | Per-function permission rules |

**`SelectorRuleRecipe` struct:**

| Field | Type | Description |
|-------|------|-------------|
| `selector` | `bytes4` | Function selector |
| `enabled` | `bool` | Whether this function is callable |
| `whitelisted` | `bool` | If true, any params are allowed |
| `paramRuleSets` | `ParamRuleSet[]` | Parameter constraints (OR logic between sets) |

**`ParamRuleSet` struct:**

| Field | Type | Description |
|-------|------|-------------|
| `paramRules` | `ParamRule[]` | Parameter rules (AND logic within a set) |
| `maxValue` | `uint256` | Max ETH value for this rule set |

**`ParamRule` struct:**

| Field | Type | Description |
|-------|------|-------------|
| `offset` | `uint256` | Byte offset of the parameter in calldata (after selector) |
| `param` | `bytes32` | Value to compare against |
| `condition` | `ParamCondition` | Comparison operator |

**`ParamCondition` enum:**
```
EQUAL, GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL, NOT_EQUAL
```

---

### `disable(instructions)`

Disables session keys. Requires Volta's signature.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `instructions` | `DisableUserInstruction[]` | Array containing `{ userAddress: address }` |

---

### `updateOwners(owners, minQuorum)`

Updates the owner set and quorum. Requires Volta's signature.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `owners` | `address[]` | New owner list (first must remain Volta) |
| `minQuorum` | `uint256` | New quorum threshold |

**Requirements:**
- `owners[0]` must be the current Volta address
- At least 3 addresses (Volta + 2 owners)
- `minQuorum >= 1` and `minQuorum <= owners.length - 1`
- No duplicate addresses

---

### `upgradeSessionKeyValidator(sessionKeyValidator)`

Replaces the session key validator module. Clears all existing session key data. Requires Volta's signature.

---

### `upgradeExecutor(executor)`

Replaces the executor module. Requires Volta's signature.

---

### `multiUpgrade(sessionKeyValidator, executor)`

Upgrades both modules in one call. Pass `address(0)` to skip either. Requires Volta's signature.

---

### `updateEntryPoint(entryPoint)`

Updates the ERC-4337 EntryPoint. Requires Volta's signature.

---

### `isValidSignature(hash, signature) -> bytes4`

ERC-1271 signature validation. Returns `0x20c13b0b` for valid signatures.

**Validation logic:**

1. Wraps `hash` with the account's EIP-712 domain separator
2. Single signature + `minQuorum == 1`: tries owner validation first, then session key
3. Single signature: validates as session key (if `signaturesEnabled` for that key)
4. Multiple signatures: validates M-of-N owner quorum

---

### `getDeposit() -> uint256`

Returns the account's deposit balance in the EntryPoint.

---

### `addDeposit()`

Deposits ETH to the EntryPoint for this account. Must be called via EntryPoint.

---

### `withdrawDepositTo(withdrawAddress, amount)`

Withdraws from the EntryPoint deposit. Must be called via EntryPoint.

---

## Factory Methods

### `createAccount(accountImplementation, salt, sessionKeyValidator, executor, owners, minQuorum, entryPoint, signature) -> VoltaAccount`

Deploys a new Volta smart account via CREATE2.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `accountImplementation` | `address` | VoltaAccount implementation address |
| `salt` | `uint256` | Deployment salt for deterministic address |
| `sessionKeyValidator` | `address` | Session key validator contract |
| `executor` | `address` | Executor contract |
| `owners` | `address[]` | Owner addresses (first must be Volta) |
| `minQuorum` | `uint256` | Quorum threshold |
| `entryPoint` | `IEntryPoint` | EntryPoint address |
| `signature` | `bytes` | Factory owner's signature over all parameters + chainId |

**Returns:** The deployed `VoltaAccount` proxy address.

---

### `getAddress(accountImplementation, salt) -> address`

Computes the counterfactual address of an account without deploying it.

---

## TypeScript/JavaScript Examples

### Setup

```typescript
import { ethers } from 'ethers';

// Connect to provider
const provider = new ethers.JsonRpcProvider('https://your-rpc-url');

// VoltaAccount ABI (key functions)
const VOLTA_ACCOUNT_ABI = [
  'function execute(address dest, uint256 value, bytes data)',
  'function executeBatch(tuple(tuple(address target, uint256 value, bytes data)[] calls) batchCall)',
  'function enable(tuple(address userAddress, tuple(address targetAddress, bool enabled, bool whitelisted, uint256 maxValue, tuple(bytes4 selector, bool enabled, bool whitelisted, tuple(tuple(uint256 offset, bytes32 param, uint8 condition)[] paramRules, uint256 maxValue)[] paramRuleSets)[] selectorRules)[] rules, uint256 globalMaxValue, uint96 validAfterUntil, bool signaturesEnabled)[] instructions)',
  'function disable(tuple(address userAddress)[] instructions)',
  'function updateOwners(address[] owners, uint256 minQuorum)',
  'function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)',
  'function getDeposit() view returns (uint256)',
];

// VoltaFactory ABI
const VOLTA_FACTORY_ABI = [
  'function createAccount(address accountImplementation, uint256 salt, address sessionKeyValidator, address executor, address[] owners, uint256 minQuorum, address entryPoint, bytes signature) returns (address)',
  'function getAddress(address accountImplementation, uint256 salt) view returns (address)',
];

const accountAddress = '0x...'; // Your Volta account address
const account = new ethers.Contract(accountAddress, VOLTA_ACCOUNT_ABI, provider);
```

### Check Account Deposit

```typescript
async function getDeposit(): Promise<bigint> {
  return await account.getDeposit();
}
```

### Compute Counterfactual Address

```typescript
async function getCounterfactualAddress(
  factoryAddress: string,
  implementationAddress: string,
  salt: bigint
): Promise<string> {
  const factory = new ethers.Contract(factoryAddress, VOLTA_FACTORY_ABI, provider);
  return await factory.getAddress(implementationAddress, salt);
}
```

### Build a UserOperation for Single Execute

```typescript
function buildExecuteCalldata(
  target: string,
  value: bigint,
  data: string
): string {
  const iface = new ethers.Interface(VOLTA_ACCOUNT_ABI);
  return iface.encodeFunctionData('execute', [target, value, data]);
}

// Example: encode an ERC-20 transfer through the smart account
const erc20Interface = new ethers.Interface([
  'function transfer(address to, uint256 amount)',
]);
const transferData = erc20Interface.encodeFunctionData('transfer', [
  '0xRecipient...',
  ethers.parseUnits('100', 18),
]);

const callData = buildExecuteCalldata(
  '0xTokenContract...',
  0n,
  transferData
);
```

### Build a UserOperation for Batch Execute

```typescript
function buildBatchCalldata(
  calls: { target: string; value: bigint; data: string }[]
): string {
  const iface = new ethers.Interface(VOLTA_ACCOUNT_ABI);
  return iface.encodeFunctionData('executeBatch', [{ calls }]);
}

// Example: approve + swap in one UserOp
const approveData = erc20Interface.encodeFunctionData('approve', [
  '0xRouter...',
  ethers.parseUnits('100', 18),
]);

const swapData = '0x...'; // Your swap calldata

const batchCallData = buildBatchCalldata([
  { target: '0xToken...', value: 0n, data: approveData },
  { target: '0xRouter...', value: 0n, data: swapData },
]);
```

### Sign a UserOperation (Multi-Sig)

```typescript
async function signUserOp(
  userOpHash: string,
  signers: ethers.Wallet[]
): Promise<string> {
  // Sort signers: Volta first (if included), then owners
  const signatures: string[] = [];

  for (const signer of signers) {
    const sig = await signer.signMessage(ethers.getBytes(userOpHash));
    signatures.push(sig);
  }

  // Concatenate all 65-byte signatures
  return ethers.concat(signatures);
}
```

### Enable a Session Key

```typescript
function buildEnableCalldata(
  sessionKeyAddress: string,
  allowedTargets: {
    targetAddress: string;
    whitelisted: boolean;
    maxValue: bigint;
    selectorRules: {
      selector: string;
      enabled: boolean;
      whitelisted: boolean;
    }[];
  }[],
  globalMaxValue: bigint,
  validAfter: number,  // unix timestamp
  validUntil: number,  // unix timestamp
  signaturesEnabled: boolean
): string {
  // Pack validAfter and validUntil into a uint96
  const validAfterUntil = (BigInt(validAfter) << 48n) | BigInt(validUntil);

  const instructions = [{
    userAddress: sessionKeyAddress,
    rules: allowedTargets.map(t => ({
      targetAddress: t.targetAddress,
      enabled: true,
      whitelisted: t.whitelisted,
      maxValue: t.maxValue,
      selectorRules: t.selectorRules.map(sr => ({
        selector: sr.selector,
        enabled: sr.enabled,
        whitelisted: sr.whitelisted,
        paramRuleSets: [],
      })),
    })),
    globalMaxValue,
    validAfterUntil,
    signaturesEnabled,
  }];

  const iface = new ethers.Interface(VOLTA_ACCOUNT_ABI);
  return iface.encodeFunctionData('enable', [instructions]);
}
```

### Disable a Session Key

```typescript
function buildDisableCalldata(sessionKeyAddress: string): string {
  const iface = new ethers.Interface(VOLTA_ACCOUNT_ABI);
  return iface.encodeFunctionData('disable', [[{ userAddress: sessionKeyAddress }]]);
}
```

## Error Handling

The contract uses `require` statements with descriptive error messages:

| Error Message | Cause |
|---------------|-------|
| `VAE: minQuorum must be greater than 0` | Quorum set to 0 during initialization or update |
| `VAE: At least 2 non-Volta owners required` | Fewer than 3 addresses in owners array |
| `VAE: Number of non-Volta owners must be greater than or equal to minQuorum` | Quorum exceeds number of non-Volta owners |
| `VAE: owner cannot be 0x0` | Zero address in owners array |
| `VAE: Duplicate owner` | Same address appears twice in owners |
| `VAE: first owner must be Volta` | `updateOwners` called with different first owner |
| `VAE: Volta must be the first signer` | Volta's signature is not first in concatenated signatures |
| `VAE: Invalid callData` | UserOp calldata shorter than 4 bytes |
| `VAE: sessionKeyValidator required` | Zero address for session key validator |
| `VAE: New sessionKeyValidator must be a contract` | Non-contract address for validator upgrade |
| `VAE: New sessionKeyValidator must be different` | Upgrading to the same validator |
| `VAE: executor required` | Zero address for executor |
| `VAE: New executor must be a contract` | Non-contract address for executor upgrade |
| `VAE: New executor must be different` | Upgrading to the same executor |
| `VAE: entryPoint required` | Zero address for EntryPoint |
| `VAE: entryPoint must be different` | Updating to the same EntryPoint |
| `VAE: withdrawAddress required` | Zero address for deposit withdrawal |

### Session Key Validator Errors

| Error Message | Cause |
|---------------|-------|
| `SKV: Invalid user address` | Zero address as session key |
| `SKV: Invalid call data length` | UserOp calldata too short for execute/executeBatch |
| `SKV: Target address not enabled` | Session key calling a contract not in its permissions |
| `SKV: User not enabled for this selector` | Function selector not allowed for session key |
| `SKV: Withdrawal limit exceeded` | ETH transfer exceeds the target's `maxValue` |
| `SKV: Param validation failed` | Call parameters don't match any `ParamRuleSet` |
| `SKV: unsupported selector` | UserOp uses a function other than `execute`/`executeBatch` |
| `SKV: Too many rules specified` | More than 64 access rules in one instruction |
| `SKV: Too many selector rules specified` | More than 64 selector rules per target |
| `SKV: Too many param rule sets specified` | More than 64 param rule sets per selector |

### Factory Errors

| Error Message | Cause |
|---------------|-------|
| `VF: Invalid owner` | Zero address as factory owner |
| `VF: Account already deployed` | Account with same implementation + salt exists |
| `VF: Invalid address` | Zero address for stake withdrawal |
| `invalid signature` | Factory owner signature verification failed |

### Executor Errors

| Error Message | Cause |
|---------------|-------|
| `DE: Call failed without revert reason` | Target call reverted without a message |

## Best Practices

1. **Always include Volta as first signer** for privileged operations (enable/disable, upgrades, owner changes)

2. **Use session keys for dApp interactions** rather than requiring full multi-sig for every transaction

3. **Set tight time bounds** on session keys using `validAfter` and `validUntil` to limit exposure

4. **Use parameter rules** to constrain session key actions (e.g., limit transfer amounts, restrict recipient addresses)

5. **Set appropriate `globalMaxValue`** to limit native token transfers by session keys

6. **Test on testnets first** before deploying to mainnet

7. **Use the factory's `getAddress`** to compute account addresses before deployment for counterfactual account flows

## Additional Resources

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-1271 Specification](https://eips.ethereum.org/EIPS/eip-1271)
