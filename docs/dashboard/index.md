# Volta Circuit Dashboard

Volta Circuit is the web app for running multi-owner vaults. A vault holds funds that can only move once enough of its owners approve. On Stellar each vault is a Soroban multisig contract (a `C…` address). The [Stellar/Soroban](../stellar/index.md) section documents that contract; this section covers the dashboard built on top of it.

These pages describe the current dashboard. If you see an older layout with a "Portfolio" and "Transactions" menu, the new dashboard has not reached that environment yet.

## Environments

| Environment | URL | Use it for |
|---|---|---|
| Development | [dashboard.dev.voltacircuit.com](https://dashboard.dev.voltacircuit.com) | Testing and QA. New releases arrive here before production. |
| Production | [dashboard.voltacircuit.com](https://dashboard.voltacircuit.com) | Real vaults and real funds. |

Both environments can show mainnet and testnet vaults. **Test vault flows on testnet**, where every asset is free and nothing has real value. Payment providers behave differently in each environment, and on development one of them uses real money; read [Buy and cash out](buy-and-cash-out.md) before testing them.

## Ecosystems and networks

The dashboard serves three ecosystems:

| Ecosystem | Vaults | Wallets |
|---|---|---|
| **Stellar** | Soroban multisig contracts | Freighter, xBull, Albedo, Lobstr, Rabet, Hana, Klever, HOT Wallet, Ledger, and WalletConnect where configured |
| **EVM** | ERC-4337 smart accounts on Ethereum, Base, Arbitrum, Sei and other EVM chains | Browser and WalletConnect wallets |
| **Injective** | CosmWasm multisig contracts | Injective wallets |

The switcher at the top of the sidebar picks the ecosystem, and below it the network (**Mainnet** or **Testnet**) for that ecosystem. Each ecosystem remembers its own network. Every page, total and form follows the selection. On testnet the top bar shows a banner: *Testnet. Vaults, balances and transfers here are test funds with no real value.*

Links don't depend on the selection: opening a link to a payment or vault switches to the ecosystem it belongs to.

## Accounts, wallets and owners

The dashboard uses two separate identities:

- **Your account** signs you in to the dashboard: email and password, or Google or GitHub. New accounts are created from the **Sign Up** tab on the sign-in page, and two-factor sign-in is required.
- **Your wallet** signs on-chain transactions. Use **Connect wallet** in the top bar, then **Verify wallet**, which asks you to sign a one-time message that links the wallet to your account. Verifying does not move funds.

Only wallets listed as a vault's **owners** can propose and vote for it. The overview's *Your signing access* panel shows where you stand: *Connect your signing wallet*, *Verify this wallet*, *This wallet is not a vault owner*, or *Ready to approve*.

Organisation admins also manage team members. Read-only users can see vaults and payments but can't propose or move funds.

## Navigation

| Sidebar item | What it does |
|---|---|
| **Overview** | Total treasury balance, your signing access, payments waiting for your approval, recent payments, recipients |
| **Payments** | Every proposal, with tabs *Needs your approval*, *Waiting on others* and *All payments* |
| **Treasury** | Your vaults, their balances and owners; create a vault from here |
| **Bridge** | Move USDC between Stellar and EVM chains (Circle CCTP) |
| **dApps** | EVM only: connect a vault to dApps |
| **Recipients** | Saved addresses |
| **Tx builder** | Propose a call to any contract |
| **Deploy asset** | Stellar only: issue a new asset controlled by a vault |

Items appear only for the ecosystems that support them. Below the main menu, a **Coming soon** section previews products that aren't available yet, each with a waitlist; organisation admins also get an **Admin** section. At the bottom of the sidebar are **Classic app** (the previous dashboard, kept at `/old` while the remaining flows move over), **Settings**, the theme toggle and sign out.

The top bar holds the network, notifications and your wallet.

## Next steps

- [Using the dashboard](flows.md): every flow, step by step
- [Buy and cash out](buy-and-cash-out.md): card purchases and cash-out providers in each environment
- [Testing guide](testing.md): setup, a test checklist and known limitations
