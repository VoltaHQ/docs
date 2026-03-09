# Volta EVM Troubleshooting Guide

This guide covers common errors and issues when working with the Volta ERC-4337 smart account.

## Account Errors (VAE)

### "VAE: minQuorum must be greater than 0"

**Cause:** Attempted to initialize or update owners with `minQuorum` set to 0.

**Solution:** Set `minQuorum` to at least 1.

---

### "VAE: At least 2 non-Volta owners required"

**Cause:** The owners array has fewer than 3 addresses (Volta + 2 non-Volta owners).

**Solution:** Provide at least 3 addresses in the owners array. The first address must be the Volta platform address, followed by at least 2 additional owner addresses.

---

### "VAE: Number of non-Volta owners must be greater than or equal to minQuorum"

**Cause:** `minQuorum` is higher than the number of non-Volta owners.

**Solution:** Ensure `minQuorum <= owners.length - 1`. For example, with 3 owners (Volta + 2), `minQuorum` can be 1 or 2.

---

### "VAE: owner cannot be 0x0"

**Cause:** One of the addresses in the owners array is the zero address.

**Solution:** Replace the zero address with a valid Ethereum address.

---

### "VAE: Duplicate owner"

**Cause:** The same address appears more than once in the owners array.

**Solution:** Remove duplicate addresses.

---

### "VAE: first owner must be Volta"

**Cause:** `updateOwners` was called with a different address in `owners[0]` than the current Volta address.

**Solution:** The first owner must remain the same Volta platform address that was set during initialization. Only non-Volta owners can be changed.

---

### "VAE: Volta must be the first signer"

**Cause:** Volta's signature was included but not as the first signature in the concatenated signature bytes.

**Solution:** When building multi-sig signatures, always place Volta's 65-byte signature first, followed by other owner signatures.

```typescript
// Correct order
const signature = ethers.concat([
  voltaSignature,  // Volta first
  owner1Signature,
  owner2Signature,
]);
```

---

### "VAE: Invalid callData"

**Cause:** The UserOperation's callData is less than 4 bytes long.

**Solution:** Ensure the callData contains at least a 4-byte function selector.

---

### Signature Validation Returns `SIG_VALIDATION_FAILED`

**Cause:** One of the following:
- Account is not initialized (`minQuorum == 0` or executor is disabled)
- Signature length is not a multiple of 65 bytes
- Signature length is 0
- Not enough valid owner signatures to meet quorum
- Volta didn't sign a privileged operation
- Session key is not enabled

**Solution:**
1. Verify the account is initialized
2. Ensure each signature is exactly 65 bytes (r: 32, s: 32, v: 1)
3. Provide at least `minQuorum` valid owner signatures
4. Include Volta's signature for privileged operations
5. Check session key status if using delegated signing

---

### "VAE: sessionKeyValidator required"

**Cause:** Zero address provided for session key validator during initialization or upgrade.

**Solution:** Provide a valid deployed SessionKeyValidator contract address.

---

### "VAE: New sessionKeyValidator must be a contract"

**Cause:** The provided address has no deployed code.

**Solution:** Verify the SessionKeyValidator is deployed at the given address before upgrading.

---

### "VAE: New sessionKeyValidator must be different"

**Cause:** Attempted to upgrade to the same validator address.

**Solution:** Provide a different address for the upgrade.

---

### "VAE: executor required" / "VAE: New executor must be a contract" / "VAE: New executor must be different"

Same patterns as session key validator errors above, but for the executor module.

---

### "VAE: entryPoint required" / "VAE: entryPoint must be different"

**Cause:** Zero address or same address provided for EntryPoint update.

**Solution:** Provide a valid, different EntryPoint address.

---

### "VAE: withdrawAddress required"

**Cause:** Zero address provided as withdrawal destination.

**Solution:** Provide a valid recipient address for the deposit withdrawal.

---

## Session Key Validator Errors (SKV)

### "SKV: Invalid user address"

**Cause:** Zero address provided as a session key address in an `enable` instruction.

**Solution:** Provide a valid Ethereum address for the session key.

---

### "SKV: Invalid call data length"

**Cause:** The UserOperation's callData is shorter than expected for `execute` or `executeBatch`.

**Solution:** Ensure the callData is properly ABI-encoded for the execute function being called.

---

### "SKV: Target address not enabled"

**Cause:** The session key attempted to call a contract that is not in its access rules.

**Solution:** Either:
- Add the target contract to the session key's access rules via `enable`
- Use an owner signature instead of the session key

---

### "SKV: User not enabled for this selector"

**Cause:** The session key attempted to call a function whose selector is not in the allowed selectors for the target contract.

**Solution:** Add the function selector to the session key's selector rules for that target.

---

### "SKV: Withdrawal limit exceeded"

**Cause:** A plain ETH transfer (no calldata) exceeds the `maxValue` limit for the target address.

