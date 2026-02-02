# Integrating Volta with Your dApp

This tutorial covers how to integrate the Volta multi-signature contract into your decentralized application.

## Overview

Volta acts as a secure, multi-sig controlled account that can:
- Hold and transfer assets
- Call other contracts on behalf of the organization
- Manage its own configuration through governance

Your dApp can interact with Volta to provide multi-sig functionality for your users.

## Integration Patterns

### Pattern 1: Volta as Treasury

Use Volta to manage shared funds with multi-sig approval for withdrawals.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Owner 1   │────▶│             │     │             │
├─────────────┤     │    Volta    │────▶│   Token     │
│   Owner 2   │────▶│  (Treasury) │     │  Contract   │
├─────────────┤     │             │     │             │
│   Owner 3   │────▶│             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Pattern 2: Volta as Admin

Use Volta as the admin for other contracts, requiring multi-sig for admin actions.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Owners    │────▶│    Volta    │────▶│    Your     │
│  (multi)    │     │   (Admin)   │     │  Contract   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## JavaScript/TypeScript Integration

### Setup

```bash
npm install @stellar/stellar-sdk
```

### Reading Contract State

```typescript
import { Contract, SorobanRpc, Networks } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const contractId = 'CXXXXX...'; // Your Volta contract ID

// Get current configuration
async function getConfig() {
  const contract = new Contract(contractId);
  const tx = contract.call('get_config');

  const result = await server.simulateTransaction(tx);
  // Parse result...
  return result;
}

// Get proposal by ID
async function getProposal(proposalId: number) {
  const contract = new Contract(contractId);
  const tx = contract.call('get_proposal', proposalId);

  const result = await server.simulateTransaction(tx);
  // Parse result...
  return result;
}
```

### Creating a Proposal

```typescript
import {
  Keypair,
  Contract,
  TransactionBuilder,
  SorobanRpc,
  Networks,
  xdr
} from '@stellar/stellar-sdk';

async function createConfigProposal(
  ownerSecret: string,
  newOwners: string[],
  newThreshold: number
) {
  const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
  const ownerKeypair = Keypair.fromSecret(ownerSecret);
  const ownerPublic = ownerKeypair.publicKey();

  const contract = new Contract(contractId);
  const account = await server.getAccount(ownerPublic);

  // Build the proposal
  const proposal = {
    Config: {
      owners: newOwners,
      threshold: newThreshold
    }
  };

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(contract.call('propose', ownerPublic, proposal))
    .setTimeout(30)
    .build();

  // Simulate to get the prepared transaction
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(ownerKeypair);

  // Submit
  const response = await server.sendTransaction(prepared);
  // Handle response...

  return response;
}
```

### Voting on a Proposal

```typescript
async function vote(
  ownerSecret: string,
  proposalId: number,
  voteType: 'Yes' | 'No' | 'Abstain'
) {
  const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
  const ownerKeypair = Keypair.fromSecret(ownerSecret);
  const ownerPublic = ownerKeypair.publicKey();

  const contract = new Contract(contractId);
  const account = await server.getAccount(ownerPublic);

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(contract.call('vote', ownerPublic, proposalId, voteType))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(ownerKeypair);

  const response = await server.sendTransaction(prepared);
  return response;
}
```

### Invoking Another Contract

```typescript
async function invokeContract(
  ownerSecret: string,
  targetContract: string,
  functionName: string,
  args: xdr.ScVal[],
  authEntries: xdr.SorobanAuthorizationEntry[] = []
) {
  const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
  const ownerKeypair = Keypair.fromSecret(ownerSecret);
  const ownerPublic = ownerKeypair.publicKey();

  const contract = new Contract(contractId);
  const account = await server.getAccount(ownerPublic);

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(contract.call(
      'invoke',
      ownerPublic,
      targetContract,
      functionName,
      args,
      authEntries
    ))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(ownerKeypair);

  const response = await server.sendTransaction(prepared);
  return response;
}
```

## Monitoring Events

Subscribe to Volta events for real-time updates in your dApp.

### Event Types

