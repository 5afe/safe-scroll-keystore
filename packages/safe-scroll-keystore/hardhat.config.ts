import { HardhatUserConfig, vars } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-ignition-ethers';
import 'solidity-coverage';
import fs from "fs";
import path from "path";

const artifactsPath = path.join(__dirname, "artifacts");

if (fs.existsSync(artifactsPath)) {
  require("./tasks/deploy_safe");
  require("./tasks/deploy_singletons");
  require("./tasks/send_eth");
}

const SOLIDITY_VERSION = '0.8.24';
const COINMARKETCAP_APIKEY = vars.get('COINMARKETCAP_APIKEY', "");
const INFURA_API_KEY = vars.get('INFURA_API_KEY', "");
const SEPOLIA_PRIVATE_KEY = vars.get('SEPOLIA_PRIVATE_KEY', "0x" + '0'.repeat(64));
const REPORT_GAS = vars.get('REPORT_GAS', "");

const config: HardhatUserConfig = {
  solidity: {
    version: SOLIDITY_VERSION,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    },
  },
  networks: {
    localhost: {
      // Chain ID: 31337
      url: 'http://127.0.0.1:8545',
      accounts: [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ],
    },
    scroll_devnet: {
      // Chain ID: 2227728
      url: 'https://l1sload-rpc.scroll.io',
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
  },
  gasReporter: {
    enabled: Boolean(REPORT_GAS),
    currency: 'USD',
    coinmarketcap: COINMARKETCAP_APIKEY,
    excludeContracts: ['TestToken'],
  },
};

export default config;