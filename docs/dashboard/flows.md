# Using the Dashboard

This page walks through each flow on Stellar. EVM and Injective work the same way unless noted; see [which flows each ecosystem offers](#flows-per-ecosystem).

Anything that moves funds or changes a vault is a **proposal**. It runs only after enough owners approve it, and the dashboard shows the approval rule (for example *2 of 3 approvals required*) on every form.

## Sign in

1. Open the dashboard and sign in from the **Login** tab, or create an account from **Sign Up** (email, organisation name, full name and password). Google and GitHub sign-in are also offered.
2. Set up two-factor sign-in when asked.
3. You land on **Overview**.

## Choose the ecosystem and network

1. Open the switcher at the top of the sidebar.
2. Under **Ecosystem**, pick Stellar, EVM or Injective. The menu shows how many vaults you have on each.
3. Under **Stellar network**, pick **Mainnet** or **Testnet**.

Lists, totals and forms now show only that ecosystem and network. Set your wallet to the same network before signing.

## Connect and verify your wallet

1. Select **Connect wallet** in the top bar and choose a wallet, such as Freighter or xBull.
2. Select **Verify wallet** and sign the one-time message. It links the wallet to your account and does not move funds.
3. The overview's *Your signing access* panel shows *Ready to approve* once the wallet owns at least one vault, or *This wallet is not a vault owner* otherwise.

## Create a vault

**Treasury → New vault** has three steps:

1. **Vault**: a name and the chain (for example Stellar testnet).
2. **Owners and approvals**: add each owner's name and wallet address. **Add my connected wallet** fills in yours. Then set how many owners must approve. The page warns when *Any one owner can move funds alone* or *Every owner must approve*.
3. **Review and create**: check the summary, tick *I have checked every owner address*, then select **Create vault**.

On Stellar your connected wallet signs and pays for the contract deployment (a small XLM fee). The result is *Your vault is ready.* and the vault appears under **Treasury**.

!!! note
    A vault needs at least two owners. A wrong owner address can only be removed later with the other owners' approval.

## Add funds

**Add funds** (from the vault page or Treasury) asks *Into which vault?*, then *How would you like to add funds?*:

- **Deposit from a wallet**: shows the vault's address and a QR code. The page watches for incoming funds and updates on its own; receiving needs no approval. On Stellar the address is a contract (`C…`) address: send from a wallet that supports contract addresses, such as Freighter or xBull. Many exchanges can't withdraw to one. No memo is needed.
- **Buy with card**: see [Buy and cash out](buy-and-cash-out.md).
- **Bridge from another chain**: brings USDC in from an EVM chain; see [Bridge](#bridge).

## Send a payment

**Payments → New payment**, or **Send payment** on a vault or recipient, has two steps:

1. **Payment details**: pick the vault (*Pay from*), the recipient (a saved recipient, or a pasted `G…` or `C…` address), the asset and amount, and an optional *Payment reference* that only your team sees. Select **Review payment**.
2. **Review and sign**: check the summary, tick *I have checked the destination address*, then select **Sign and propose**. Your wallet signs the proposal.

The result is *Payment proposed. Other owners have been asked to approve.* Your own vote counts as the first approval.

!!! warning "No on-chain memo"
    Soroban transfers cannot carry a public memo. Don't send to an exchange or service that requires a memo for deposits.

The review step also warns when your wallet isn't verified or isn't an owner of the vault.

## Approve, reject or revoke a payment

**Payments** has three tabs: **Needs your approval** (with a count in the menu), **Waiting on others** and **All payments**. Open a payment to see:

- **What will happen** (or **Summary** once it's finished): amount, destination and asset
- **Progress**: each owner's vote (*Approved*, *Rejected*, *Not voted*) against the threshold
- **Details**: vault, creation time, proposal number and a link to the block explorer
- Your voting panel, which explains why you can or can't vote right now

To vote, select **Vote Yes**, **Vote No** or **Abstain** and sign in your wallet. When the vote that meets the threshold lands, the proposal executes in the same transaction and the funds move.

- Only the owner who created a proposal can **Revoke proposal** while it is pending.
- A proposal is rejected automatically once enough owners vote no that it can no longer pass.
- Proposals expire after about a week. Voting closes 30 seconds before expiry.

## Change owners and approvals

On a vault, **Approval policy → Change owners** has two steps:

1. **Owners and approvals**: add or remove owners and change the threshold.
2. **Review and propose**: the summary lists who is **Added**, **Removed** and **Staying**, and the new approvals. Select **Propose change**.

Nothing changes until the current owners approve it. The page warns if you remove your own wallet.

!!! note
    When an owner change or upgrade executes, every other pending proposal on that vault is cancelled. Re-propose them afterwards.

## Upgrade a vault

When a vault runs an older contract version, its page shows *Upgrade to contract version N before this vault can send*. Select **Propose upgrade**. Older vaults may need two or three proposals; the notice says how many, and owners approve them from the last to the first.

## Tx builder

**Tx builder** proposes a call to any contract in three steps: **Vault**, **Call** (contract, function and arguments) and **Review and propose**. Like a payment, it runs only after enough owners approve it.

## Recipients

**Recipients** lists saved addresses for the current ecosystem, each marked as a *Contract* (`C…`) or *Account* (`G…`). **Send payment** on a card starts a payment to it. **Add recipient** opens the address book in the classic app.

## Swap

On a Stellar vault, select **Swap**. Choose the *From token*, *Amount*, *To token* and *Max slippage (%)*, then propose. The swap runs only after enough owners approve it.

On mainnet, quotes come from the Soroswap aggregator, which splits a trade across several Stellar exchanges. On testnet they come from the Soroswap router alone, so fewer pairs have liquidity. Swapping needs a vault at contract version 1 or later.

## Bridge

**Bridge** moves USDC between Stellar vaults and EVM chains through Circle's CCTP. USDC leaving a vault needs its owners' approval; arriving does not.

1. Choose the source and destination, then the amount. The form shows what you send, the Circle fee and when it arrives.
2. From a vault, the transfer is proposed for the owners to approve. From your own wallet, you sign directly.
3. Once Circle attests the transfer, it's delivered on the destination chain. The transfer stays listed on the Bridge page until it's done, so you can leave the page.

Testnet transfers use Circle's testnet contracts. A Stellar `G…` destination must already trust USDC, or delivery waits until it does. **Finish a transfer started elsewhere** completes an attested transfer from its transaction hash.

## Cash out

On a Stellar vault, select **Cash out**. See [Buy and cash out](buy-and-cash-out.md).

## Deploy asset

**Deploy asset** issues a new Stellar asset whose only admin is one of your vaults:

1. Pick the *Vault that will control the asset*, enter the asset code (1 to 12 letters or digits) and, optionally, clawback, a home domain, an initial supply and a note.
2. Your wallet funds a new issuer account with about 4 XLM (whatever is left is returned) and signs one transaction.
3. The result shows the asset contract, the issuer account (*Permanently locked*) and the admin vault. If you set an initial supply, **View mint proposal** opens the proposal that mints it.

If a step fails, **Retry** or **Resume** continues where it stopped.

## Notifications

The bell in the top bar lists *Unread* and *Earlier* notifications, such as proposals waiting for your vote.

## Settings

**Settings** has **Profile** (your name) and **Security** (password and two-factor sign-in).

## Classic app

**Classic app** in the sidebar opens the previous dashboard at `/old`. It still hosts organisation policy rules and the address book editor. Old links, such as `/transactions/…`, redirect to the page that replaces them.

## Flows per ecosystem

| Flow | Stellar | EVM | Injective |
|---|:-:|:-:|:-:|
| Send, Tx builder, Recipients, Add funds | ✓ | ✓ | ✓ |
| Buy with card | ✓ | ✓ | |
| Owner changes | ✓ | ✓ | |
| Bridge | ✓ | ✓ | |
| Swap | ✓ (Soroswap) | Where enabled (Uniswap) | |
| Cash out | ✓ | | |
| Deploy asset | ✓ | | |
| dApps | | ✓ | |
