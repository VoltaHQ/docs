# Session Keys Guide

Session keys allow you to delegate limited signing authority to a key with granular, on-chain enforced permissions. This is one of the most powerful features of the Volta smart account.

## Prerequisites

- Volta smart account deployed (see [Getting Started](./getting-started.md))
- Access to owner keys (Volta + at least `minQuorum` owners)
- Understanding of ERC-4337 UserOperations

## How Session Keys Work

Session keys are validated by the **SessionKeyValidator** contract, which is delegatecalled by the VoltaAccount. When a UserOperation is signed by a single key that isn't an owner, the validator checks:

1. **Is the session key enabled?**
2. **Is the current time within the key's validity window?**
3. **Does the call target match an allowed contract?**
4. **Is the function selector permitted?**
5. **Do the call parameters satisfy the constraint rules?**
6. **Is the ETH value within limits?**

If any check fails, the UserOperation is rejected.

## Permission Model

Session key permissions are structured as a hierarchy:

```
Session Key
├── globalMaxValue (ETH limit for calls with no calldata)
├── validAfter / validUntil (time bounds)
├── signaturesEnabled (ERC-1271 support)
└── Access Rules (per target contract)
    ├── whitelisted? (allow everything)
    ├── maxValue (ETH limit for this target)
    └── Selector Rules (per function)
        ├── whitelisted? (allow any params)
        └── Param Rule Sets (OR logic)
            └── Param Rules (AND logic within a set)
                ├── offset (param position)
                ├── value (comparison value)
                └── condition (==, >, <, >=, <=, !=)
```

### Permission Resolution

