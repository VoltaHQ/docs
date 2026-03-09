# Volta CosmWasm Troubleshooting Guide

This guide covers common errors and issues when working with the Volta CosmWasm contract on CosmWasm-compatible chains.

## Contract Errors

### Unauthorized

**Cause:** The sender is not authorized to perform the action:

- For `CosmosMsg`: Sender is not the admin, an owner, or a user with rules
- For `Propose`: Sender is not the admin
- For `Vote`: Sender is not an owner

**Solution:** Verify the sender's role. Check who the admin and owners are by looking at the contract's instantiation or the most recent Configuration proposal.

---

### InvalidM

**Message:** `InvalidM: n {n} m {m}`

**Cause:** The threshold `m` is either:
- Less than 2 (the minimum required)
- Greater than the number of owners `n`

**Solution:** Set `m` between 2 and the number of owners:
- 2 owners → `m` must be 2
- 3 owners → `m` can be 2 or 3
- 5 owners → `m` can be 2, 3, 4, or 5

---

### TooFewOwners

**Message:** `TooFewOwners: must be at least 2 owners, received {n}`

**Cause:** Fewer than 2 valid owner addresses provided. Note that the admin address is automatically excluded from the owner count.

**Solution:** Provide at least 2 unique owner addresses that are different from the admin.

---

### InvalidOwners

**Cause:** One or more of the following:
- Duplicate addresses in the owners list
- Invalid addresses that fail validation
- The admin address is included in the owners list

**Solution:**
- Remove duplicate addresses
- Verify all addresses are valid for the target chain
- Ensure the admin address is **not** in the owners list

---

### InvalidAddress

**Message:** `InvalidAddress: {addr}`

**Cause:** An address failed chain-specific validation (e.g., invalid bech32 encoding).

**Solution:** Verify the address is valid for your chain (e.g., `inj1...` for Injective).

---

### InvalidMaxProposalSize

**Message:** `InvalidMaxProposalSize: min {min} provided {provided}`

**Cause:** `max_proposal_size` in the config is less than 1.

**Solution:** Set `max_proposal_size` to at least 1 (default is 32).

---

### ZeroPeriodicFeeGrant

**Cause:** `periodic_fee_grant.amount` is set to zero.

**Solution:** Provide a non-zero amount for the periodic fee grant. Default value is approximately $4,000 USD equivalent:
- Injective: `227000000000000000000` inj

---

### InvalidPayload

**Cause:** A Cosmos message could not be serialized or deserialized for rule evaluation. The message JSON structure is unexpected.

**Solution:** Verify the Cosmos message structure matches the expected format for the message type.

---

### UnsupportedCosmosMsg

**Cause:** The Cosmos message type is not supported by the rules engine.

**Solution:** Supported types are: Bank, Staking, Distribution, Gov, IBC, Wasm (Execute, Instantiate, Migrate), and Stargate. Use one of these types.

---

### ProposalNotOpen

**Cause:** Attempting to vote on a proposal that is not in the `Open` state. The proposal may have already passed, been rejected, or been superseded.

**Solution:** Query proposals to check the current state:

```bash
injectived query wasm contract-state smart <CONTRACT> '{"get_proposals":{"filter":"all"}}'
```

If the proposal was superseded, a newer proposal of the same type has replaced it.

---

### ProposalNotFound

**Cause:** The proposal ID does not exist.

**Solution:** Verify the proposal ID is correct by querying active proposals.

---

### AlreadyVoted

**Cause:** The owner has already cast a vote on this proposal. Votes cannot be changed.

**Solution:** Each owner gets one vote per proposal. If a mistake was made, coordinate with other owners to vote against and create a new proposal.

---

### ProposalExpired

**Cause:** The proposal has passed its expiration time.

**Solution:** Create a new proposal to replace the expired one.

---

### AlreadyFeeGranted

**Cause:** Attempting to create a fee grant for an address that already has one.

**Solution:** This is an internal error that typically doesn't surface to users. It occurs when the contract tries to grant fees to an address that was already granted. No action needed.

---

### NotFeeGranted

**Cause:** Attempting to revoke a fee grant for an address that doesn't have one.

**Solution:** This is an internal error. No action needed — the address has no fee grant to revoke.

---

### NoRulesToRevoke

**Cause:** A `RevokeRules` proposal was created for an address that has no rules assigned.

**Solution:** Verify the target address actually has rules before proposing revocation. Query the contract state or check for approved Rules proposals.

---

## Common Issues

### Message Allowed But Not Executing

**Symptom:** Transaction succeeds with `allowed=true` in attributes, but the target action doesn't take effect.

**Cause:** The wallet contract may not have sufficient funds to execute the bank send or wasm call.

**Solution:** Ensure the contract address has enough tokens to cover the message being executed.

---

### Message Falls to Proposal Despite Having Rules

**Symptom:** Transaction succeeds with `allowed=false` and a `proposal_id` is created, even though the user has rules.

**Cause:** The message didn't match any of the user's rule sets. Possible reasons:
- Field paths don't match the flattened message structure
- Data type mismatch (e.g., using `int` for a decimal value)
- Comparator doesn't support the data type (e.g., `gt` on a `string`)
- Nominal daily limit exceeded for bank sends

**Solution:**
1. Verify the flattened field paths by manually flattening the message JSON
2. Check that `data_type` matches the actual field format
3. Verify the `comparer` is valid for the chosen `data_type`
4. Check daily nominal limit usage

---

### Configuration Change Resets All Proposals

**Symptom:** After a Configuration proposal passes, all other open proposals show reset vote counts.

**Cause:** This is intentional security behavior. When the owner set changes, all open proposals are reset (votes cleared) so the new owner set must re-evaluate them.

**Solution:** After a config change, owners need to re-vote on any pending proposals they still want to approve.

---

### Superseded Proposal

**Symptom:** A proposal has state `Superseded` and cannot be voted on.

**Cause:** A new proposal of the same type (and for the same address, if applicable) was created, automatically superseding the older one. This applies to:
- Configuration proposals (only one active at a time)
- Rules proposals (one per target address)
- RevokeRules proposals (one per target address)
- RevokeAllRules proposals (only one active at a time)

**Solution:** Vote on the newer proposal instead. CosmosMsgs proposals are not superseded this way (they're capped at `max_proposal_size` per initiator address).

---

### Fee Grant Not Working

**Symptom:** User gets "insufficient fees" despite having a fee grant.

**Cause:**
- Daily fee grant limit has been reached
- Fee grant only covers `MsgExecuteContract` (and additional wasm messages for admin)
- The fee grant was revoked when rules were revoked

**Solution:**
1. Wait for the next day for the periodic allowance to reset
2. Ensure the transaction type is covered by the fee grant
3. Verify the user still has rules assigned (rules revocation also revokes fee grants)

---

### Owner Auto-Vote Not Counting

**Symptom:** An owner sends a CosmosMsg that falls to a proposal, but the proposal shows 0 Yes votes.

**Cause:** This shouldn't happen — owner auto-voting is built in. If it appears to show 0, the query may be returning a different proposal.

**Solution:** Check the `proposal_id` in the transaction attributes and query that specific proposal.

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check transaction attributes for detailed status information (`allowed`, `proposal_id`, `executed`, etc.)
2. Query proposals to verify current state: `{"get_proposals": {"filter": "all"}}`
3. [Open an issue](https://github.com/voltahq/docs/issues) on GitHub
