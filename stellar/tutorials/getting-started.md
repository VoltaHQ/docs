# Getting Started with Volta

Volta is a multi-signature governance contract for Stellar/Soroban that enables M-of-N voting for secure, decentralized decision-making.

## Prerequisites

- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) installed
- A funded Stellar account (testnet for development)
- Basic familiarity with Stellar/Soroban concepts

## Key Concepts

### Multi-Signature Governance

Volta implements M-of-N governance where:
- **N** = total number of owners
- **M** = threshold (minimum votes required to approve)

For example, a 2-of-3 configuration means 3 owners control the contract, and any 2 must agree to execute an action.

### Proposals

All actions in Volta go through the proposal system:

| Type | Purpose |
|------|---------|
| **Config** | Change owners or voting threshold |
| **Invoke** | Call another contract on behalf of Volta |
| **Upgrade** | Upgrade the Volta contract code |

### Proposal Lifecycle

```
Created → Pending → Approved → Executed
                 ↘ Rejected
                 ↘ Revoked (by creator)
                 ↘ Expired (~1 week TTL)
```

## Step 1: Deploy the Contract

The current WASM hash is: `557c34220a7ecc4a7abf9e1762adefb69adda14e31a34f27b6c0d4edb10ef64c`

```bash
# Upload the WASM (if not already uploaded)
stellar contract upload \
  --wasm volta.optimized.wasm \
  --source <YOUR_SOURCE_ACCOUNT> \
  --network testnet

# Deploy the contract
stellar contract deploy \
  --wasm-hash 557c34220a7ecc4a7abf9e1762adefb69adda14e31a34f27b6c0d4edb10ef64c \
  --source <YOUR_SOURCE_ACCOUNT> \
  --network testnet
```

Save the returned contract ID for the next steps.

## Step 2: Initialize with Owners

Initialize the contract with your owner addresses and threshold:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <YOUR_SOURCE_ACCOUNT> \
  --network testnet \
  -- \
  __constructor \
  --config '{"owners": ["GOWNER1...", "GOWNER2...", "GOWNER3..."], "threshold": 2}'
```

**Requirements:**
- Minimum 2 owners
- Threshold must be between 2 and owner count
- No duplicate owner addresses

## Step 3: Verify Configuration

Check that the contract is configured correctly:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_config
```

Expected output:
```json
{
  "owners": ["GOWNER1...", "GOWNER2...", "GOWNER3..."],
  "threshold": 2
}
```

## Step 4: Create Your First Proposal

See the [Creating Your First Proposal](./first-proposal.md) tutorial for detailed instructions on creating and voting on proposals.

## Contract Functions Reference

| Function | Description | Who Can Call |
|----------|-------------|--------------|
| `get_config` | View current owners and threshold | Anyone |
| `get_proposal` | View proposal details by ID | Anyone |
| `propose` | Create a Config or Upgrade proposal | Owners only |
| `invoke` | Create an Invoke proposal (auto-votes Yes) | Owners only |
| `vote` | Vote Yes/No/Abstain on a proposal | Owners only |
| `revoke_proposal` | Cancel a pending proposal | Original proposer only |
| `version` | Get contract version | Anyone |

## Security Considerations

1. **Protect owner keys**: Each owner key can vote on any proposal. Secure them appropriately.

2. **Coordinate votes**: Proposals expire after ~1 week. Ensure owners are available to vote.

3. **Review proposals carefully**: Once approved, Config and Upgrade proposals execute immediately and invalidate all pending proposals.

4. **Test on testnet first**: Always test contract interactions on testnet before mainnet.

## Next Steps

- [Creating Your First Proposal](./first-proposal.md)
- [Integrating Volta with Your dApp](./integration.md)
- [Troubleshooting Guide](../troubleshooting.md)
