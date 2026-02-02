# Volta Troubleshooting Guide

This guide covers common errors and issues when working with the Volta multi-signature governance contract.

## Contract Errors

### NotInitialized (Error Code 2)

**Message:** Contract has not been initialized.

**Cause:** Attempting to call contract functions before initialization.

**Solution:** Initialize the contract with a valid configuration:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <SOURCE_ACCOUNT> \
  --network <NETWORK> \
  -- \
  __constructor \
  --config '{"owners": ["G...", "G..."], "threshold": 2}'
```

---

### InvalidOwners (Error Code 5)

**Message:** Invalid owner configuration.

**Cause:**

- Fewer than 2 owners provided
- Duplicate addresses in the owners list

**Solution:** Ensure your configuration includes at least 2 unique owner addresses:

```json
{
  "owners": ["GABCD...", "GEFGH..."],
  "threshold": 2
}
```

---

### InvalidThreshold (Error Code 6)

**Message:** Invalid voting threshold.

**Cause:** Threshold is either:

- Less than 2 (the minimum required)
- Greater than the number of owners

**Solution:** Set threshold between 2 and your owner count:

- 2 owners → threshold must be 2
- 3 owners → threshold can be 2 or 3
- 5 owners → threshold can be 2, 3, 4, or 5

---

### NotOwner (Error Code 8)

**Message:** Caller is not an owner.

**Cause:** A non-owner address attempted to:

- Create a proposal
- Vote on a proposal
- Invoke a contract through Volta

**Solution:** Ensure the transaction is signed by an address in the contract's owner list. Check current owners:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network <NETWORK> \
  -- \
  get_config
```

---

### ProposalNotFound (Error Code 9)

**Message:** Proposal does not exist.

**Cause:**

- Proposal ID doesn't exist
- Proposal expired (proposals have a ~1 week TTL)
- Proposal was already executed or rejected

**Solution:**

- Verify the proposal ID is correct
- Create a new proposal if the original expired
- Check proposal status before voting

---

### VoterAlreadyVoted (Error Code 10)

**Message:** This owner has already voted on this proposal.

**Cause:** An owner attempted to vote twice on the same proposal.

**Solution:** Votes cannot be changed once cast. Each owner gets one vote per proposal. If a mistake was made, the proposal creator can revoke the proposal and create a new one.

---

### ProposalNotPending (Error Code 11)

**Message:** Proposal is not in pending status.

**Cause:**

- Attempting to vote on an already executed/rejected/revoked proposal
- Attempting to revoke a proposal that's no longer pending
- Proposal was invalidated by a config change (all proposals before the last config change are invalid)

**Solution:** Check proposal status. If needed, create a new proposal.

---

### InvokeError (Error Code 12)

**Message:** Contract invocation failed.

**Cause:** The target contract call failed during execution. This could be due to:

- Target contract reverted
- Insufficient authorization
- Invalid arguments
- Target contract doesn't exist

**Solution:**

- Verify the target contract address is correct
- Check that the function name and arguments are valid
- Ensure proper authorization entries are provided
- Test the invocation on testnet first

---

### NoConfigChanges (Error Code 14)

**Message:** Proposed configuration is identical to current configuration.

**Cause:** A Config proposal was created with the same owners and threshold as the existing configuration.

**Solution:** Only create Config proposals when you need to change the owners or threshold.

---

### NotCaller (Error Code 15)

**Message:** Only the original proposer can perform this action.

**Cause:** Attempting to revoke a proposal created by a different owner.

**Solution:** Only the owner who created a proposal can revoke it. Other owners can vote No to reject it instead.

---

### InvokeNotAllowed (Error Code 19)

**Message:** Invoke proposals cannot be created directly.

**Cause:** Attempted to use `propose()` to create an Invoke proposal.

**Solution:** Use the `invoke()` function instead of `propose()` for contract invocations:

```bash
stellar contract invoke \
  --id <VOLTA_CONTRACT_ID> \
  --source <OWNER_ACCOUNT> \
  --network <NETWORK> \
  -- \
  invoke \
  --caller <OWNER_ADDRESS> \
  --contract <TARGET_CONTRACT> \
  --fn_name <FUNCTION_NAME> \
  --args '[]' \
  --auth_entries '[]'
```

---

### InvalidUpgrade (Error Code 22)

**Message:** Invalid upgrade hash.

**Cause:** Upgrade proposal contains an invalid WASM hash:

- All zeros (`0x0000...0000`)
- All ones (`0xFFFF...FFFF`)

**Solution:** Provide a valid WASM hash from a contract uploaded to the network:

```bash
# Upload new WASM and get hash
stellar contract upload \
  --wasm <PATH_TO_WASM> \
  --source <SOURCE_ACCOUNT> \
  --network <NETWORK>

# Use the returned hash in your upgrade proposal
```

---

### AddressNotExecutable (Error Code 23)

**Message:** Target address is not a contract.

**Cause:** An Invoke proposal targets an address that is not a deployed contract (e.g., a regular Stellar account).

**Solution:** Ensure the target address is a valid contract address (starts with `C` on Stellar).

---

### InvalidFunctionName (Error Code 24)

**Message:** Function name is empty.

**Cause:** An Invoke proposal was created with an empty function name.

**Solution:** Provide a valid function name for the target contract.

---

## Common Issues

### Proposal Expired Before Voting Completed

**Symptom:** Proposal returns `ProposalNotFound` after some time.

**Cause:** Proposals automatically expire after approximately 1 week (120,960 ledgers).

**Solution:** Ensure all owners vote within the TTL window. For time-sensitive proposals, coordinate with owners beforehand.

---

### Proposals Invalidated After Config Change

**Symptom:** Existing proposals return `ProposalNotPending` after a config change is executed.

**Cause:** When a Config or Upgrade proposal is executed, all prior pending proposals are invalidated. This is a security feature to ensure proposals are approved by the current owner set.

**Solution:** Re-create any necessary proposals after config changes. Coordinate config changes to minimize disruption.

---

### Transaction Fails with "Authorization Required"

**Symptom:** Transaction rejected before reaching the contract.

**Cause:** Missing or invalid signature from the owner account.

**Solution:** Ensure you're signing with the correct owner key:

```bash
stellar contract invoke \
  --source <OWNER_SECRET_KEY> \  # Must be an owner
  ...
```

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the contract events for detailed error information
2. Verify your transaction on [Stellar Expert](https://stellar.expert)
3. [Open an issue](https://github.com/voltahq/docs/issues) on GitHub
