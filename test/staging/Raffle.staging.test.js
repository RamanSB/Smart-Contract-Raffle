const { inputToConfig } = require("@ethereum-waffle/compiler");
const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Test", function () {
          let raffle, raffleEntranceFee, deploy;

          beforeEach(async function () {
              deployer = await getNamedAccounts().deployer;
              raffle = await ethers.getContract("Raffle");
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              inputToConfig(
                  "Works with live Chainlink Automation & Chainlink VRF, we get a random winner",
                  async function () {
                      // enter the raffle
                      const startingTimestamp = await raffle.getLatestTimestamp();
                      const accounts = await ethers.getSigners();

                      await new Promise(async (resolve, reject) => {
                          // Set up the listener before we enter the raffle.
                          raffle.once("WinnerPicked", async () => {
                              try {
                                  console.log(`WinnerPicked event fired!`);
                                  // assertions here
                                  const recentWinner = await raffle.getRecentWinner();
                                  const raffleState = await raffle.getRaffleState();
                                  const winnersBalance = await accounts[0].getBalance();
                                  const endingTimeStamp = await raffle.getLatestTimestamp();

                                  await expect(raffle.getPlayer(0)).to.be.reverted;
                                  assert.equal(recentWinner.toString(), accounts[0].address);
                                  assert.equal(raffleState.toString(), "0");
                                  assert.equal(
                                      winnersBalance.toString(),
                                      winnerStartingBalance.add(raffleEntranceFee).toString()
                                  );
                                  assert(endingTimeStamp > startingTimestamp);
                                  resolve();
                              } catch (e) {
                                  console.log(e);
                                  reject();
                              }
                          });
                          // Enterring the Raffle
                          await raffle.enterRaffle({ value: raffleEntranceFee });
                          const winnerStartingBalance = await accounts[0].getBalance();
                      });
                  }
              );
          });
      });
