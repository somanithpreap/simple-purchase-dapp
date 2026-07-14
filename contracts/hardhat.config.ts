import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    // Used by the one-shot `contract-deploy` service in docker-compose.yml,
    // where the node lives in a separate container reachable by service name.
    docker: {
      type: "http",
      chainType: "l1",
      url: configVariable("HARDHAT_RPC_URL"),
    },
    // Real testnet -- unlike the local/docker networks above, there are no
    // auto-unlocked accounts, so a funded deployer key is required. Deployed
    // manually (`npm run deploy:sepolia`), not via a docker-compose service.
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_DEPLOYER_PRIVATE_KEY")],
    },
  },
});
