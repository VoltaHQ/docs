# Rules & Session Keys Guide

The Volta rules engine allows the admin to assign fine-grained permissions to user addresses. Users with rules can execute Cosmos messages through the wallet without multi-sig approval, as long as their messages satisfy at least one of their rule sets.

## Prerequisites

- Volta contract deployed and initialized (see [Getting Started](./getting-started.md))
- Admin key access (to propose rules)
- Owner key access (to vote on rule proposals)

## How Rules Work

1. The admin proposes a `Rules` proposal assigning rule sets to a user address
2. Owners vote to approve (M-of-N threshold)
3. Once approved, the user receives a fee grant and can send messages through the wallet
4. Each message is **flattened** into dot-notation key-value pairs
5. If **any** rule set passes (OR logic), the message executes immediately
6. If no rule set passes, the message becomes a CosmosMsgs proposal for owner voting

## Message Flattening

Before rules are evaluated, the Cosmos message is serialized to JSON and flattened. Nested objects become dot-separated keys:

**Original message:**
```json
{
  "bank": {
    "send": {
      "to_address": "inj1abc...",
      "amount": [{"denom": "inj", "amount": "5000000"}]
    }
  }
}
```

**Flattened:**
```
"bank.send.to_address"    → "inj1abc..."
"bank.send.amount.denom"  → "inj"
"bank.send.amount.amount" → "5000000"
```

**Wasm execute messages** get the inner JSON decoded and flattened with a prefix:
```
"wasm.execute.contract_addr"          → "inj1contract..."
"wasm.execute.funds.denom"            → "inj"
"wasm.execute.swap.input_denom"       → "inj"
"wasm.execute.swap.min_output_amount" → "1000"
```

**Stargate messages** have their binary `value` decoded and flattened under `stargate.value`.

## Rule Structure

### UserRules

```json
{
  "rules": [
    { "all": [ ...rules... ] },
    { "all": [ ...rules... ] }
  ],
  "nominal_limits": {
    "inj": "1000000000"
  }
}
```

- **`rules`**: List of `RuleSet` entries. **Any** set passing allows the message (OR between sets).
- **`nominal_limits`**: Optional per-denom daily spending caps for `BankMsg::Send`.

### RuleSet

Currently only `All` is supported — all rules in the set must match (AND logic):

```json
{ "all": [ rule1, rule2, rule3 ] }
```

### Rule

```json
{
  "field": "bank.send.to_address",
  "data_type": "string",
  "comparer": "eq",
  "value": "inj1allowed..."
}
```

| Field | Description |
|-------|-------------|
| `field` | Dot-notation path in the flattened message |
| `data_type` | How to parse both the rule value and the message field |
| `comparer` | Comparison operator |
| `value` | The value to compare against (as a string) |

### Data Types

| Type | Description | Supported Comparators |
|------|-------------|----------------------|
| `string` | String comparison | `eq`, `ne` |
| `int` | Parsed as `i64` | `eq`, `ne`, `gt`, `lt`, `ge`, `le` |
| `decimal` | Parsed as Cosmos `Decimal` | `eq`, `ne`, `gt`, `lt`, `ge`, `le` |
| `bool` | Parsed as boolean | `eq`, `ne` |

## Example Scenarios

### Scenario 1: Allow Bank Sends to a Specific Address

Allow a user to send inj to a specific recipient, with a daily limit of 1000 INJ:

```typescript
const rules = [
  {
    all: [
      {
        field: 'bank.send.to_address',
        data_type: 'string',
        comparer: 'eq',
        value: 'inj1allowed...',
      },
      {
        field: 'bank.send.amount.denom',
        data_type: 'string',
        comparer: 'eq',
        value: 'inj',
      },
    ],
  },
];

const nominalLimits = { inj: '1000000000' }; // 1000 INJ
```

### Scenario 2: Allow Wasm Contract Execution

Allow a user to call a specific DEX contract:

```typescript
const rules = [
  {
    all: [
      {
        field: 'wasm.execute.contract_addr',
        data_type: 'string',
        comparer: 'eq',
        value: 'inj1dex_contract...',
      },
    ],
  },
];
```

### Scenario 3: Limit Trade Size

Allow a user to trade on a DEX, but cap the input amount:

```typescript
const rules = [
  {
    all: [
      {
        field: 'wasm.execute.contract_addr',
        data_type: 'string',
        comparer: 'eq',
        value: 'inj1dex...',
      },
      {
        field: 'wasm.execute.swap.input_amount',
        data_type: 'int',
        comparer: 'le',
        value: '100000000', // max 100 tokens
      },
    ],
  },
];
```

### Scenario 4: Multiple Allowed Recipients (OR Logic)

