# Creating Your First Multi-Sig Proposal

This tutorial walks through creating, voting on, and executing a proposal using the Volta multi-signature contract.

## Prerequisites

- Volta contract deployed and initialized (see [Getting Started](./getting-started.md))
- Access to owner account keys
- Contract ID from deployment

## Example Scenario

We'll create a Config proposal to add a new owner to a 2-of-3 multi-sig, changing it to a 2-of-4 configuration.

**Current config:**
- Owners: Alice, Bob, Carol
- Threshold: 2

**Proposed config:**
- Owners: Alice, Bob, Carol, Dave
- Threshold: 2

## Step 1: Create the Proposal

Any owner can create a proposal. Here, Alice creates it:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ALICE_SECRET_KEY> \
  --network testnet \
  -- \
  propose \
  --owner <ALICE_ADDRESS> \
  --proposal '{"Config": {"owners": ["GALICE...", "GBOB...", "GCAROL...", "GDAVE..."], "threshold": 2}}'
```

**Response:**
```json
{
  "id": 1,
  "caller": "GALICE...",
  "proposal_type": {"Config": {"owners": [...], "threshold": 2}},
  "status": "Pending",
  "votes": {}
}
```

Note the proposal `id` (1 in this example) for voting.

## Step 2: Review the Proposal

Other owners should review the proposal before voting:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_proposal \
  --proposal_id 1
```

Verify:
- The new owner list is correct
- The threshold is appropriate
- The proposal creator is a trusted owner

## Step 3: Vote on the Proposal

Owners vote Yes, No, or Abstain. With a threshold of 2, we need 2 Yes votes.

**Bob votes Yes:**
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <BOB_SECRET_KEY> \
  --network testnet \
  -- \
  vote \
  --owner <BOB_ADDRESS> \
  --proposal_id 1 \
  --vote "Yes"
```

**Response (still pending, 1 of 2 votes):**
```json
{
  "id": 1,
  "status": "Pending",
  "votes": {"GBOB...": "Yes"}
}
```

**Carol votes Yes:**
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <CAROL_SECRET_KEY> \
  --network testnet \
  -- \
  vote \
  --owner <CAROL_ADDRESS> \
  --proposal_id 1 \
  --vote "Yes"
```

**Response (approved and executed!):**
```json
{
  "id": 1,
  "status": "Executed",
  "votes": {"GBOB...": "Yes", "GCAROL...": "Yes"}
}
```

## Step 4: Verify the Change

Confirm the new configuration:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  get_config
```

**Response:**
```json
{
  "owners": ["GALICE...", "GBOB...", "GCAROL...", "GDAVE..."],
  "threshold": 2
}
```

Dave is now an owner.

## Vote Types Explained

| Vote | Effect |
|------|--------|
| **Yes** | Counts toward approval threshold |
| **No** | Counts against approval |
| **Abstain** | Neutral; reduces remaining votes but doesn't reject |

**Approval logic:**
- Approved when `Yes votes >= threshold`
- Rejected when approval becomes mathematically impossible: `Yes votes + remaining votes < threshold`

**Example with 3 owners, threshold 2:**
- 2 Yes → Approved (threshold met)
- 2 No → Rejected (impossible to reach 2 Yes)
- 1 Yes, 1 No, 1 Abstain → Rejected (only 1 Yes possible, need 2)
- 1 Yes, 2 Abstain → Rejected (only 1 Yes, need 2)

## Revoking a Proposal

If you created a proposal and want to cancel it before execution:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ALICE_SECRET_KEY> \
  --network testnet \
  -- \
  revoke_proposal \
  --caller <ALICE_ADDRESS> \
  --proposal_id 1
```

**Note:** Only the original proposer can revoke. Other owners can vote No instead.

## Creating an Invoke Proposal

To call another contract through Volta, use `invoke` instead of `propose`:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ALICE_SECRET_KEY> \
  --network testnet \
  -- \
  invoke \
  --caller <ALICE_ADDRESS> \
  --contract <TARGET_CONTRACT_ID> \
  --fn_name "transfer" \
  --args '[{"Address": "GDEST..."}, {"I128": {"hi": 0, "lo": 1000000}}]' \
  --auth_entries '[]'
```

**Important:** Invoke proposals automatically count the creator's vote as Yes, so they need `threshold - 1` additional votes.

## Creating an Upgrade Proposal

To upgrade the Volta contract itself:

```bash
# First, upload the new WASM
stellar contract upload \
  --wasm volta_v2.optimized.wasm \
  --source <SOURCE_ACCOUNT> \
  --network testnet
# Returns: <NEW_WASM_HASH>

# Create upgrade proposal
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ALICE_SECRET_KEY> \
  --network testnet \
  -- \
  propose \
  --owner <ALICE_ADDRESS> \
  --proposal '{"Upgrade": "<NEW_WASM_HASH>"}'
```

**Warning:** Upgrade proposals invalidate all pending proposals when executed. Coordinate with other owners.

## Common Issues

- **ProposalNotFound**: Proposal may have expired (~1 week TTL) or already executed
- **VoterAlreadyVoted**: Each owner can only vote once per proposal
- **NotOwner**: Ensure you're signing with an owner key

See the [Troubleshooting Guide](../troubleshooting.md) for more details.

## Next Steps

- [Integrating Volta with Your dApp](./integration.md)
- [Troubleshooting Guide](../troubleshooting.md)
