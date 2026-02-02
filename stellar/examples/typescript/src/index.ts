/**
 * Volta Soroban Smart Contract Client
 *
 * Minimal example demonstrating how to interact with the Volta multi-signature
 * governance contract on Soroban. Based on patterns from web-circuit.
 *
 * WASM Hash: 557c34220a7ecc4a7abf9e1762adefb69adda14e31a34f27b6c0d4edb10ef64c
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  Networks,
  Operation,
  rpc,
  scValToNative,
  StrKey,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    rpcUrl: "https://soroban.stellar.org",
    networkPassphrase: Networks.PUBLIC,
  },
};

// Mainnet WASM hash for the Volta contract
const WASM_HASH =
  "557c34220a7ecc4a7abf9e1762adefb69adda14e31a34f27b6c0d4edb10ef64c";

// Dummy account for read-only simulations (no real account needed)
const DUMMY_ACCOUNT = new Account(
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "0"
);

// =============================================================================
// Types
// =============================================================================

export enum VoteType {
  Abstain = 0,
  Yes = 1,
  No = 2,
}

export enum ProposalStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Executed = 3,
  Revoked = 4,
}

export interface Config {
  owners: string[];
  threshold: number;
}

export interface Proposal {
  id: bigint;
  caller: string;
  proposal_type: ProposalType;
  status: ProposalStatus;
  votes: Record<string, VoteType>;
}

export type ProposalType =
  | { Config: Config }
  | { Invoke: { address: string; fn_name: string; args: unknown[] } }
  | { Upgrade: string };

// Contract error codes with human-readable messages
const CONTRACT_ERRORS: Record<number, string> = {
  1: "Contract has already been initialized",
  2: "Contract has not been initialized",
  5: "Invalid owner configuration (need at least 2 unique owners)",
  6: "Invalid threshold (must be between 2 and owner count)",
  8: "You are not an owner of this contract",
  9: "Proposal not found or expired",
  10: "You have already voted on this proposal",
  11: "Proposal is no longer pending",
  12: "Contract invocation failed",
  14: "No changes in proposed configuration",
  15: "Only the proposal creator can perform this action",
  19: "Use invoke() for contract calls, not propose()",
  22: "Invalid upgrade hash",
  23: "Target address is not a contract",
  24: "Function name cannot be empty",
};

// =============================================================================
// Volta Client
// =============================================================================

export class VoltaClient {
  private server: rpc.Server;
  private contract: Contract;
  private networkPassphrase: string;
  public contractAddress: string;

  constructor(
    contractAddress: string,
    network: "testnet" | "mainnet" = "testnet"
  ) {
    const config = CONFIG[network];
    this.server = new rpc.Server(config.rpcUrl);
    this.contract = new Contract(contractAddress);
    this.networkPassphrase = config.networkPassphrase;
    this.contractAddress = contractAddress;
  }

  // ---------------------------------------------------------------------------
  // Read-only methods (no signing required)
  // ---------------------------------------------------------------------------

  /**
   * Simulate a read-only contract call using a dummy account
   */
  private async simulateReadOnly(
    method: string,
    args: xdr.ScVal[] = []
  ): Promise<xdr.ScVal> {
    const operation = this.contract.call(method, ...args);

    const tx = new TransactionBuilder(DUMMY_ACCOUNT, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simulation = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(this.parseSimulationError(simulation));
    }

    if (!simulation.result) {
      throw new Error("No result from simulation");
    }

    return simulation.result.retval;
  }

  /** Get the contract version */
  async version(): Promise<number> {
    const result = await this.simulateReadOnly("version");
    return scValToNative(result) as number;
  }

  /** Get the current contract configuration */
  async getConfig(): Promise<Config> {
    const result = await this.simulateReadOnly("get_config");
    return scValToNative(result) as Config;
  }

  /** Get a proposal by ID */
  async getProposal(proposalId: bigint): Promise<Proposal> {
    const result = await this.simulateReadOnly("get_proposal", [
      nativeToScVal(proposalId, { type: "u64" }),
    ]);
    return scValToNative(result) as Proposal;
  }

  // ---------------------------------------------------------------------------
  // Write methods (require signing)
  // ---------------------------------------------------------------------------

  /**
   * Build, simulate, and submit a transaction
   * Returns the transaction result after confirmation
   */
  private async submitTransaction(
    keypair: Keypair,
    operation: xdr.Operation
  ): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
    const account = await this.server.getAccount(keypair.publicKey());

    // Build transaction with 2x base fee for reliability
    let tx = new TransactionBuilder(account, {
      fee: (parseInt(BASE_FEE) * 2).toString(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate to get resource requirements
    const simulation = await this.server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(this.parseSimulationError(simulation));
    }

    // Assemble with simulation results (adds auth, resource fees, etc.)
    tx = rpc.assembleTransaction(tx, simulation).build();
    tx.sign(keypair);

    // Submit and wait for confirmation
    const response = await this.server.sendTransaction(tx);

    if (response.status === "ERROR") {
      throw new Error(`Transaction submission failed: ${response.errorResult}`);
    }

    // Poll for completion
    let result = await this.server.getTransaction(response.hash);
    while (result.status === "NOT_FOUND") {
      await new Promise((r) => setTimeout(r, 1000));
      result = await this.server.getTransaction(response.hash);
    }

    if (result.status === "FAILED") {
      throw new Error("Transaction execution failed");
    }

    return result as rpc.Api.GetSuccessfulTransactionResponse;
  }

  /** Vote on a proposal */
  async vote(
    keypair: Keypair,
    proposalId: bigint,
    vote: VoteType
  ): Promise<Proposal> {
    const operation = this.contract.call(
      "vote",
      new Address(keypair.publicKey()).toScVal(),
      nativeToScVal(proposalId, { type: "u64" }),
      nativeToScVal(vote, { type: "u32" })
    );

    const result = await this.submitTransaction(keypair, operation);
    return scValToNative(result.returnValue!) as Proposal;
  }

  /** Create a config proposal to change owners and/or threshold */
  async proposeConfig(
    keypair: Keypair,
    newOwners: string[],
    newThreshold: number
  ): Promise<Proposal> {
    // Build ConfigInput struct: { owners: Vec<Address>, threshold: u32 }
    const configInput = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("owners"),
        val: xdr.ScVal.scvVec(
          newOwners.map((addr) => new Address(addr).toScVal())
        ),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("threshold"),
        val: nativeToScVal(newThreshold, { type: "u32" }),
      }),
    ]);

    // Build ProposalInput enum as Vec: [Symbol("Config"), data]
    const proposalInput = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Config"),
      configInput,
    ]);

    const operation = this.contract.call(
      "propose",
      new Address(keypair.publicKey()).toScVal(),
      proposalInput
    );

    const result = await this.submitTransaction(keypair, operation);
    return scValToNative(result.returnValue!) as Proposal;
  }

  /** Create an upgrade proposal */
  async proposeUpgrade(keypair: Keypair, wasmHash: string): Promise<Proposal> {
    const proposalInput = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Upgrade"),
      xdr.ScVal.scvBytes(Buffer.from(wasmHash, "hex")),
    ]);

    const operation = this.contract.call(
      "propose",
      new Address(keypair.publicKey()).toScVal(),
      proposalInput
    );

    const result = await this.submitTransaction(keypair, operation);
    return scValToNative(result.returnValue!) as Proposal;
  }

  /**
   * Create an invoke proposal to call another contract
   *
   * Note: The caller's vote is automatically counted as Yes, so only
   * (threshold - 1) additional votes are needed for execution.
   *
   * @param keypair - The owner creating the invoke proposal
   * @param targetContract - Contract address to call
   * @param functionName - Function to invoke on target contract
   * @param args - Arguments for the function call
   * @param authEntries - Authorization entries for sub-contract calls (if needed)
   */
  async invoke(
    keypair: Keypair,
    targetContract: string,
    functionName: string,
    args: xdr.ScVal[] = [],
    authEntries: xdr.ScVal[] = []
  ): Promise<void> {
    const operation = this.contract.call(
      "invoke",
      new Address(keypair.publicKey()).toScVal(),
      new Address(targetContract).toScVal(),
      xdr.ScVal.scvSymbol(functionName),
      xdr.ScVal.scvVec(args),
      xdr.ScVal.scvVec(authEntries)
    );

    await this.submitTransaction(keypair, operation);
  }

  /** Revoke a pending proposal (only the creator can revoke) */
  async revokeProposal(keypair: Keypair, proposalId: bigint): Promise<void> {
    const operation = this.contract.call(
      "revoke_proposal",
      new Address(keypair.publicKey()).toScVal(),
      nativeToScVal(proposalId, { type: "u64" })
    );

    await this.submitTransaction(keypair, operation);
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  private parseSimulationError(
    simulation: rpc.Api.SimulateTransactionErrorResponse
  ): string {
    const errorStr = simulation.error;

    // Try to extract contract error code
    const match = errorStr.match(/Error\(Contract, #(\d+)\)/);
    if (match) {
      const code = parseInt(match[1]);
      return CONTRACT_ERRORS[code] || `Contract error #${code}`;
    }

    return `Simulation failed: ${errorStr}`;
  }
}

// =============================================================================
// Deployment Helper
// =============================================================================

/**
 * Deploy a new Volta contract with initial configuration
 */
export async function deployVoltaContract(
  deployer: Keypair,
  owners: string[],
  threshold: number,
  network: "testnet" | "mainnet" = "testnet",
  wasmHash: string = WASM_HASH
): Promise<string> {
  const config = CONFIG[network];
  const server = new rpc.Server(config.rpcUrl);
  const account = await server.getAccount(deployer.publicKey());

  // Create unique contract ID from deployer + random salt
  const salt = Buffer.from(Keypair.random().rawPublicKey());
  const contractIdPreimage =
    xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new xdr.ContractIdPreimageFromAddress({
        address: new Address(deployer.publicKey()).toScAddress(),
        salt,
      })
    );

  // Build constructor arg: ConfigInput struct
  const configInput = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("owners"),
      val: xdr.ScVal.scvVec(owners.map((addr) => new Address(addr).toScVal())),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("threshold"),
      val: nativeToScVal(threshold, { type: "u32" }),
    }),
  ]);

  const createContractArgs = new xdr.CreateContractArgsV2({
    contractIdPreimage,
    executable: xdr.ContractExecutable.contractExecutableWasm(
      Buffer.from(wasmHash, "hex")
    ),
    constructorArgs: [configInput],
  });

  const op = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeCreateContractV2(createContractArgs),
    auth: [],
  });

  let tx = new TransactionBuilder(account, {
    fee: (parseInt(BASE_FEE) * 2).toString(),
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(300)
    .build();

  // Simulate and assemble
  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(
      `Deployment simulation failed: ${
        (simulation as rpc.Api.SimulateTransactionErrorResponse).error
      }`
    );
  }

  tx = rpc.assembleTransaction(tx, simulation).build();
  tx.sign(deployer);

  // Submit and wait
  const response = await server.sendTransaction(tx);
  if (response.status === "ERROR") {
    throw new Error(`Deployment failed: ${response.errorResult}`);
  }

  let result = await server.getTransaction(response.hash);
  while (result.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    result = await server.getTransaction(response.hash);
  }

  if (result.status === "FAILED") {
    throw new Error("Deployment transaction failed");
  }

  // Extract contract address from result
  const successResult = result as rpc.Api.GetSuccessfulTransactionResponse;
  const contractId = successResult.returnValue!.address().contractId();
  return StrKey.encodeContract(contractId as unknown as Buffer);
}

