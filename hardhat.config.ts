import * as dotenv from "dotenv"

import { HardhatUserConfig, task } from "hardhat/config"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "@typechain/hardhat"
import "hardhat-gas-reporter"
import "solidity-coverage"

dotenv.config()

const { ETH_MAINNET_PK, INFURA_API_KEY, ETHERSCAN_API_KEY, ALCHEMY_API_KEY, POKT_PORTAL_ID } = process.env

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      forking: {
        //url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
        url: `https://eth-mainnet.gateway.pokt.network/v1/lb/${POKT_PORTAL_ID}`,
      }
    },
    main: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [`0x${ETH_MAINNET_PK}`]
    },
    localhost: {
      url: `http://127.0.0.1:8545`,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: `${ETHERSCAN_API_KEY}`,
  },
}

export default config
