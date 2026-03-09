# Volta CosmWasm Smart Contract Integration Guide

This guide provides comprehensive documentation for integrating with the Volta multi-signature governance contract deployed on CosmWasm-compatible chains (Sei, Injective).

## Table of Contents

- [Overview](#overview)
- [Contract Architecture](#contract-architecture)
- [Messages](#messages)
- [Rules Engine](#rules-engine)
- [TypeScript/JavaScript Examples](#typescriptjavascript-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Tutorials & Guides

New to Volta on CosmWasm? Start here:

- **[Getting Started](./tutorials/getting-started.md)** - Deploy and initialize your first Volta contract
- **[Rules & Session Keys](./tutorials/rules.md)** - Configure user rules with the rules engine
- **[Troubleshooting](./troubleshooting.md)** - Common errors and solutions

## Overview

The Volta CosmWasm contract is a multi-signature governance wallet that enables:

- **Multi-owner configuration**: M-of-N multi-signature with configurable voting threshold
- **Rules engine**: Delegated users can execute Cosmos messages if they pass configurable rule sets (field-level constraints on flattened message JSON)
- **Proposal system**: Actions that fail rules or require governance go through M-of-N owner voting
- **Fee grants**: Automatic periodic fee grants for owners and authorized users (gas sponsorship)
- **Nominal daily limits**: Per-user daily spending caps on bank transfers
- **Multi-chain support**: Compiles for Sei and Injective via feature flags

> **Key Design Note**
>
> The contract has an **admin** (typically the Volta platform) who is the only address that can create Rule, RevokeRules, RevokeAllRules, and Configuration proposals. Owners vote on proposals. Regular users can execute Cosmos messages through the wallet if their rules allow it; otherwise the message falls through to the proposal queue for owner approval.

## Contract Architecture

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Propose configuration changes, rule changes, and rule revocations. Can also execute Cosmos messages (with empty rules — falls through to proposals). |
| **Owner** | Vote on proposals. Can execute Cosmos messages (falls through to proposals with auto-Yes vote). |
| **User (with rules)** | Execute Cosmos messages that pass their assigned rule sets. Messages that fail rules become proposals. |

### Proposal Lifecycle

```
Created → Open → Passed → Executed (messages dispatched)
                ↘ Rejected (cleaned up)
                ↘ Superseded (new proposal of same type replaces it)
```

**Superseding behavior:** For most proposal types, creating a new proposal of the same type automatically supersedes (cancels) the previous open one. This prevents duplicate proposals from accumulating. CosmosMsgs proposals are the exception — multiple can be active per address, up to `max_proposal_size`.

### Fee Grants

On instantiation, the contract automatically issues **periodic fee grants** to all owners and the admin. These are daily-resetting Cosmos SDK `PeriodicAllowance` grants scoped to `MsgExecuteContract` (and additional wasm messages for the admin). When users are granted rules, they also receive a fee grant. Revoking rules revokes the fee grant for non-owners.

## Messages

### InstantiateMsg

Initializes the contract with owners and configuration.

```json
{
  "config": {
    "admin": "sei1admin...",
    "m": 2,
    "max_proposal_size": 32,
    "periodic_fee_grant": {
      "denom": "usei",
      "amount": "14000000000"
    }
  },
  "owners": ["sei1owner1...", "sei1owner2...", "sei1owner3..."]
}
```

**Config fields:**

| Field | Type | Description |
|-------|------|-------------|
| `admin` | `Addr` | Admin address (typically Volta). Cannot be an owner. |
| `m` | `u64` | Voting threshold (minimum Yes votes to pass). Must be >= 2. |
| `max_proposal_size` | `u64` | Max active CosmosMsgs proposals per address (default: 32) |
| `periodic_fee_grant` | `Coin` | Daily fee grant limit for owners and users |

**Requirements:**
- At least 2 owners
- `m >= 2` and `m <= number of owners`
- Admin cannot be in the owners list
- No duplicate or invalid addresses in owners
- `periodic_fee_grant.amount` must be non-zero

---

### ExecuteMsg::CosmosMsg

Sends a Cosmos SDK message through the wallet. Available to the admin, owners, and users with rules.

```json
{
  "cosmos_msg": {
    "bank": {
      "send": {
        "to_address": "sei1recipient...",
        "amount": [{"denom": "usei", "amount": "1000000"}]
      }
    }
  }
}
```

**Behavior:**

1. The message is flattened into dot-notation key-value pairs
2. If the sender has rules and **any rule set** passes, the message is executed immediately (subject to nominal daily limits for bank sends)
3. If no rule set passes (or the sender is an owner/admin without rules), the message becomes a **CosmosMsgs proposal**
4. If the sender is an owner, their Yes vote is automatically recorded on the proposal

**Supported message types for rule matching:**
- `BankMsg` (send, burn)
- `StakingMsg` (delegate, undelegate, redelegate)
- `DistributionMsg`
- `GovMsg`
- `IbcMsg`
- `WasmMsg` (execute, instantiate, migrate — inner JSON is flattened with prefix)
- `Stargate` (binary value is decoded and flattened with prefix)

---

### ExecuteMsg::Propose

Creates a proposal. **Admin only.**

```json
{
  "propose": {
    "proposal": {
      "rules": {
        "addr": "sei1user...",
        "user_rules": {
          "rules": [
            {
              "all": [
                {
                  "field": "bank.send.to_address",
                  "data_type": "string",
                  "comparer": "eq",
                  "value": "sei1allowed..."
                }
              ]
            }
          ],
          "nominal_limits": {
            "usei": "1000000000"
          }
        }
      }
    }
  }
}
```

**Proposal Types:**

| Type | Description | Supersedes Previous? |
|------|-------------|---------------------|
| `Configuration` | Change config (admin, m, owners, fee grant settings) | Yes |
| `CosmosMsgs` | Execute Cosmos messages (created via CosmosMsg fallthrough) | No (capped at `max_proposal_size` per addr) |
| `Rules` | Set rules for a user address | Yes (per address) |
| `RevokeRules` | Remove rules for a specific user | Yes (per address) |
| `RevokeAllRules` | Remove all user rules | Yes |

---

### ExecuteMsg::Vote

Casts a vote on a proposal. **Owners only.**

```json
{
  "vote": {
    "proposal_id": 1,
    "vote": "yes"
  }
}
```

**Vote types:** `yes`, `no`

**Voting logic:**
- Proposal **passes** when `yes votes >= m`
- Proposal is **rejected** when `no votes > (total_owners - m)` (mathematically impossible to pass)
- Each owner can vote only once per proposal

**On pass:** The proposal's action is automatically executed (config applied, messages sent, rules saved, etc.)

---

### QueryMsg::GetProposals

Retrieves proposals by filter.

```json
{
  "get_proposals": {
    "filter": "all"
  }
}
```

**Filters:** `all`, `config_proposal`, `cosmos_msg_proposals`, `revoke_all_proposal`, `revoke_proposals`, `rule_proposals`

**Response:**
```json
[
  {
    "id": 1,
    "initiator": "sei1admin...",
    "addr": "sei1user...",
    "target": { "rules": { "addr": "sei1user...", "user_rules": { ... } } },
    "state": "open",
    "yes": 0,
    "no": 0,
    "created_at": "1693526400000000000"
  }
]
```

---

## Rules Engine

The rules engine evaluates Cosmos messages against user-defined rule sets. Messages are **flattened** into dot-notation key-value pairs, then checked against rules.

### Message Flattening

A Cosmos message like:
```json
{
  "bank": {
    "send": {
      "to_address": "sei1abc...",
      "amount": [{"denom": "usei", "amount": "1000"}]
    }
  }
}
```

Becomes a flat map:
```
"bank.send.to_address" → "sei1abc..."
"bank.send.amount.denom" → "usei"
"bank.send.amount.amount" → "1000"
```

For `WasmMsg::Execute`, the inner contract message is decoded and flattened with the prefix `wasm.execute`:
```
"wasm.execute.contract_addr" → "sei1contract..."
"wasm.execute.swap.input_token" → "usei"
"wasm.execute.swap.min_output" → "1000"
```

### Rule Sets

Each user has a `UserRules` containing:
- **`rules`**: A list of `RuleSet` entries. If **any** rule set passes, the message is allowed (OR logic between sets).
- **`nominal_limits`**: Optional daily spending limits per denomination (only enforced on `BankMsg::Send`).

A `RuleSet::All(rules)` passes only if **all** rules in the set match (AND logic within a set).

### Rule Definition

```json
{
  "field": "bank.send.to_address",
  "data_type": "string",
  "comparer": "eq",
  "value": "sei1allowed..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `field` | `String` | Dot-notation path in the flattened message |
| `data_type` | `DataType` | How to parse the value: `string`, `int`, `bool`, `decimal` |
| `comparer` | `Comparator` | Comparison operator |
| `value` | `String` | Value to compare against |

**Comparators:**

| Comparator | String | Int/Decimal | Bool |
|------------|--------|-------------|------|
| `eq` | Yes | Yes | Yes |
| `ne` | Yes | Yes | Yes |
| `gt` | No | Yes | No |
| `lt` | No | Yes | No |
| `ge` | No | Yes | No |
| `le` | No | Yes | No |

### Nominal Daily Limits

If a user has `nominal_limits` set, bank sends are tracked per-denom per-day. If a send would cause the daily total to exceed the limit, the message falls through to the proposal queue instead of executing.

```json
{
  "nominal_limits": {
    "usei": "1000000000",
    "usdc": "500000000"
  }
}
```

## TypeScript/JavaScript Examples

### Setup

```typescript
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { GasPrice } from '@cosmjs/stargate';

const rpcEndpoint = 'https://rpc.sei-testnet.example.com';
const contractAddress = 'sei1contract...';

async function getClient(mnemonic: string) {
  const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'sei',
  });
  return SigningCosmWasmClient.connectWithSigner(rpcEndpoint, wallet, {
    gasPrice: GasPrice.fromString('0.01usei'),
  });
}
```

### Query Proposals

```typescript
async function getProposals(
  client: SigningCosmWasmClient,
  filter: string = 'all'
) {
  return client.queryContractSmart(contractAddress, {
    get_proposals: { filter },
  });
}
```

### Execute a Cosmos Message (as a user with rules)

```typescript
async function sendTokens(
  client: SigningCosmWasmClient,
  senderAddress: string,
  recipient: string,
  amount: string,
  denom: string
) {
  const msg = {
    cosmos_msg: {
      bank: {
        send: {
          to_address: recipient,
          amount: [{ denom, amount }],
        },
      },
    },
  };

  return client.execute(senderAddress, contractAddress, msg, 'auto');
}
```

### Execute a Wasm Message Through Volta

```typescript
async function executeWasmMsg(
  client: SigningCosmWasmClient,
  senderAddress: string,
  targetContract: string,
  executeMsg: object,
  funds: { denom: string; amount: string }[] = []
) {
  const msg = {
    cosmos_msg: {
      wasm: {
        execute: {
          contract_addr: targetContract,
          msg: Buffer.from(JSON.stringify(executeMsg)).toString('base64'),
          funds,
        },
      },
    },
  };

  return client.execute(senderAddress, contractAddress, msg, 'auto');
}
```

### Propose Rules for a User (admin only)

```typescript
async function proposeRules(
  client: SigningCosmWasmClient,
  adminAddress: string,
  userAddress: string,
  rules: object[],
  nominalLimits?: Record<string, string>
) {
  const msg = {
    propose: {
      proposal: {
        rules: {
          addr: userAddress,
          user_rules: {
            rules: rules.map(ruleSet => ({ all: ruleSet })),
            nominal_limits: nominalLimits || null,
          },
        },
      },
    },
  };

  return client.execute(adminAddress, contractAddress, msg, 'auto');
}

// Example: allow user to send usei to a specific address, max 1000 SEI/day
await proposeRules(client, adminAddress, userAddress, [
  [
    {
      field: 'bank.send.to_address',
      data_type: 'string',
      comparer: 'eq',
      value: 'sei1allowed...',
    },
  ],
], { usei: '1000000000' });
```

### Vote on a Proposal

```typescript
async function vote(
  client: SigningCosmWasmClient,
  ownerAddress: string,
  proposalId: number,
  voteType: 'yes' | 'no'
) {
  const msg = {
    vote: {
      proposal_id: proposalId,
      vote: voteType,
    },
  };

  return client.execute(ownerAddress, contractAddress, msg, 'auto');
}
```

### Propose a Configuration Change (admin only)

```typescript
async function proposeConfigChange(
  client: SigningCosmWasmClient,
  adminAddress: string,
  newConfig: {
    admin: string;
    m: number;
    max_proposal_size: number;
    periodic_fee_grant: { denom: string; amount: string };
  },
  newOwners: string[]
) {
  const msg = {
    propose: {
      proposal: {
        configuration: {
          new_config: newConfig,
          owners: newOwners,
        },
      },
    },
  };

  return client.execute(adminAddress, contractAddress, msg, 'auto');
}
```

### Revoke Rules for a User (admin only)

```typescript
async function proposeRevokeRules(
  client: SigningCosmWasmClient,
  adminAddress: string,
  userAddress: string
) {
  const msg = {
    propose: {
      proposal: {
        revoke_rules: { addr: userAddress },
      },
    },
  };

  return client.execute(adminAddress, contractAddress, msg, 'auto');
}
```

### Revoke All Rules (admin only)

```typescript
async function proposeRevokeAllRules(
  client: SigningCosmWasmClient,
  adminAddress: string
) {
  const msg = {
    propose: {
      proposal: {
        revoke_all_rules: {},
      },
    },
  };

  return client.execute(adminAddress, contractAddress, msg, 'auto');
}
```

## Error Handling

| Error | Cause |
|-------|-------|
| `Unauthorized` | Sender is not an admin, owner, or user with rules |
| `InvalidM` | Threshold `m` is less than 2 or greater than the number of owners |
| `InvalidMaxProposalSize` | `max_proposal_size` is less than 1 |
| `TooFewOwners` | Fewer than 2 valid owners provided |
| `InvalidOwners` | Duplicate owners, invalid addresses, or admin is in the owners list |
| `InvalidAddress` | An address failed validation |
| `InvalidPayload` | Cosmos message could not be serialized/deserialized for rule evaluation |
| `UnsupportedCosmosMsg` | Message type not supported by the rules engine |
| `ProposalNotOpen` | Attempting to vote on a non-open proposal |
| `ProposalNotFound` | Proposal ID does not exist |
| `AlreadyVoted` | Owner has already voted on this proposal |
| `ProposalExpired` | Proposal has expired |
| `AlreadyFeeGranted` | Fee grant already exists for this address |
| `NotFeeGranted` | No fee grant to revoke for this address |
| `ZeroPeriodicFeeGrant` | `periodic_fee_grant.amount` is zero |
| `NoRulesToRevoke` | No rules exist for the address in a RevokeRules proposal |

## Best Practices

1. **Set appropriate `m` threshold**: Use `m >= 2` to prevent single-owner takeover. For high-value wallets, consider higher thresholds.

2. **Use rules for routine operations**: Assign rules to users who need to perform repetitive actions (e.g., trading, transfers) so they don't need multi-sig approval for every transaction.

3. **Set nominal daily limits**: Always pair rules with `nominal_limits` for bank sends to cap daily exposure.

4. **Use tight field matching**: Write rules that match specific fields rather than leaving them open. For example, constrain `to_address` and use `le` on amounts.

5. **Monitor proposals**: Query proposals regularly to ensure timely voting. Proposals can be superseded if a new one of the same type is created.

6. **Test on testnet first**: Always test rule configurations on testnet before deploying to mainnet.

7. **Coordinate config changes**: Configuration proposals reset all open proposals when executed. Coordinate changes to minimize disruption.

## Additional Resources

- [CosmWasm Documentation](https://docs.cosmwasm.com/)
- [Sei Documentation](https://docs.sei.io/)
- [Injective Documentation](https://docs.injective.network/)
