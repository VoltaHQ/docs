# Getting Started with Volta on CosmWasm

Volta on CosmWasm is a multi-signature governance wallet for CosmWasm-compatible chains that enables M-of-N owner voting, a rules engine for delegated user access, and automatic fee grants. The primary deployment target is Injective.

## Prerequisites

- A funded wallet on your target chain (e.g., Injective testnet)
- [CosmWasm CLI tools](https://docs.cosmwasm.com/) or a client library like `@cosmjs/cosmwasm-stargate`
- Basic familiarity with CosmWasm contracts and Cosmos SDK messages

## Key Concepts

### Multi-Signature Governance

Volta implements M-of-N governance where:
- **N** = total number of owners
- **M** = threshold (`m` in config, minimum Yes votes required, must be >= 2)

For example, a 2-of-3 configuration means 3 owners and any 2 must vote Yes to pass a proposal.

### Roles

| Role | Who | Can Do |
|------|-----|--------|
| **Admin** | Volta platform (single address) | Create proposals (rules, config, revoke) |
| **Owners** | N addresses | Vote on proposals, execute Cosmos messages (falls to proposal queue) |
| **Users** | Addresses with assigned rules | Execute Cosmos messages that pass their rules |

### Proposal Types

| Type | Purpose | Who Creates |
|------|---------|-------------|
| **Configuration** | Change admin, owners, threshold, or fee grant settings | Admin |
| **Rules** | Assign rules to a user address | Admin |
| **RevokeRules** | Remove rules from a specific user | Admin |
| **RevokeAllRules** | Remove all user rules | Admin |
| **CosmosMsgs** | Execute arbitrary Cosmos messages | Auto-created when a message fails rules |

### Proposal Lifecycle

```
Open → Passed → Executed (action applied)
     ↘ Rejected (threshold mathematically impossible)
     ↘ Superseded (new proposal of same type replaces it)
```

## Step 1: Deploy the Contract

### Build

```bash
# Clone the repository
cd smart-contract-cosmwasm

# Build with the appropriate feature flag for your target chain
# For Injective:
cargo build --release --target wasm32-unknown-unknown --features injective

# Optimize (recommended for deployment)
docker run --rm -v "$(pwd)":/code \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/optimizer:0.16.0
```

### Upload and Instantiate

```bash
# Upload the WASM
injectived tx wasm store artifacts/volta.wasm \
  --from <YOUR_KEY> \
  --chain-id <CHAIN_ID> \
  --gas auto \
  --gas-adjustment 1.3 \
  --fees 500000000000000inj

# Note the code_id from the response

# Instantiate
injectived tx wasm instantiate <CODE_ID> '{
  "config": {
    "admin": "inj1admin...",
    "m": 2,
    "max_proposal_size": 32,
    "periodic_fee_grant": {
      "denom": "inj",
      "amount": "227000000000000000000"
    }
  },
  "owners": ["inj1owner1...", "inj1owner2..."]
}' \
  --label "volta-wallet" \
  --from <YOUR_KEY> \
  --admin <ADMIN_ADDRESS> \
  --chain-id <CHAIN_ID> \
  --gas auto \
  --gas-adjustment 1.3 \
  --fees 500000000000000inj
```

**Requirements:**
- At least 2 owners
- `m >= 2` and `m <= number of owners`
- Admin address cannot be in the owners list
- All addresses must be valid and unique
- `periodic_fee_grant.amount` must be non-zero

## Step 2: Verify the Contract

Query proposals to verify the contract is working:

```bash
injectived query wasm contract-state smart <CONTRACT_ADDRESS> '{
  "get_proposals": { "filter": "all" }
}'
```

Expected response (empty list for a fresh contract):
```json
{ "data": [] }
```

## Step 3: Fund the Contract

Send tokens to the contract address so it can issue fee grants and fund user transactions:

```bash
injectived tx bank send <YOUR_KEY> <CONTRACT_ADDRESS> 1000000000inj \
  --chain-id <CHAIN_ID> \
  --gas auto \
  --fees 500000000000000inj
```

## Step 4: Test a Transaction

As an owner, try sending tokens through the wallet. Since owners don't have rules, this will create a CosmosMsgs proposal:

```bash
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "cosmos_msg": {
    "bank": {
      "send": {
        "to_address": "inj1recipient...",
        "amount": [{"denom": "inj", "amount": "1000000"}]
      }
    }
  }
}' \
  --from <OWNER_KEY> \
  --chain-id <CHAIN_ID> \
  --gas auto \
  --fees 500000000000000inj
```

Check the transaction attributes for `proposal_id` and `allowed=false`, confirming the message was queued as a proposal.

## Step 5: Vote on the Proposal

The second owner votes Yes to meet the threshold:

```bash
injectived tx wasm execute <CONTRACT_ADDRESS> '{
  "vote": {
    "proposal_id": 1,
    "vote": "yes"
  }
}' \
  --from <OWNER2_KEY> \
  --chain-id <CHAIN_ID> \
  --gas auto \
  --fees 500000000000000inj
```

With 2 Yes votes (the proposing owner's auto-vote + this one), the proposal passes and the bank send is executed.

## Contract Functions Reference

| Message | Description | Who Can Call |
|---------|-------------|-------------|
| `CosmosMsg` | Execute a Cosmos message (rules-checked, falls to proposal if denied) | Admin, Owners, Users with rules |
| `Propose { Configuration }` | Propose config change (admin, owners, m) | Admin only |
| `Propose { Rules }` | Assign rules to a user | Admin only |
| `Propose { RevokeRules }` | Remove rules for a user | Admin only |
| `Propose { RevokeAllRules }` | Remove all user rules | Admin only |
| `Vote` | Vote Yes/No on a proposal | Owners only |
| `GetProposals` (query) | List proposals by filter | Anyone |

## Security Considerations

1. **Admin is privileged**: The admin (Volta) controls what proposals are created. Owners vote to approve/reject.

2. **Owners auto-vote Yes on their own messages**: When an owner sends a CosmosMsg that falls to a proposal, they get an automatic Yes vote. This means a 2-of-N wallet needs only 1 more vote.

3. **Config changes reset proposals**: When a Configuration proposal passes, **all open proposals are reset** (votes cleared, not superseded). This is a security feature ensuring the new owner set re-evaluates pending actions.

4. **Fee grants are managed automatically**: The contract manages fee grants for all parties. Revoking rules also revokes fee grants for non-owners.

5. **Daily limits only apply to BankMsg::Send**: The `nominal_limits` feature tracks daily bank send totals per user per denom. It does not apply to other message types.

## Next Steps

- [Rules & Session Keys Guide](./rules.md)
- [API Reference](../index.md)
- [Troubleshooting Guide](../troubleshooting.md)