1. If the target contract is **not enabled**, the call is rejected (unless it's a plain ETH transfer within `globalMaxValue`)
2. If the target is **whitelisted**, the call is allowed regardless of function or parameters
3. If the function selector is **not enabled**, the call is rejected
4. If the selector is **whitelisted**, the call is allowed regardless of parameters
5. If **param rule sets** exist, at least one set must fully match (OR between sets, AND within a set)

## Example Scenarios

### Scenario 1: Allow ERC-20 Transfers Only

Allow a session key to call `transfer()` on a specific token, with a max amount of 1000 tokens per call:

```typescript
import { ethers } from 'ethers';

const sessionKey = '0xSessionKey...';
const tokenAddress = '0xUSDC...';

// transfer(address,uint256) selector
const transferSelector = '0xa9059cbb';

const instruction = {
  userAddress: sessionKey,
  rules: [{
    targetAddress: tokenAddress,
    enabled: true,
    whitelisted: false,
    maxValue: 0n, // no ETH transfers
    selectorRules: [{
      selector: transferSelector,
      enabled: true,
      whitelisted: false,
      paramRuleSets: [{
        paramRules: [{
          offset: 32n,  // uint256 amount is the 2nd param (offset 32 bytes)
          param: ethers.zeroPadValue(
            ethers.toBeHex(ethers.parseUnits('1000', 6)), // 1000 USDC
            32
          ),
          condition: 4, // LESS_THAN_OR_EQUAL
        }],
        maxValue: 0n,
      }],
    }],
  }],
  globalMaxValue: 0n,
  validAfterUntil: packValidAfterUntil(
    Math.floor(Date.now() / 1000),          // valid from now
    Math.floor(Date.now() / 1000) + 86400   // valid for 24 hours
  ),
  signaturesEnabled: false,
};

function packValidAfterUntil(validAfter: number, validUntil: number): bigint {
  return (BigInt(validAfter) << 48n) | BigInt(validUntil);
}
```

### Scenario 2: Whitelist a DEX Router

Allow a session key to call any function on a DEX router (useful for swap operations):

```typescript
const instruction = {
  userAddress: sessionKey,
  rules: [{
    targetAddress: '0xDEXRouter...',
    enabled: true,
    whitelisted: true, // allow all calls to this contract
    maxValue: ethers.parseEther('0.1'), // max 0.1 ETH per call
    selectorRules: [],
  }],
  globalMaxValue: 0n,
  validAfterUntil: packValidAfterUntil(
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000) + 3600 // 1 hour
  ),
  signaturesEnabled: false,
};
```

### Scenario 3: Allow ETH Transfers with Limit

Allow a session key to send up to 0.01 ETH to any address:

```typescript
const instruction = {
  userAddress: sessionKey,
  rules: [],  // no specific contract rules needed
  globalMaxValue: ethers.parseEther('0.01'),
  validAfterUntil: packValidAfterUntil(
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000) + 604800 // 1 week
  ),
  signaturesEnabled: false,
};
```

### Scenario 4: Restrict Transfer Recipients

Allow transfers only to a specific recipient address:

```typescript
const allowedRecipient = '0xRecipient...';
const transferSelector = '0xa9059cbb'; // transfer(address,uint256)

const instruction = {
  userAddress: sessionKey,
  rules: [{
    targetAddress: '0xUSDC...',
    enabled: true,
    whitelisted: false,
    maxValue: 0n,
    selectorRules: [{
      selector: transferSelector,
      enabled: true,
      whitelisted: false,
      paramRuleSets: [{
        paramRules: [
          {
            offset: 0n,  // address 'to' is the 1st param
            param: ethers.zeroPadValue(allowedRecipient, 32),
            condition: 0, // EQUAL
          },
          {
            offset: 32n, // uint256 'amount' is the 2nd param
            param: ethers.zeroPadValue(
              ethers.toBeHex(ethers.parseUnits('500', 6)),
              32
            ),
            condition: 4, // LESS_THAN_OR_EQUAL
          },
        ],
        maxValue: 0n,
      }],
    }],
  }],
  globalMaxValue: 0n,
  validAfterUntil: packValidAfterUntil(
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000) + 86400
  ),
  signaturesEnabled: false,
};
```

### Scenario 5: Multiple Param Rule Sets (OR Logic)

Allow transfers to either Alice OR Bob, with different limits:

```typescript
const instruction = {
  userAddress: sessionKey,
  rules: [{
    targetAddress: '0xUSDC...',
    enabled: true,
    whitelisted: false,
    maxValue: 0n,
    selectorRules: [{
      selector: transferSelector,
      enabled: true,
      whitelisted: false,
      paramRuleSets: [
        // Rule Set 1: transfer to Alice, up to 1000 USDC
        {
          paramRules: [
            { offset: 0n, param: ethers.zeroPadValue('0xAlice...', 32), condition: 0 },
            { offset: 32n, param: ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits('1000', 6)), 32), condition: 4 },
          ],
          maxValue: 0n,
        },
        // Rule Set 2: transfer to Bob, up to 500 USDC
        {
          paramRules: [
            { offset: 0n, param: ethers.zeroPadValue('0xBob...', 32), condition: 0 },
            { offset: 32n, param: ethers.zeroPadValue(ethers.toBeHex(ethers.parseUnits('500', 6)), 32), condition: 4 },
          ],
          maxValue: 0n,
        },
      ],
    }],
  }],
  globalMaxValue: 0n,
  validAfterUntil: packValidAfterUntil(
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000) + 86400
  ),
  signaturesEnabled: false,
};
```

## Enabling a Session Key

Enabling session keys requires a UserOperation signed by Volta + `minQuorum` owners:

```typescript
const ACCOUNT_ABI = [
  'function enable(tuple(address userAddress, tuple(address targetAddress, bool enabled, bool whitelisted, uint256 maxValue, tuple(bytes4 selector, bool enabled, bool whitelisted, tuple(tuple(uint256 offset, bytes32 param, uint8 condition)[] paramRules, uint256 maxValue)[] paramRuleSets)[] selectorRules)[] rules, uint256 globalMaxValue, uint96 validAfterUntil, bool signaturesEnabled)[] instructions)',
];

const iface = new ethers.Interface(ACCOUNT_ABI);
const callData = iface.encodeFunctionData('enable', [[instruction]]);

// Build UserOp with this callData
// Sign with Volta's key first, then owner keys
// Submit via bundler
```

## Disabling a Session Key

```typescript
const disableCallData = iface.encodeFunctionData('disable', [
  [{ userAddress: sessionKey }]
]);

// Build UserOp with Volta + owner signatures
```

## Re-Enabling with Updated Permissions

Calling `enable` for a session key that is already enabled will **replace** its existing permissions entirely. There is no need to call `disable` first.

## Signing with a Session Key

Once enabled, the session key can sign UserOperations independently:

```typescript
// Session key signs alone (single 65-byte signature)
const sessionKeyWallet = new ethers.Wallet('0xSessionKeyPrivateKey...');
const signature = await sessionKeyWallet.signMessage(ethers.getBytes(userOpHash));

const userOp = {
  sender: accountAddress,
  // ... other fields
  callData: buildExecuteCalldata(target, value, data),
  signature,
};
```

The SessionKeyValidator will automatically validate that the call is within the session key's permissions.

## ERC-1271 Signatures

If `signaturesEnabled` is set to `true` for a session key, it can also produce valid ERC-1271 signatures on behalf of the smart account. This is useful for off-chain signature verification (e.g., signing messages for dApp login, order signing on DEXes).

> **Note:** The account wraps the hash with its EIP-712 domain separator before verifying. The signer must include the domain separator when signing.

## Limits and Constraints

| Constraint | Max Value |
|------------|-----------|
| Access rules per instruction | 64 |
| Selector rules per target | 64 |
| Param rule sets per selector | 64 |

## Common Issues

- **Session key not working**: Check that the key is enabled and within its time window
- **Target not enabled error**: The contract address must be in the session key's access rules
- **Param validation failed**: Verify parameter offsets and comparison values match the ABI encoding
- **Selector not enabled**: Ensure the function's 4-byte selector is in the selector rules

See the [Troubleshooting Guide](../troubleshooting.md) for more details.

## Next Steps

- [API Reference](../index.md)
- [Troubleshooting Guide](../troubleshooting.md)