**Solution:** Either:
- Increase the `maxValue` for the target in the access rules
- Reduce the transfer amount
- Check if `globalMaxValue` covers the transfer when the target has no specific rules

---

### "SKV: Param validation failed"

**Cause:** The call parameters don't satisfy any of the configured param rule sets.

**Solution:**
1. Verify the parameter offsets match the ABI encoding (each param is 32 bytes, starting after the 4-byte selector)
2. Check the comparison values are correctly ABI-encoded (left-padded to 32 bytes)
3. Verify the condition operators are correct
4. Remember: multiple rule sets use OR logic (any one must pass), but rules within a set use AND logic (all must pass)

**Debugging parameter offsets:**
```
calldata: [selector(4 bytes)][param0(32 bytes)][param1(32 bytes)]...
offset 0  → param0
offset 32 → param1
offset 64 → param2
```

---

### "SKV: unsupported selector"

**Cause:** The UserOperation calls a function other than `execute` (selector `0xb61d27f6`) or `executeBatch` (selector `0x12c850df`).

**Solution:** Session keys can only be used with `execute` and `executeBatch`. Other account functions require owner signatures.

---

### "SKV: Too many rules specified"

**Cause:** More than 64 access rules in a single `EnableUserInstruction`.

**Solution:** Reduce the number of target contracts per instruction. If needed, use multiple `enable` calls (though note each call replaces the previous permissions).

---

### "SKV: Too many selector rules specified"

**Cause:** More than 64 selector rules for a single target contract.

**Solution:** Reduce the number of allowed function selectors per target.

---

### "SKV: Too many param rule sets specified"

**Cause:** More than 64 param rule sets for a single selector.

**Solution:** Simplify parameter constraints.

---

## Factory Errors (VF)

### "invalid signature"

**Cause:** The factory owner's signature over the account creation parameters is invalid.

**Solution:**
- Verify the factory owner's key matches the factory contract's `owner()`
- Ensure all parameters in the signature digest match exactly (including `chainId`)
- The digest is: `keccak256(abi.encode(accountImplementation, salt, sessionKeyValidator, executor, owners, minQuorum, entryPoint, block.chainid))`

---

### "VF: Account already deployed"

**Cause:** An account with the same `accountImplementation` and `salt` already exists.

**Solution:** Use a different `salt` value, or use the existing account at that address.

---

### "VF: Invalid owner"

**Cause:** Zero address provided as factory owner during construction.

**Solution:** Provide a valid owner address.

---

## Executor Errors (DE)

### "DE: Call failed without revert reason"

**Cause:** The target contract's function call reverted without providing a revert reason.

**Solution:**
- Verify the target contract address is correct
- Check that the function exists on the target contract
- Verify the calldata encoding is correct
- Ensure the target contract has the expected state for the call
- Test the call directly (not through the account) to debug

---

## Common Issues

### UserOperation Reverts at EntryPoint

**Symptom:** The bundler rejects the UserOperation or it reverts on-chain.

**Cause:** Various issues with UserOp construction.

**Solution:**
1. Simulate the UserOp first using `eth_estimateUserOperationGas`
2. Check that `sender` matches the smart account address
3. Verify `nonce` is correct (query from EntryPoint)
4. Ensure gas limits are sufficient
5. If using a paymaster, verify `paymasterAndData` is correctly signed

---

### Session Key Works for Some Calls but Not Others

**Symptom:** Some transactions succeed but others revert with `SKV: Target address not enabled` or `SKV: Param validation failed`.

**Cause:** Incomplete permission configuration.

**Solution:**
- Review all target contracts the session key needs to interact with
- For batch calls, every call in the batch must be individually permitted
- Check that approval + swap patterns include both the token and the router

---

### Privileged Operation Rejected

**Symptom:** UserOp for `enable`, `disable`, `updateOwners`, or upgrade functions returns `SIG_VALIDATION_FAILED`.

**Cause:** Volta's signature is missing.

**Solution:** Privileged operations require Volta's signature as the **first** signature, followed by `minQuorum` owner signatures:

```typescript
const signature = ethers.concat([
  voltaSignature,     // Required for privileged ops
  ownerSignature1,
  ownerSignature2,    // If minQuorum >= 2
]);
```

---

### Account Deployed but Not Working

**Symptom:** Account exists at expected address but UserOperations fail.

**Cause:** Account may not be properly initialized.

**Solution:**
- Check that `initialize` was called by the factory during deployment
- Verify `minQuorum > 0` and `executor != 0xdeadbeef6` (disabled sentinel value)
- Use `accountImplementation()` to verify the proxy points to a valid implementation

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the transaction trace for detailed revert reasons (use Tenderly or a block explorer with trace support)
2. Verify your UserOperation with `eth_estimateUserOperationGas` before submitting
3. [Open an issue](https://github.com/voltahq/docs/issues) on GitHub
