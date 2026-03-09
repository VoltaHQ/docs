# Getting Started with Volta on EVM

Volta is an ERC-4337 smart account that provides multi-signature ownership, session keys with granular permissions, and gas sponsorship on EVM-compatible chains.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+) and npm/yarn
- A funded EOA wallet on your target chain (testnet for development)
- Basic familiarity with ERC-4337 account abstraction concepts
- Access to a bundler service (e.g., Stackup, Pimlico, Alchemy)

## Key Concepts

### Account Abstraction (ERC-4337)

Instead of sending transactions directly, users submit **UserOperations** to a bundler. The ERC-4337 **EntryPoint** contract validates signatures and executes operations on behalf of the smart account.

```
User → UserOperation → Bundler → EntryPoint → VoltaAccount → Target Contract
```

### Multi-Signature Ownership

Volta implements M-of-N multi-sig where:
- **N** = total number of non-Volta owners
- **M** = minQuorum (minimum signatures required)
- The first owner is always the Volta platform address

For example, a `minQuorum=2` account with 3 non-Volta owners means any 2 of those 3 must sign.

### Session Keys

Session keys are delegated signers with scoped permissions. They can:
- Be restricted to specific target contracts
- Be limited to specific function selectors
- Have parameter-level constraints (e.g., "transfer amount <= 100 USDC")
- Have time bounds (valid only within a time window)
- Have ETH value limits

## Step 1: Install Dependencies

```bash
npm install ethers
```

## Step 2: Compute the Account Address

Before deploying, you can compute the deterministic address:

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://your-rpc-url');

const FACTORY_ABI = [
  'function getAddress(address accountImplementation, uint256 salt) view returns (address)',
];

const factory = new ethers.Contract(
  '0xFactoryAddress...',
  FACTORY_ABI,
  provider
);

const accountAddress = await factory.getAddress(
  '0xImplementationAddress...',
  42n // your salt
);
console.log('Account will be deployed at:', accountAddress);
```

## Step 3: Deploy the Account

Account deployment is done through the `VoltaFactory`. The factory requires a signature from its owner to authorize account creation.

```typescript
const FACTORY_ABI = [
  'function createAccount(address accountImplementation, uint256 salt, address sessionKeyValidator, address executor, address[] owners, uint256 minQuorum, address entryPoint, bytes signature) returns (address)',
  'function buildSignatureDigest(address accountImplementation, uint256 salt, address sessionKeyValidator, address executor, address[] owners, uint256 minQuorum, address entryPoint) view returns (bytes32)',
];

const factory = new ethers.Contract(
  '0xFactoryAddress...',
  FACTORY_ABI,
  provider
);

// Parameters
const implementationAddress = '0x...'; // VoltaAccount implementation
const salt = 42n;
const sessionKeyValidator = '0x...';   // SessionKeyValidator deployment
const executor = '0x...';              // DefaultExecutor deployment
const owners = [
  '0xVolta...',     // Volta platform address (must be first)
  '0xOwner1...',    // First owner
  '0xOwner2...',    // Second owner
];
const minQuorum = 1;                   // Require 1 non-Volta owner signature
const entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'; // v0.6
```

**Requirements:**
- At least 3 addresses in `owners` (Volta + 2 non-Volta owners minimum)
- `minQuorum >= 1` and `minQuorum <= owners.length - 1`
- All addresses must be unique and non-zero

## Step 4: Verify the Account

Check that the account was deployed correctly:

```typescript
const ACCOUNT_ABI = [
  'function getDeposit() view returns (uint256)',
  'function entryPoint() view returns (address)',
  'function accountImplementation() view returns (address)',
  'function sessionKeyValidator() view returns (address)',
  'function executor() view returns (address)',
];

const account = new ethers.Contract(accountAddress, ACCOUNT_ABI, provider);

console.log('EntryPoint:', await account.entryPoint());
console.log('Implementation:', await account.accountImplementation());
console.log('Session Key Validator:', await account.sessionKeyValidator());
console.log('Executor:', await account.executor());
console.log('Deposit:', ethers.formatEther(await account.getDeposit()));
```

## Step 5: Fund the Account

The account needs ETH for gas (or use a paymaster). Deposit to the EntryPoint:

```typescript
// Option 1: Send ETH directly to the account
const tx = await wallet.sendTransaction({
  to: accountAddress,
  value: ethers.parseEther('0.01'),
});
await tx.wait();

// Option 2: Deposit to the EntryPoint via a UserOperation
// (requires the account to already have some gas or use a paymaster)
```

## Step 6: Send Your First UserOperation

Build and submit a simple ETH transfer:

```typescript
// Build the execute calldata
const accountInterface = new ethers.Interface([
  'function execute(address dest, uint256 value, bytes data)',
]);

const callData = accountInterface.encodeFunctionData('execute', [
  '0xRecipient...',           // destination
  ethers.parseEther('0.001'), // value
  '0x',                       // no calldata (simple transfer)
]);

// Build the UserOperation (simplified - use a bundler SDK in production)
const userOp = {
  sender: accountAddress,
  nonce: '0x0', // get from EntryPoint
  initCode: '0x',
  callData,
  callGasLimit: '0x50000',
  verificationGasLimit: '0x50000',
  preVerificationGas: '0x50000',
  maxFeePerGas: '0x...',
  maxPriorityFeePerGas: '0x...',
  paymasterAndData: '0x',
  signature: '0x', // placeholder
};

// Sign the UserOperation
const userOpHash = '...'; // computed by the bundler or EntryPoint
const signature = await ownerWallet.signMessage(ethers.getBytes(userOpHash));
userOp.signature = signature;

// Submit via bundler
// await bundler.sendUserOperation(userOp, entryPointAddress);
```

## Account Functions Reference

| Function | Description | Who Can Call | Volta Required? |
|----------|-------------|--------------|-----------------|
| `execute` | Execute a single transaction | Via EntryPoint | No |
| `executeBatch` | Execute multiple transactions atomically | Via EntryPoint | No |
| `enable` | Enable session keys with permissions | Via EntryPoint | Yes |
| `disable` | Disable session keys | Via EntryPoint | Yes |
| `updateOwners` | Change owners and quorum | Via EntryPoint | Yes |
| `upgradeSessionKeyValidator` | Replace validator module | Via EntryPoint | Yes |
| `upgradeExecutor` | Replace executor module | Via EntryPoint | Yes |
| `multiUpgrade` | Upgrade both modules | Via EntryPoint | Yes |
| `updateEntryPoint` | Change EntryPoint | Via EntryPoint | Yes |
| `upgradeTo` | Upgrade account implementation | Via EntryPoint | Yes |
| `getDeposit` | Check EntryPoint deposit | Anyone | No |
| `isValidSignature` | ERC-1271 verification | Anyone | No |

## Security Considerations

1. **Protect owner keys**: Each owner key contributes to the quorum. Secure them with hardware wallets or secure key management.

2. **Volta must sign privileged operations**: Upgrades, owner changes, and session key management require Volta's signature to prevent unauthorized modifications.

3. **Session keys limit blast radius**: Use session keys for routine operations instead of owner keys. If compromised, damage is limited to the session key's permissions.

4. **Use time-bounded session keys**: Always set `validUntil` to minimize risk from key compromise.

5. **Test on testnets first**: Always verify UserOperation construction and signing on a testnet.

## Next Steps

- [Session Keys Guide](./session-keys.md)
- [API Reference](../index.md)
- [Troubleshooting Guide](../troubleshooting.md)