// =============================================================================
// Testnet Utilities
// =============================================================================

/** Fund an account using Stellar testnet friendbot */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const response = await fetch(
    `${CONFIG.testnet.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
  );
  if (!response.ok) {
    const text = await response.text();
    if (!text.includes("createAccountAlreadyExist")) {
      throw new Error(`Friendbot funding failed: ${text}`);
    }
  }
}

// =============================================================================
// Example Usage
// =============================================================================

async function main() {
  console.log("Volta Soroban Contract - Testnet Demo\n");

  // 1. Generate owner keypairs
  const owner1 = Keypair.random();
  const owner2 = Keypair.random();
  console.log("Generated owners:");
  console.log(`  Owner 1: ${owner1.publicKey()}`);
  console.log(`  Owner 2: ${owner2.publicKey()}\n`);

  // 2. Fund accounts
  console.log("Funding accounts via friendbot...");
  await fundTestnetAccount(owner1.publicKey());
  await fundTestnetAccount(owner2.publicKey());
  await new Promise((r) => setTimeout(r, 2000));
  console.log("  Done\n");

  // 3. Deploy contract
  console.log("Deploying contract...");
  const contractAddress = await deployVoltaContract(
    owner1,
    [owner1.publicKey(), owner2.publicKey()],
    2,
    "testnet"
  );
  console.log(`  Contract: ${contractAddress}\n`);

  // 4. Create client and interact
  const client = new VoltaClient(contractAddress, "testnet");

  // Read config (no signing needed)
  console.log("Reading contract state...");
  const version = await client.version();
  const config = await client.getConfig();
  console.log(`  Version: ${version}`);
  console.log(`  Owners: ${config.owners.length}`);
  console.log(`  Threshold: ${config.threshold}\n`);

  // 5. Create and vote on a proposal
  const owner3 = Keypair.random();
  console.log("Creating config proposal (add third owner)...");
  const proposal = await client.proposeConfig(
    owner1,
    [owner1.publicKey(), owner2.publicKey(), owner3.publicKey()],
    2
  );
  console.log(`  Proposal ID: ${proposal.id}`);
  console.log(`  Status: ${ProposalStatus[proposal.status]}\n`);

  console.log("Owner 2 voting YES...");
  const updated = await client.vote(owner2, proposal.id, VoteType.Yes);
  console.log(`  Status: ${ProposalStatus[updated.status]}\n`);

  // Verify execution
  if (updated.status === ProposalStatus.Executed) {
    const newConfig = await client.getConfig();
    console.log("Config updated!");
    console.log(`  New owner count: ${newConfig.owners.length}\n`);
  }

  console.log("Demo complete!");
  console.log(`Contract address: ${contractAddress}`);
}

main().catch(console.error);
