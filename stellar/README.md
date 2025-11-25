# Volta Soroban Smart Contract Integration Guide

This guide provides comprehensive documentation for integrating with the Volta multi-signature governance smart contract deployed on Soroban (Stellar's smart contract platform).

## Table of Contents

- [Overview](#overview)
- [Contract Architecture](#contract-architecture)
- [Installation](#installation)
- [Contract Methods](#contract-methods)
- [TypeScript/JavaScript Examples](#typescriptjavascript-examples)
- [Golang Examples](#golang-examples)
- [Error Handling](#error-handling)
- [Events](#events)

## Overview

The Volta contract is a multi-signature governance contract that enables:

- **Multi-owner configuration**: Multiple owners with configurable voting thresholds
- **Proposal system**: Owners can create proposals for various actions
- **Voting mechanism**: Owners vote on proposals with configurable thresholds
- **User rules system**: Granular permission system for non-owners
- **Contract invocation**: Ability to call other contracts with proper authorization
- **Upgrade mechanism**: Contract upgrade capabilities

> **📦 Mainnet Deployment**
> 
> **WASM Hash:** `e2b96ebd7dbdb22ff90f3b70bb8a10945fc15571bea0397df284a4cbb9639841`
> 
> This is the verified WASM hash for the Volta contract deployed on Stellar mainnet. Use this hash to verify contract integrity when deploying or interacting with the contract.

## Contract Architecture

### Key Concepts

- **Owners**: Addresses that can create proposals and vote
- **Threshold**: Minimum number of "Yes" votes required to approve a proposal
- **Proposals**: Actions that require owner consensus before execution
- **User Rules**: Granular permissions for non-owners to invoke specific contract functions
- **Proposal Types**: Config, UserRules, RevokeUserRules, Invoke, Upgrade

### Proposal Lifecycle

1. **Pending**: Proposal created, awaiting votes
2. **Approved**: Threshold reached, ready for execution
3. **Executed**: Proposal executed successfully
4. **Rejected**: Approval becomes mathematically impossible
5. **Revoked**: Creator revokes the proposal

### Limitations

> **⚠️ Auth Tree Depth Limitation**
> 
> The contract can only invoke other contracts directly (single hop). If the invoked contract attempts to call a third contract that requires authorization, the execution will fail. Multi-hop contract invocations requiring authorization are not supported. This limitation affects the `invoke()` method and any proposals that execute contract invocations.

## Installation

### TypeScript/JavaScript

```bash
npm install @stellar/stellar-sdk soroban-client
```

### Golang

```bash
go get github.com/stellar/go/clients/horizonclient
go get github.com/stellar/go/txnbuild
```

## Contract Methods

### `version() -> u32`

Returns the contract version number.

**Returns:**
- `u32`: Contract version

---

### `get_config() -> ConfigInput`

Retrieves the current contract configuration.

**Returns:**
- `ConfigInput`: Object containing:
  - `owners: Vec<Address>`: List of owner addresses
  - `threshold: u32`: Minimum votes required for approval

**Errors:**
- `NotInitialized`: Contract has not been initialized

---

### `propose(owner: Address, proposal: ProposalInput) -> Proposal`

Creates a new proposal. Only owners can create proposals.

**Parameters:**
- `owner: Address`: The address of the owner creating the proposal (must match caller)
- `proposal: ProposalInput`: The proposal to create (see Proposal Types below)

**Returns:**
- `Proposal`: The created proposal object

**Proposal Types:**

1. **Config**: Change contract configuration (owners/threshold)
   ```rust
   ProposalInput::Config({
     owners: Address[],
     threshold: u32
   })
   ```

2. **UserRules**: Grant permissions to a user
   ```rust
   ProposalInput::UserRules({
     user: Address,
     rules: RuleSet[]
   })
   ```

3. **RevokeUserRules**: Remove permissions from a user
   ```rust
   ProposalInput::RevokeUserRules(Address)
   ```

4. **Upgrade**: Upgrade the contract
   ```rust
   ProposalInput::Upgrade(BytesN<32>) // WASM hash
   ```

**Note:** `Invoke` proposals cannot be directly created via `propose()`. They are automatically created when owners call `invoke()` without matching user rules.

**Errors:**
- `NotOwner`: Caller is not an owner
- `InvokeNotAllowed`: Attempted to propose an Invoke proposal directly
- `InvalidOwners`: Invalid owner configuration (duplicates or < 2 owners)
- `InvalidThreshold`: Threshold out of valid range
- `NoConfigChanges`: Config proposal identical to current config
- `EmptyUserRules`: UserRules proposal contains no rules
- `DuplicateRulesets`: UserRules proposal contains duplicate rulesets
- `NoRulesToRevoke`: RevokeUserRules for user with no rules
- `InvalidUpgrade`: Upgrade hash is all zeros

---

### `vote(owner: Address, proposal_id: u64, vote: VoteType) -> Proposal`

Votes on a proposal. Only owners can vote.

**Parameters:**
- `owner: Address`: The voting owner's address (must match caller)
- `proposal_id: u64`: The ID of the proposal to vote on
- `vote: VoteType`: The vote type (`Yes`, `No`, or `Abstain`)

**Returns:**
- `Proposal`: Updated proposal object

**Vote Types:**
- `VoteType::Yes`: Approve the proposal
- `VoteType::No`: Reject the proposal
- `VoteType::Abstain`: Neutral vote (doesn't count toward approval/rejection)

**Voting Logic:**
- Proposal is **Approved** when `Yes` votes >= threshold
- Proposal is **Rejected** when approval becomes mathematically impossible
- Proposal remains **Pending** otherwise
- Approved proposals are automatically executed

**Errors:**
- `NotOwner`: Caller is not an owner
- `ProposalNotFound`: Proposal doesn't exist
- `ProposalNotPending`: Proposal is not in pending status
- `VoterAlreadyVoted`: Owner has already voted on this proposal

---

### `invoke(caller: Address, contract: Address, fn_name: Symbol, args: Vec<Val>) -> ()`

Invokes a function on another contract. Can be called by owners or users with matching rules.

**Parameters:**
- `caller: Address`: The caller's address (must match caller)
- `contract: Address`: The contract address to invoke
- `fn_name: Symbol`: The function name to call
- `args: Vec<Val>`: Arguments to pass to the function

**Behavior:**
- If caller has matching user rules: Executes immediately
- If caller is an owner without matching rules: Creates an Invoke proposal (auto-voted Yes)
- Otherwise: Returns error

**Returns:**
- `()`: Success (no return value)

**Errors:**
- `NotOwner`: Caller is not an owner and has no user rules
- `RuleNotAllowed`: User rules don't allow this invocation
- `InvokeError`: Contract invocation failed

> **⚠️ Important Limitation: Auth Tree Depth**
> 
> This contract can only call another contract directly (single hop). If the invoked contract attempts to call a third contract that requires authorization, the execution will fail. The auth tree cannot extend beyond a single hop - multi-hop contract invocations requiring authorization are not supported.

---

### `revoke_proposal(caller: Address, proposal_id: u64) -> ()`

Revokes a proposal. Only the proposal creator can revoke pending proposals.

**Parameters:**
- `caller: Address`: The caller's address (must match caller)
- `proposal_id: u64`: The ID of the proposal to revoke

**Returns:**
- `()`: Success

**Errors:**
- `NotCaller`: Caller is not the proposal creator
- `ProposalNotPending`: Proposal is not in pending status
- `ProposalNotFound`: Proposal doesn't exist

---

## TypeScript/JavaScript Examples

### Setup

```typescript
import {
  Contract,
  Networks,
  SorobanRpc,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { SorobanRpc as SorobanRpcType } from '@stellar/stellar-sdk';

// Initialize RPC client
const rpcUrl = 'https://soroban-testnet.stellar.org';
const rpc = new SorobanRpc.Server(rpcUrl, {
  allowHttp: rpcUrl.startsWith('http://'),
});

// Contract address (replace with deployed contract address)
const contractAddress = 'C...'; // Your contract address

// Helper to create contract instance
function getContract(contractId: string): Contract {
  return new Contract(contractId);
}
```

### Get Contract Version

```typescript
async function getVersion(): Promise<number> {
  const contract = getContract(contractAddress);
  const result = await rpc.getContractData(
    contractAddress,
    xdr.ScVal.scvLedgerKeyContractInstance()
  );
  
  const response = await rpc.invokeContract({
    contractAddress,
    method: 'version',
    args: [],
  });
  
  return scValToNative(response.result.retval);
}
```

### Get Configuration

```typescript
interface ConfigInput {
  owners: string[];
  threshold: number;
}

async function getConfig(): Promise<ConfigInput> {
  const contract = getContract(contractAddress);
  
  const response = await rpc.invokeContract({
    contractAddress,
    method: 'get_config',
    args: [],
  });
  
  const config = scValToNative(response.result.retval);
  return {
    owners: config.owners.map((addr: any) => addr.toString()),
    threshold: config.threshold,
  };
}
```

### Create a Config Proposal

```typescript
import { Keypair } from '@stellar/stellar-sdk';

async function proposeConfig(
  ownerKeypair: Keypair,
  newOwners: string[],
  newThreshold: number
): Promise<any> {
  const contract = getContract(contractAddress);
  const ownerAddress = Address.fromString(ownerKeypair.publicKey());
  
  // Build proposal input
  const proposalInput = {
    tag: 'Config',
    values: [
      {
        owners: newOwners.map(addr => Address.fromString(addr).toScVal()),
        threshold: nativeToScVal(newThreshold, 'u32'),
      },
    ],
  };
  
  // Build transaction
  const sourceAccount = await rpc.getAccount(ownerKeypair.publicKey());
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call('propose', ownerAddress.toScVal(), proposalInput)
    )
    .setTimeout(30)
    .build();
  
  tx.sign(ownerKeypair);
  
  // Send transaction
  const response = await rpc.sendTransaction(tx);
  const result = await rpc.getTransaction(response.hash);
  
  return scValToNative(result.returnValue);
}
```

### Vote on a Proposal

```typescript
enum VoteType {
  Abstain = 0,
  Yes = 1,
  No = 2,
}

async function vote(
  ownerKeypair: Keypair,
  proposalId: number,
  voteType: VoteType
): Promise<any> {
  const contract = getContract(contractAddress);
  const ownerAddress = Address.fromString(ownerKeypair.publicKey());
  
  const sourceAccount = await rpc.getAccount(ownerKeypair.publicKey());
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        'vote',
        ownerAddress.toScVal(),
        nativeToScVal(proposalId, 'u64'),
        nativeToScVal(voteType, 'u32')
      )
    )
    .setTimeout(30)
    .build();
  
  tx.sign(ownerKeypair);
  
  const response = await rpc.sendTransaction(tx);
  const result = await rpc.getTransaction(response.hash);
  
  return scValToNative(result.returnValue);
}
```

### Invoke Another Contract

```typescript
async function invokeContract(
  callerKeypair: Keypair,
  targetContract: string,
  functionName: string,
  args: any[]
): Promise<void> {
  const contract = getContract(contractAddress);
  const callerAddress = Address.fromString(callerKeypair.publicKey());
  const targetAddress = Address.fromString(targetContract);
  
  const sourceAccount = await rpc.getAccount(callerKeypair.publicKey());
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        'invoke',
        callerAddress.toScVal(),
        targetAddress.toScVal(),
        xdr.ScVal.scvSymbol(functionName),
        args.map(arg => nativeToScVal(arg))
      )
    )
    .setTimeout(30)
    .build();
  
  tx.sign(callerKeypair);
  
  await rpc.sendTransaction(tx);
}
```

### Create User Rules Proposal

```typescript
interface Rule {
  comparator: 'Eq' | 'Gt' | 'Gte' | 'Lt' | 'Lte';
  value: any; // ValueType
  field: 'FnName' | 'ContractAddress' | { Arg: number };
}

interface RuleSet {
  tag: 'All';
  values: Rule[][];
}

async function proposeUserRules(
  ownerKeypair: Keypair,
  userAddress: string,
  rules: RuleSet[]
): Promise<any> {
  const contract = getContract(contractAddress);
  const ownerAddress = Address.fromString(ownerKeypair.publicKey());
  
  const proposalInput = {
    tag: 'UserRules',
    values: [
      {
        user: Address.fromString(userAddress).toScVal(),
        rules: rules.map(ruleSet => ({
          tag: ruleSet.tag,
          values: ruleSet.values.map(rule => ({
            comparator: rule.comparator,
            value: nativeToScVal(rule.value),
            field: typeof rule.field === 'string' 
              ? { tag: rule.field }
              : rule.field,
          })),
        })),
      },
    ],
  };
  
  const sourceAccount = await rpc.getAccount(ownerKeypair.publicKey());
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call('propose', ownerAddress.toScVal(), proposalInput))
    .setTimeout(30)
    .build();
  
  tx.sign(ownerKeypair);
  
  const response = await rpc.sendTransaction(tx);
  const result = await rpc.getTransaction(response.hash);
  
  return scValToNative(result.returnValue);
}
```

### Revoke a Proposal

```typescript
async function revokeProposal(
  callerKeypair: Keypair,
  proposalId: number
): Promise<void> {
  const contract = getContract(contractAddress);
  const callerAddress = Address.fromString(callerKeypair.publicKey());
  
  const sourceAccount = await rpc.getAccount(callerKeypair.publicKey());
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        'revoke_proposal',
        callerAddress.toScVal(),
        nativeToScVal(proposalId, 'u64')
      )
    )
    .setTimeout(30)
    .build();
  
  tx.sign(callerKeypair);
  
  await rpc.sendTransaction(tx);
}
```

## Golang Examples

### Setup

```go
package main

import (
    "github.com/stellar/go/clients/horizonclient"
    "github.com/stellar/go/keypair"
    "github.com/stellar/go/network"
    "github.com/stellar/go/txnbuild"
    "github.com/stellar/go/xdr"
)

const (
    contractAddress = "C..." // Your contract address
    testnetRPC      = "https://soroban-testnet.stellar.org"
)

func getClient() *horizonclient.Client {
    return &horizonclient.Client{
        HorizonURL: testnetRPC,
    }
}
```

### Get Contract Version

```go
func getVersion(sourceAccount txnbuild.Account) (uint32, error) {
    client := getClient()
    
    // Build invoke contract operation
    op := &txnbuild.InvokeHostFunction{
        HostFunction: xdr.HostFunction{
            Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
            InvokeContract: &xdr.InvokeContractArgs{
                ContractAddress: contractAddress,
                FunctionName:    "version",
                Args:            []xdr.ScVal{},
            },
        },
    }
    
    tx, err := txnbuild.NewTransaction(
        txnbuild.TransactionParams{
            SourceAccount:        sourceAccount,
            IncrementSequenceNum: true,
            BaseFee:              txnbuild.MinBaseFee,
            Timebounds:           txnbuild.NewInfiniteTimeout(),
            Operations:           []txnbuild.Operation{op},
        },
    )
    if err != nil {
        return 0, err
    }
    
    // Sign and submit transaction
    // ... (transaction signing and submission logic)
    
    // Parse result
    // ... (result parsing logic)
    
    return version, nil
}
```

### Get Configuration

```go
type ConfigInput struct {
    Owners    []string `json:"owners"`
    Threshold uint32   `json:"threshold"`
}

func getConfig(sourceAccount txnbuild.Account) (*ConfigInput, error) {
    client := getClient()
    
    op := &txnbuild.InvokeHostFunction{
        HostFunction: xdr.HostFunction{
            Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
            InvokeContract: &xdr.InvokeContractArgs{
                ContractAddress: contractAddress,
                FunctionName:    "get_config",
                Args:            []xdr.ScVal{},
            },
        },
    }
    
    tx, err := txnbuild.NewTransaction(
        txnbuild.TransactionParams{
            SourceAccount:        sourceAccount,
            IncrementSequenceNum: true,
            BaseFee:              txnbuild.MinBaseFee,
            Timebounds:           txnbuild.NewInfiniteTimeout(),
            Operations:           []txnbuild.Operation{op},
        },
    )
    if err != nil {
        return nil, err
    }
    
    // Sign, submit, and parse result
    // ... (transaction handling logic)
    
    return &ConfigInput{
        Owners:    owners,
        Threshold: threshold,
    }, nil
}
```

### Create a Config Proposal

```go
func proposeConfig(
    sourceAccount txnbuild.Account,
    ownerKP *keypair.Full,
    newOwners []string,
    newThreshold uint32,
) (*Proposal, error) {
    // Convert owner addresses to ScVal
    ownerScVals := make([]xdr.ScVal, len(newOwners))
    for i, owner := range newOwners {
        addr, err := xdr.AddressToScVal(owner)
        if err != nil {
            return nil, err
        }
        ownerScVals[i] = addr
    }
    
    // Build proposal input
    configInput := xdr.ScVal{
        Type: xdr.ScValTypeScvVec,
        Vec: &xdr.ScVec{
            Elements: []xdr.ScVal{
                {
                    Type: xdr.ScValTypeScvVec,
                    Vec: &xdr.ScVec{Elements: ownerScVals},
                },
                {
                    Type: xdr.ScValTypeScvU32,
                    U32:  &newThreshold,
                },
            },
        },
    }
    
    proposalInput := xdr.ScVal{
        Type: xdr.ScValTypeScvEnum,
        Enum: &xdr.ScValEnum{
            Type: 0, // Config variant
            Values: []xdr.ScVal{configInput},
        },
    }
    
    ownerAddr, err := xdr.AddressToScVal(ownerKP.Address())
    if err != nil {
        return nil, err
    }
    
    op := &txnbuild.InvokeHostFunction{
        HostFunction: xdr.HostFunction{
            Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
            InvokeContract: &xdr.InvokeContractArgs{
                ContractAddress: contractAddress,
                FunctionName:    "propose",
                Args: []xdr.ScVal{
                    ownerAddr,
                    proposalInput,
                },
            },
        },
    }
    
    tx, err := txnbuild.NewTransaction(
        txnbuild.TransactionParams{
            SourceAccount:        sourceAccount,
            IncrementSequenceNum: true,
            BaseFee:              txnbuild.MinBaseFee,
            Timebounds:           txnbuild.NewInfiniteTimeout(),
            Operations:           []txnbuild.Operation{op},
        },
    )
    if err != nil {
        return nil, err
    }
    
    tx, err = tx.Sign(network.TestNetworkPassphrase, ownerKP)
    if err != nil {
        return nil, err
    }
    
    // Submit transaction and parse result
    // ... (transaction submission and parsing logic)
    
    return proposal, nil
}
```

### Vote on a Proposal

```go
const (
    VoteTypeAbstain = 0
    VoteTypeYes     = 1
    VoteTypeNo      = 2
)

func vote(
    sourceAccount txnbuild.Account,
    ownerKP *keypair.Full,
    proposalId uint64,
    voteType uint32,
) (*Proposal, error) {
    ownerAddr, err := xdr.AddressToScVal(ownerKP.Address())
    if err != nil {
        return nil, err
    }
    
    proposalIdScVal := xdr.ScVal{
        Type: xdr.ScValTypeScvU64,
        U64:  &proposalId,
    }
    
    voteTypeScVal := xdr.ScVal{
        Type: xdr.ScValTypeScvU32,
        U32:  &voteType,
    }
    
    op := &txnbuild.InvokeHostFunction{
        HostFunction: xdr.HostFunction{
            Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
            InvokeContract: &xdr.InvokeContractArgs{
                ContractAddress: contractAddress,
                FunctionName:    "vote",
                Args: []xdr.ScVal{
                    ownerAddr,
                    proposalIdScVal,
                    voteTypeScVal,
                },
            },
        },
    }
    
    tx, err := txnbuild.NewTransaction(
        txnbuild.TransactionParams{
            SourceAccount:        sourceAccount,
            IncrementSequenceNum: true,
            BaseFee:              txnbuild.MinBaseFee,
            Timebounds:           txnbuild.NewInfiniteTimeout(),
            Operations:           []txnbuild.Operation{op},
        },
    )
    if err != nil {
        return nil, err
    }
    
    tx, err = tx.Sign(network.TestNetworkPassphrase, ownerKP)
    if err != nil {
        return nil, err
    }
    
    // Submit transaction and parse result
    // ... (transaction submission and parsing logic)
    
    return proposal, nil
}
```

### Invoke Another Contract

```go
func invokeContract(
    sourceAccount txnbuild.Account,
    callerKP *keypair.Full,
    targetContract string,
    functionName string,
    args []xdr.ScVal,
) error {
    callerAddr, err := xdr.AddressToScVal(callerKP.Address())
    if err != nil {
        return err
    }
    
    targetAddr, err := xdr.AddressToScVal(targetContract)
    if err != nil {
        return err
    }
    
    fnNameScVal := xdr.ScVal{
        Type:   xdr.ScValTypeScvSymbol,
        Symbol: &xdr.ScSymbol(functionName),
    }
    
    argsVec := xdr.ScVal{
        Type: xdr.ScValTypeScvVec,
        Vec:  &xdr.ScVec{Elements: args},
    }
    
    op := &txnbuild.InvokeHostFunction{
        HostFunction: xdr.HostFunction{
            Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
            InvokeContract: &xdr.InvokeContractArgs{
                ContractAddress: contractAddress,
                FunctionName:    "invoke",
                Args: []xdr.ScVal{
                    callerAddr,
                    targetAddr,
                    fnNameScVal,
                    argsVec,
                },
            },
        },
    }
    
    tx, err := txnbuild.NewTransaction(
        txnbuild.TransactionParams{
            SourceAccount:        sourceAccount,
            IncrementSequenceNum: true,
            BaseFee:              txnbuild.MinBaseFee,
            Timebounds:           txnbuild.NewInfiniteTimeout(),
            Operations:           []txnbuild.Operation{op},
        },
    )
    if err != nil {
        return err
    }
    
    tx, err = tx.Sign(network.TestNetworkPassphrase, callerKP)
    if err != nil {
        return err
    }
    
    // Submit transaction
    // ... (transaction submission logic)
    
    return nil
}
```

### Revoke a Proposal

```go
func revokeProposal(
    sourceAccount txnbuild.Account,
    callerKP *keypair.Full,
    proposalId uint64,
) error {
    callerAddr, err := xdr.AddressToScVal(callerKP.Address())
    if err != nil {
        return err
    }
    
    proposalIdScVal := xdr.ScVal{
        Type: xdr.ScValTypeScvU64,
        U64:  &proposalId,
    }
    
    op := &txnbuild.InvokeHostFunction{
        HostFunction: xdr.HostFunction{
            Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
            InvokeContract: &xdr.InvokeContractArgs{
                ContractAddress: contractAddress,
                FunctionName:    "revoke_proposal",
                Args: []xdr.ScVal{
                    callerAddr,
                    proposalIdScVal,
                },
            },
        },
    }
    
    tx, err := txnbuild.NewTransaction(
        txnbuild.TransactionParams{
            SourceAccount:        sourceAccount,
            IncrementSequenceNum: true,
            BaseFee:              txnbuild.MinBaseFee,
            Timebounds:           txnbuild.NewInfiniteTimeout(),
            Operations:           []txnbuild.Operation{op},
        },
    )
    if err != nil {
        return err
    }
    
    tx, err = tx.Sign(network.TestNetworkPassphrase, callerKP)
    if err != nil {
        return err
    }
    
    // Submit transaction
    // ... (transaction submission logic)
    
    return nil
}
```

## Error Handling

The contract uses the following error codes:

| Code | Name | Description |
|------|------|-------------|
| 2 | `NotInitialized` | Contract has not been initialized |
| 5 | `InvalidOwners` | Invalid owner configuration (duplicates or < 2 owners) |
| 6 | `InvalidThreshold` | Threshold out of valid range |
| 8 | `NotOwner` | Caller is not an owner |
| 9 | `ProposalNotFound` | Proposal doesn't exist |
| 10 | `VoterAlreadyVoted` | Owner has already voted |
| 11 | `ProposalNotPending` | Proposal is not in pending status |
| 12 | `InvokeError` | Contract invocation failed |
| 13 | `NotUser` | User has no rules configured |
| 14 | `NoConfigChanges` | Config proposal identical to current config |
| 15 | `NotCaller` | Caller is not the proposal creator |
| 18 | `RuleNotAllowed` | User rules don't allow this invocation |
| 19 | `InvokeNotAllowed` | Cannot directly propose Invoke proposals |
| 20 | `EmptyUserRules` | UserRules proposal contains no rules |
| 21 | `NoRulesToRevoke` | RevokeUserRules for user with no rules |
| 22 | `InvalidUpgrade` | Upgrade hash is invalid |
| 23 | `InvalidInvoke` | Invalid invoke call structure |
| 24 | `DuplicateRulesets` | UserRules proposal contains duplicate rulesets |

## Events

The contract emits the following events:

- `new_prop`: Emitted when a new proposal is created
- `pend_prop`: Emitted when a proposal remains pending after voting
- `rej_prop`: Emitted when a proposal is rejected
- `exec_prop`: Emitted when a proposal is executed
- `rev_prop`: Emitted when a proposal is revoked
- `cfg_set`: Emitted when configuration is updated
- `rules_set`: Emitted when user rules are set
- `rules_rm`: Emitted when user rules are removed
- `inv_ok`: Emitted when a contract invocation succeeds

### Listening to Events

**TypeScript:**
```typescript
// Subscribe to contract events
const eventFilter = {
  contractIds: [contractAddress],
};

const eventStream = rpc.subscribe({
  filter: eventFilter,
  onmessage: (event) => {
    console.log('Event received:', event);
    // Parse event data
  },
});
```

**Golang:**
```go
// Use Horizon client to fetch events
// Events are stored in transaction results
// Query transactions for the contract address to retrieve events
```

## User Rules System

The user rules system allows non-owners to invoke specific contract functions based on granular rules.

### Rule Structure

A rule consists of:
- **Comparator**: `Eq`, `Gt`, `Gte`, `Lt`, `Lte`
- **Value**: The value to compare against (supports u32, i32, u64, i64, u128, i128, bool, Address, Symbol)
- **Field**: What to compare (`FnName`, `ContractAddress`, or `Arg(index)`)

### RuleSet Structure

A RuleSet contains multiple rules that must ALL pass (AND logic):
- `RuleSet::All(Vec<Rule>)`: All rules in the set must match

### Example: Allow Transfer Function

```typescript
const rules: RuleSet[] = [
  {
    tag: 'All',
    values: [
      [
        {
          comparator: 'Eq',
          value: 'transfer',
          field: 'FnName',
        },
        {
          comparator: 'Eq',
          value: targetContractAddress,
          field: 'ContractAddress',
        },
        {
          comparator: 'Lte',
          value: 10000000,
          field: { Arg: 0 },
        },
      ],
    ],
  },
];
```

This rule allows:
- Calling the `transfer` function
- On a specific contract address
- With the first argument <= 10000000

## Best Practices

1. **Always check proposal status** before voting or executing
2. **Validate thresholds** ensure they're between 2 and owner count
3. **Handle errors gracefully** check error codes and provide user feedback
4. **Monitor events** for proposal lifecycle changes
5. **Use user rules** for granular permissions instead of making everyone an owner
6. **Test thoroughly** before deploying to mainnet

## Additional Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar SDK Documentation](https://developers.stellar.org/docs)
- [Contract Source Code](../../smart-contract-soroban)
