const { getNamedAccounts, getUnnamedAccounts, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 LINK premium per request.
const GAS_PRICE_LINK = 1e9; // calculated value based on the gas price of the chain. Reminds me of GAS LANE

async function deploy(hre) {
    const { getNamedAccounts, getUnnamedAccounts, getChainId, deployments } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainName = network.name;
    // we only want to deploy mocks if we are on a development chain.
    if (developmentChains.includes(chainName)) {
        log("Local network detected! Deploying mocks...");
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
            // waitConfirmations:
        });
        log("VRFCoordinatorV2Mock deployed....");
        log("----------------------------------------------------------------");
    }
}

module.exports = deploy;
module.exports.tags = ["all", "mock"];
