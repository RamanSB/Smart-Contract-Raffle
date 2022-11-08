const { inputToConfig } = require("@ethereum-waffle/compiler");
const { assert, expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");

const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Test", function () {
          let raffle, raffleEntranceFee, deploy;

          beforeEach(async function () {
              console.log("Running before each...");
              deployer = await getNamedAccounts().deployer;
              raffle = await ethers.getContract("Raffle");
              raffleEntranceFee = await raffle.getEntranceFee();
              console.log(`Raffle entrance fee: ${raffleEntranceFee}`);
          });

          describe("fulfillRandomWords", function () {
              it("Works with live Chainlink Automation & Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  const startingTimestamp = await raffle.getTimestampOfLastWinning();
                  const accounts = await ethers.getSigners();

                  console.log(`Accounts: ${JSON.stringify(accounts)}`);

                  await new Promise(async (resolve, reject) => {
                      // Set up the listener before we enter the raffle.
                      raffle.once("WinnerPicked", async () => {
                          try {
                              console.log(`WinnerPicked event fired!`);
                              // assertions here
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnersBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffle.getTimestampOfLastWinning();

                              console.log(`RecentWinner: ${recentWinner}`);
                              console.log(`RaffleState: ${raffleState}`);
                              console.log(`Winners Ending Balance: ${winnersBalance}`);
                              console.log(`RecentWinner: ${recentWinner}`);

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState.toString(), "0");
                              console.log(`Balance: ${winnersBalance.toString()}`);
                              console.log(`Balance: ${winnerStartingBalance.add(raffleEntranceFee).toString()}`);
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
                      console.log("Enterring Raffle...");
                      let txnResponse = await raffle.enterRaffle({ value: raffleEntranceFee });
                      console.log("Waiting for 1 block confirmation.");
                      const txReceipt = await txnResponse.wait(1);
                      console.log(`Txn Receipt: ${txReceipt}`);
                      const winnerStartingBalance = await accounts[0].getBalance();
                      console.log(`Winners starting balance: ${winnerStartingBalance.toString()}`);
                  });
              });
          });
      });
