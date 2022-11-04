const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

async function deploy(hre) {
    const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30");

    const { getNamedAccounts, getUnnamedAccounts, getChainId, deployments } = hre;
    const { deploy, log } = deployments;
    log("Starting deployment of Raffle...");
    const { deployer } = await getNamedAccounts();
    let chainId = await getChainId();

    let vrfCoordinatorV2Address, subscriptionId;

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const txnResponse = await vrfCoordinatorV2Mock.createSubscription();
        const txnReceipt = await txnResponse.wait(1);
        subscriptionId = txnReceipt.events[0].args.subId;
        // Must fund the subscription with LINK token
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    log("Subscription ID & VRF Coordinator Patterned...");

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const timeInterval = networkConfig[chainId]["interval"];
    const args = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, timeInterval];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        waitConfirmations: network.config.blockConfirmations || 1,
        log: true,
    });

    if (developmentChains.includes(network.name)) {
        // This ensures our raffle contract can consume from the vrfCoordinator
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...");
        await verify(raffle.address, args);
    }
    log("-------------------------------------------------------");
}

module.exports = deploy;
module.exports.tags = ["all", "Raffle"];
