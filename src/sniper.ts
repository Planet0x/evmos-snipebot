import {
  ChainId,
  ETH,
  TradeDirection,
  UniswapPair,
  UniswapPairSettings,
  UniswapVersion
} from "simple-uniswap-sdk"; // Simple Uniswap Trades
import { logger } from "./utils/logging"; // Logging
import { ABI_UniswapV2Factory, ABI_UniswapV3Factory } from "./utils/constants"; // ABIs
import { BigNumber, Contract, providers, utils, Wallet } from "ethers"; // Ethers

export default class Sniper {
  // Ethers provider
  rpc: providers.JsonRpcProvider;
  // Sniping wallet
  wallet: Wallet;

  // Token to watch
  tokenAddress: string;
  // Factory contract
  factoryV2: Contract;
  factoryV3: Contract;

  // Amount of base token (ETH/Matic) to spend
  purchaseAmount: string;
  // Maximum gas price to pay for tx inclusion
  gasPrice: BigNumber;
  // Max trade slippage
  slippage: number;
  // Running against testnet
  testnet: boolean;

  /**
   * Updates token and purchase details + sets up RPC
   * @param {string} tokenAddress of token to purchase
   * @param {string} factoryAddress of Uniswap V2 Factory
   * @param {string} rpcEndpoint for network
   * @param {string} privateKey of purchasing wallet
   * @param {string} purchaseAmount to swap with (input)
   * @param {string} gasPrice to pay
   * @param {number} slippage for trade execution
   * @param {boolean} testnet true if testnet
   */
  constructor(
    tokenAddress: string,
    factoryAddressV2: string,
    rpcEndpoint: string,
    privateKey: string,
    purchaseAmount: string,
    gasPrice: string,
    slippage: number,
    testnet: boolean,
    factoryAddressV3: string
  ) {
    // Setup networking + wallet
    this.rpc = new providers.JsonRpcProvider(rpcEndpoint);
    this.wallet = new Wallet(privateKey, this.rpc);

    // Setup token details
    this.tokenAddress = utils.getAddress(tokenAddress); // Normalize address
    this.factoryV2 = new Contract(
      factoryAddressV2,
      ABI_UniswapV2Factory,
      this.rpc
    );
    this.factoryV3 = new Contract(
      factoryAddressV3,
      ABI_UniswapV3Factory,
      this.rpc
    );
    this.purchaseAmount = purchaseAmount;
    this.gasPrice = utils.parseUnits(gasPrice, "gwei");
    this.slippage = slippage;
    this.testnet = testnet;
  }

  /**
   * Generates and submits purchase transaction for desired token w/ base pair
   * @param {string} token0 address of token0 in pair
   * @param {string} token1 address of token1 in pair
   */
  async submitPurchaseTx(token0: string, token1: string): Promise<void> {
    // Setup token address
    const desiredIsFirst: boolean = token0 === this.tokenAddress;
    const desiredTokenAddress: string = desiredIsFirst ? token0 : token1;

    const pair = new UniswapPair({
      // the contract address of the token you want to convert FROM
      fromTokenContractAddress: ETH.MAINNET().contractAddress,
      // the contract address of the token you want to convert TO
      toTokenContractAddress: desiredTokenAddress,
      // the ethereum address of the user using this part of the dApp
      ethereumAddress: this.wallet.address,
      ethereumProvider: this.rpc,

      chainId: ChainId.MAINNET,
      settings: new UniswapPairSettings({
        // if not supplied it will use `0.005` which is 0.5%
        // please pass it in as a full number decimal so 0.7%
        // would be 0.007
        slippage: 0.005,
        // if not supplied it will use 20 a deadline minutes
        deadlineMinutes: 20,
        // if not supplied it will try to use multihops
        // if this is true it will require swaps to direct
        // pairs
        disableMultihops: false,
        // for example if you only wanted to turn on quotes for v3 and not v3
        // you can only support the v3 enum same works if you only want v2 quotes
        // if you do not supply anything it query both v2 and v3
        uniswapVersions: [UniswapVersion.v2, UniswapVersion.v3]
      })
    });

    // Create pair factory
    const uniswapPairFactory = await pair.createFactory();
    // Generate trade
    const trade = await uniswapPairFactory.trade(
      this.purchaseAmount,
      TradeDirection.input
    );

    // Update trade gas price
    let tx: any = trade.transaction;
    tx.gasPrice = this.gasPrice;

    // Send and log trade
    const tradeTx = await this.wallet.sendTransaction(tx);
    logger.info(`Transaction sent: ${tradeTx.hash}`);
  }

  /**
   * Listen for pool creation and submit purchase tx
   */
  async snipeV2(): Promise<void> {
    logger.info("Beginning to monitor Uniswap Factory");

    // Listen for pair creation
    this.factoryV2.on("PairCreated", async (token0: string, token1: string) => {
      // Log new created pairs
      logger.info(`New pair: ${token0}, ${token1}`);

      // If new pair contains desired token
      if ([token0, token1].includes(this.tokenAddress)) {
        // Submit purchase transaction
        logger.info("Desired token found in pair.");
        await this.submitPurchaseTx(token0, token1);

        // Exit process after submitting tx (no PGA)
        process.exit(0);
      }
    });
  }

  async snipeV3(): Promise<void> {
    logger.info("Beginning to monitor Uniswap Factory");

    // Listen for pair creation
    this.factoryV3.on("PairCreated", async (token0: string, token1: string) => {
      // Log new created pairs
      logger.info(`New pair: ${token0}, ${token1}`);

      // If new pair contains desired token
      if ([token0, token1].includes(this.tokenAddress)) {
        // Submit purchase transaction
        logger.info("Desired token found in pair.");
        await this.submitPurchaseTx(token0, token1);

        // Exit process after submitting tx (no PGA)
        process.exit(0);
      }
    });
  }
}
