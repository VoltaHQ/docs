# Buy and Cash Out

The dashboard works with payment providers to buy crypto into a vault with a card (**Buy with card** under **Add funds**) and to sell from a vault for cash (**Cash out**, Stellar vaults only). Each form offers only the providers available in the current environment, and the vault and network you pick must match what that provider supports.

!!! danger "Coinbase on the development environment uses real money"
    On [dashboard.dev.voltacircuit.com](https://dashboard.dev.voltacircuit.com), Coinbase checkout is **live**: it charges a real card and delivers real XLM on Stellar mainnet. Use small amounts. Every other provider on development is a test environment.

## Providers by environment

| Provider | Flow | Development | Production |
|---|---|---|---|
| **Coinbase** | Buy | Live: real payment, mainnet vaults only | Live |
| **Coinbase** | Cash out | Not available | Not available |
| **Transak** | Buy | Transak staging: test payments, testnet vaults only, funds never delivered (see below) | Live |
| **Transak** | Cash out (XLM) | Transak staging: testnet XLM, payout simulated | Live |
| **MoneyGram** | Buy (cash in), cash out (USDC) | MoneyGram sandbox: testnet USDC, no real cash | Not yet available |

Coinbase has paused cash-outs on Stellar, so they aren't offered anywhere for now.

## How delivery works

Providers can't pay a Soroban contract address directly, so each purchase or sale uses a deposit address dedicated to it:

- **Buy**: the provider sends the asset to the deposit address, and Volta forwards it to your vault. The form tracks *Waiting for {provider} to send the funds*, *Delivering to your vault* and *Delivered … to …*.
- **Cash out**: the vault sends the asset to the deposit address as a normal proposal, and Volta forwards it to the provider once it arrives. Funds leave the vault only after enough owners approve.

## Buy with card

1. **Add funds → Buy with card**, then pick the vault and provider.
2. Enter the amount and complete the provider's checkout, which opens inside the page.
3. The status steps above show progress until the funds reach the vault.

### Coinbase

- Funds Stellar mainnet vaults only. For a testnet vault the form explains *Coinbase sells real assets on the Stellar public network, so it cannot fund a testnet vault.*
- Needs a US mobile number, verified with a six-digit code Coinbase sends by SMS, and acceptance of Coinbase's terms.
- Pays with **Apple Pay**. Safari on an iPhone or Mac shows the Apple Pay sheet directly; other browsers show a QR code to finish on a phone. The phone handoff is less reliable, so test on a phone's Safari where you can.
- Google Pay doesn't work on websites (Coinbase supports it in Android apps only).
- Coinbase limits how many guest purchases one phone number or email can make each week. Repeated tests can hit that limit.

### Transak

- On development the form shows *Transak staging: Showing testnet destinations only. Checkout uses Transak's test payment methods; no real funds move.*
- **Staging purchases never deliver.** Transak's staging environment doesn't send XLM, so a test purchase stays in Transak's *pending delivery* state. That's expected, not a dashboard bug. A staging purchase checks the checkout and order creation only.
- Transak allows one open order per customer. If an earlier order is unfinished, the checkout offers to resolve it first.

### MoneyGram (cash in)

- Pay cash at a MoneyGram location and receive USDC in your vault. The checkout gives you a reference to take, with your ID, to the location.
- On development the sandbox uses testnet USDC and no real cash changes hands.

## Cash out

1. Open a Stellar vault and select **Cash out**.
2. Pick the provider and asset (XLM for Transak, USDC for MoneyGram), enter the amount, and check the quote (**Refresh quote** updates it).
3. Complete the provider's checkout inside the page, including where the payout should go.
4. Sign the vault transfer proposal with your connected owner wallet.
5. The other owners approve it on the payment page. Once it executes, the funds reach the provider and the provider pays out.

**Cancel sale** stops a sale before the vault transfer is proposed.

!!! warning "Approve before the quote expires"
    A provider's quote lasts a limited time: about an hour for Transak, and about 10 minutes from confirmation for MoneyGram. The owners must approve the vault transfer within that window. Once it passes, the sale can't complete; start a new one. On vaults that need several approvals, line up the other owners before you start a MoneyGram cash-out.

On development, Transak shows *Transak staging is enabled; payouts are simulated.* and MoneyGram shows *MoneyGram sandbox is enabled; the cash-out uses testnet USDC.*

If a sale fails after the funds have left the vault, contact Volta support with a link to the payment.
