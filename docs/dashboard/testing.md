# Testing Guide

This guide is for testing the dashboard end to end. Test on **[dashboard.dev.voltacircuit.com](https://dashboard.dev.voltacircuit.com)** with the **Stellar testnet** network selected, unless a row below says otherwise. Testnet assets are free and nothing there has real value.

## Setup

1. **A Volta account.** Sign up on the development site (**Sign Up** tab) and set up two-factor sign-in.
2. **Two Stellar wallets.** Multi-owner flows need at least two owner wallets. The simplest setup is two browser profiles, each with Freighter (or xBull) and its own Volta account. Switch each wallet to **Testnet**.
3. **Testnet XLM.** Fund each wallet with Friendbot, from the [Stellar Lab](https://lab.stellar.org/account/fund) with Testnet selected. It sends 10,000 testnet XLM. Creating a vault and signing proposals cost a small XLM fee.
4. **Testnet USDC (optional).** For USDC payments and the bridge: add a USDC trustline in your wallet, then use [Circle's faucet](https://faucet.circle.com/) and choose Stellar testnet.
5. In the dashboard: pick **Stellar** and **Testnet** in the sidebar switcher, then **Connect wallet** and **Verify wallet** in each profile.

## Test checklist

Steps for each flow are on [Using the dashboard](flows.md).

| # | Flow | Network | Expected result |
|---|---|---|---|
| 1 | Sign up, sign in, two-factor | — | You land on **Overview**. |
| 2 | Switch ecosystem and network | Both | Lists and totals change with the selection; testnet shows the testnet banner. |
| 3 | Connect and verify a wallet | Testnet | *Your signing access* moves from *Connect your signing wallet* to *Verify this wallet* to *Ready to approve* (or *This wallet is not a vault owner*). |
| 4 | Create a 2-of-2 vault with both wallets as owners | Testnet | *Your vault is ready.*; the vault appears under **Treasury** for both accounts. |
| 5 | Add funds by deposit: send testnet XLM from a wallet to the vault's `C…` address | Testnet | The page notices the incoming funds; the vault balance updates. |
| 6 | Send a payment from the vault | Testnet | *Payment proposed. Other owners have been asked to approve.*; it appears under **Waiting on others** for the proposer and **Needs your approval** for the other owner. |
| 7 | Approve it with the second owner (**Vote Yes**) | Testnet | The payment executes; the recipient receives the funds; **Progress** shows both approvals. |
| 8 | Reject a payment (**Vote No**) | Testnet | With a 2-of-2 vault, one No rejects it at once. |
| 9 | Revoke a pending payment as its creator | Testnet | The proposal is revoked; other owners can't revoke it. |
| 10 | Change owners or the threshold | Testnet | The change is proposed; once approved, the vault shows the new owners. Other pending proposals on that vault are cancelled. |
| 11 | Tx builder: call a contract from the vault | Testnet | *Contract call proposed. Other owners have been asked to approve.*; it runs once approved. |
| 12 | Recipients: send to a saved recipient | Testnet | **Send payment** opens a payment with the address filled in. Adding a recipient opens the classic app. |
| 13 | Swap from the vault | Testnet or mainnet | A quote appears and the swap is proposed; it executes once approved. Testnet liquidity is thin, so try XLM with a common pair. |
| 14 | Bridge USDC between a Stellar vault and an EVM testnet chain | Testnet | The transfer is proposed, attested by Circle, then delivered; it stays listed under transfers until done. |
| 15 | Deploy asset | Testnet | The result shows the asset contract, a locked issuer account and the admin vault. |
| 16 | Buy with card through Transak staging | Testnet | The checkout opens with test payment methods and the order is created. Delivery never happens on staging; this is expected. |
| 17 | Cash out through Transak staging (XLM) | Testnet | The vault transfer is proposed; after approval the XLM reaches Transak and the payout is simulated. |
| 18 | MoneyGram cash in and cash out (USDC) | Testnet | Sandbox checkout completes with testnet USDC. Use realistic, non-sequential ID numbers in the sandbox's identity checks. |
| 19 | Buy with card through Coinbase | **Mainnet, real money** | Only with a mainnet vault and a small amount. Apple Pay completes and XLM arrives in the vault. |
| 20 | Notifications | Testnet | A proposal waiting for your vote appears under *Unread* in the bell. |
| 21 | Settings | — | Profile and security changes save. |
| 22 | Classic app and old links | — | **Classic app** opens `/old`; an old link such as `/transactions/…` redirects to the matching new page. |
| 23 | Dark theme, small screens, keyboard | — | Pages stay readable; below 960px the sidebar becomes a menu; every control is reachable by keyboard with a visible focus ring. |

## Known limitations

- **Coinbase on development is live.** It charges real money and funds mainnet vaults only.
- **Transak staging purchases never deliver** the asset to the vault.
- **Coinbase cash-outs are paused** on Stellar, and MoneyGram isn't available on production yet.
- **Cash out is Stellar only.** EVM and Injective vaults can't cash out.
- **Recipients are read-only** in the new dashboard; add and edit them in the classic app.
- **Injective** has no owner changes, swap, bridge or buy with card yet.
- **Bridge transfers in progress** are remembered by the browser that started them. Another owner can finish one with **Finish a transfer started elsewhere**.
- **Vault upgrades** only appear for vaults on an older contract version, which new testnet vaults aren't.
- **Soroban payments carry no memo**, so they can't pay exchange deposit addresses that need one.

## Reporting a problem

For each issue, include:

- The environment URL and the ecosystem and network selected
- The page URL, or the payment link for a proposal
- The wallet used and whether it's an owner of the vault
- What you expected and what happened, with a screenshot or the error message
- The transaction hash, if a wallet signed something
