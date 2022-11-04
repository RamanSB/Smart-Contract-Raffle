const { run } = require("hardhat");

/**
 * This function is used to verify a contract ensuring it's authenticity by the developer.
 *
 * @param {Contract Address to verify} contractAddress
 * @param {Constructor Arguments} args
 */
const verify = async (contractAddress, args) => {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log(`Contract w/Addy: ${address} is already verified.`);
        } else {
            console.log(e);
        }
    }
};

module.exports = { verify };