| Event | Topic | Data |
|-------|-------|------|
| `ProposalEvent` | `new_prop`, `pend_prop`, `exec_prop`, `rej_prop`, `rev_prop` | Full proposal object |
| `VoteEvent` | `vote` | proposal_id, voter, vote, status |
| `ConfigSet` | `cfg_set` | New config |
| `InvokeOk` | `inv_ok` | proposal_id, result |
| `InvokeConversionError` | `inv_err` | proposal_id |

### Fetching Events

```typescript
async function getRecentEvents(startLedger: number) {
  const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

  const events = await server.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
      }
    ],
    limit: 100
  });

  return events.events;
}
```

## UI Considerations

### Proposal Status Display

```typescript
function getStatusDisplay(status: string) {
  const statusMap = {
    'Pending': { label: 'Awaiting Votes', color: 'yellow' },
    'Approved': { label: 'Approved', color: 'green' },
    'Rejected': { label: 'Rejected', color: 'red' },
    'Executed': { label: 'Executed', color: 'green' },
    'Revoked': { label: 'Revoked', color: 'gray' }
  };
  return statusMap[status] || { label: status, color: 'gray' };
}
```

### Vote Progress

```typescript
function calculateVoteProgress(proposal: Proposal, config: Config) {
  const yesVotes = Object.values(proposal.votes).filter(v => v === 'Yes').length;
  const noVotes = Object.values(proposal.votes).filter(v => v === 'No').length;
  const abstainVotes = Object.values(proposal.votes).filter(v => v === 'Abstain').length;
  const totalVotes = yesVotes + noVotes + abstainVotes;
  const remaining = config.owners.length - totalVotes;

  return {
    yes: yesVotes,
    no: noVotes,
    abstain: abstainVotes,
    remaining,
    threshold: config.threshold,
    canPass: yesVotes + remaining >= config.threshold,
    willPass: yesVotes >= config.threshold,
    willFail: yesVotes + remaining < config.threshold
  };
}
```

### Proposal Expiration Warning

Proposals expire after ~1 week. Show a warning when expiration is near:

```typescript
const WEEK_IN_LEDGERS = 120_960;
const LEDGER_TIME_SECONDS = 5;

function getExpirationWarning(proposalLedger: number, currentLedger: number) {
  const ledgersRemaining = (proposalLedger + WEEK_IN_LEDGERS) - currentLedger;
  const secondsRemaining = ledgersRemaining * LEDGER_TIME_SECONDS;
  const hoursRemaining = secondsRemaining / 3600;

  if (hoursRemaining < 24) {
    return `Expires in ${Math.round(hoursRemaining)} hours`;
  } else if (hoursRemaining < 72) {
    return `Expires in ${Math.round(hoursRemaining / 24)} days`;
  }
  return null;
}
```

## Error Handling

Map contract errors to user-friendly messages:

```typescript
const ERROR_MESSAGES: Record<number, string> = {
  2: 'Contract not initialized',
  5: 'Invalid owner configuration',
  6: 'Invalid threshold value',
  8: 'You are not an owner of this contract',
  9: 'Proposal not found or expired',
  10: 'You have already voted on this proposal',
  11: 'Proposal is no longer pending',
  12: 'Contract invocation failed',
  14: 'No changes in proposed configuration',
  15: 'Only the proposer can perform this action',
  19: 'Use invoke() for contract calls',
  22: 'Invalid upgrade hash',
  23: 'Target address is not a contract',
  24: 'Function name cannot be empty'
};

function handleContractError(error: any) {
  // Extract error code from Soroban error
  const code = extractErrorCode(error);
  return ERROR_MESSAGES[code] || 'Unknown error occurred';
}
```

## Security Best Practices

1. **Never store owner private keys in your dApp** - Use wallet integrations (Freighter, Albedo, etc.)

2. **Validate proposals client-side** before submission to catch errors early

3. **Show full proposal details** before asking users to vote

4. **Implement confirmation dialogs** for irreversible actions

5. **Monitor for config changes** - Alert users when owner set changes

## Next Steps

- [API Reference](../README.md)
- [Troubleshooting Guide](../troubleshooting.md)