Allow a user to send to either Alice or Bob:

```typescript
const rules = [
  // Rule set 1: send to Alice
  {
    all: [
      { field: 'bank.send.to_address', data_type: 'string', comparer: 'eq', value: 'inj1alice...' },
      { field: 'bank.send.amount.denom', data_type: 'string', comparer: 'eq', value: 'inj' },
    ],
  },
  // Rule set 2: send to Bob
  {
    all: [
      { field: 'bank.send.to_address', data_type: 'string', comparer: 'eq', value: 'inj1bob...' },
      { field: 'bank.send.amount.denom', data_type: 'string', comparer: 'eq', value: 'inj' },
    ],
  },
];
```

### Scenario 5: Injective Order Placement

Allow a user to place spot market orders on a specific market:

```typescript
const rules = [
  {
    all: [
      {
        field: 'stargate.value.@type',
        data_type: 'string',
        comparer: 'eq',
        value: '/injective.exchange.v1beta1.MsgCreateSpotMarketOrder',
      },
      {
        field: 'stargate.value.order.market_id',
        data_type: 'string',
        comparer: 'eq',
        value: '0x0611780ba69656949525013d947713300f56c37b6175e02f26bffa495c3208fe',
      },
    ],
  },
];
```

## Creating and Approving Rules

### Step 1: Admin Proposes Rules

```bash
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "propose": {
    "proposal": {
      "rules": {
        "addr": "inj1user...",
        "user_rules": {
          "rules": [
            {
              "all": [
                {
                  "field": "bank.send.to_address",
                  "data_type": "string",
                  "comparer": "eq",
                  "value": "inj1allowed..."
                }
              ]
            }
          ],
          "nominal_limits": {
            "inj": "1000000000"
          }
        }
      }
    }
  }
}' \
  --from <ADMIN_KEY> \
  --chain-id <CHAIN_ID> \
  --gas auto \
  --fees 500000000000000inj
```

### Step 2: Owners Vote

```bash
# Owner 1 votes
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "vote": { "proposal_id": 1, "vote": "yes" }
}' --from <OWNER1_KEY> --chain-id <CHAIN_ID> --gas auto --fees 500000000000000inj

# Owner 2 votes (meets threshold for m=2)
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "vote": { "proposal_id": 1, "vote": "yes" }
}' --from <OWNER2_KEY> --chain-id <CHAIN_ID> --gas auto --fees 500000000000000inj
```

### Step 3: User Executes Messages

Once the Rules proposal passes, the user can execute allowed messages:

```bash
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "cosmos_msg": {
    "bank": {
      "send": {
        "to_address": "inj1allowed...",
        "amount": [{"denom": "inj", "amount": "500000000"}]
      }
    }
  }
}' --from <USER_KEY> --chain-id <CHAIN_ID> --gas auto --fees 500000000000000inj
```

The transaction attributes will show `allowed=true` confirming the rules passed.

## Revoking Rules

### Revoke Rules for One User

```bash
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "propose": {
    "proposal": {
      "revoke_rules": { "addr": "inj1user..." }
    }
  }
}' --from <ADMIN_KEY> --chain-id <CHAIN_ID> --gas auto --fees 500000000000000inj

# Owners vote to approve...
```

When passed, the user's rules are removed and their fee grant is revoked (unless they are an owner).

### Revoke All Rules

```bash
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "propose": {
    "proposal": {
      "revoke_all_rules": {}
    }
  }
}' --from <ADMIN_KEY> --chain-id <CHAIN_ID> --gas auto --fees 500000000000000inj
```

When passed, all user rules are cleared and fee grants are revoked for all non-owner, non-admin addresses.

## Updating Rules

To update a user's rules, simply propose new rules for the same address. The new Rules proposal will **supersede** any existing open Rules proposal for that address. Once approved, the new rules completely replace the previous ones.

## Nominal Limits Behavior

- Limits are tracked per user, per denomination, per day (UTC day boundaries)
- Only applies to `BankMsg::Send` messages
- If a send would exceed the daily limit, the message falls through to the proposal queue
- Limits reset at the start of each new UTC day
- Setting `nominal_limits` to `null` or omitting it disables daily limit tracking

## Common Issues

- **Message falls to proposal despite having rules**: Check that the flattened field paths match exactly. Use the flattening examples above to verify.
- **Rule not matching**: Verify the `data_type` matches the actual field format. Numbers in JSON are strings after flattening.
- **Nominal limit exceeded**: Check the daily total across all sends, not just the current one.

See the [Troubleshooting Guide](../troubleshooting.md) for more details.

## Next Steps

- [API Reference](../index.md)
- [Troubleshooting Guide](../troubleshooting.md)
