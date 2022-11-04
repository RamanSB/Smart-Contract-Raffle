const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers, getChainId, getUnnamedAccounts } = require("hardhat");
const { assertHardhatInvariant } = require("hardhat/internal/core/errors");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Test", function () {
          // My tests will require
          let raffleContract;
          let mockVrfCoordinatorV2Contract;
          let players;
          let timeInterval;
          const ineligibleFeeAmount = ethers.utils.parseEther("0.005");
          const eligibleFeeAmount = ethers.utils.parseEther("0.3");

          beforeEach(async function () {
              const { deployer } = await getNamedAccounts();
              await deployments.fixture(["all"]);
              raffleContract = await ethers.getContract("Raffle", deployer);
              mockVrfCoordinatorV2Contract = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              timeInterval = await raffleContract.getTimeInterval();
              await raffleContract.connect(deployer);
          });

          describe("constructor", function () {
              it("Initializes the raffle correctly", async function () {
                  // Ideally we make 1 assertion per it().
                  const raffleState = await raffleContract.getRaffleState();
                  const interval = await raffleContract.getTimeInterval();
                  const gasLane = await raffleContract.getGasLane();
                  const noOfPlayers = await raffleContract.getNumberOfPlayers();
                  const recentWinner = await raffleContract.getRecentWinner();
                  const timestampOfLastWinner = await raffleContract.getTimestampOfLastWinning();

                  console.log(`Raffle State: ${raffleState}`);
                  console.log(`Time interval: ${interval}`);
                  console.log(`Gas Lane: ${gasLane}`);
                  console.log(`#Players: ${noOfPlayers}`);
                  console.log(`Recent Winner: ${recentWinner}`);
                  console.log(`Last winner time stamp upon construction: ${timestampOfLastWinner}`);

                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[await getChainId()]["interval"]);
                  assert.equal(gasLane, networkConfig[await getChainId()]["gasLane"]);
                  assert.equal(noOfPlayers.toString(), "0");
                  assert.equal(recentWinner, "0x".concat("0".repeat(40)));
              });
          });

          describe("enterRaffle", function () {
              console.log(players);
              describe("raffleOpen", function () {
                  it("revertIfFeeIsTooLow", async function () {
                      let players = await ethers.getSigners();
                      let player1 = players[0];
                      await expect(raffleContract.connect(player1).enterRaffle({ value: ineligibleFeeAmount })).to.be
                          .reverted;
                  });

                  it("playerJoinsRaffleAndEventEmitted_whenFeeIsMet", async function () {
                      let players = await ethers.getSigners();
                      let player2 = players[1];
                      await expect(raffleContract.connect(player2).enterRaffle({ value: eligibleFeeAmount }))
                          .to.emit(raffleContract, "RaffleEnter")
                          .withArgs(player2.address);

                      let noOfPlayers = await raffleContract.getNumberOfPlayers();
                      let firstPlayerInRaffle = await raffleContract.getPlayer(0);
                      assert.equal(noOfPlayers.toString(), "1");
                      assert.equal(player2.address, firstPlayerInRaffle.toString());
                  });
              });

              describe("raffleClosed", function () {
                  it("enteringRaffleReverts", async function () {
                      await raffleContract.enterRaffle({ value: eligibleFeeAmount }); // ensures at least one player & raffle has non-zzero balance
                      // the next 2 lines will ensure the time interval has elapsed.
                      await ethers.provider.send("evm_increaseTime", [timeInterval.toNumber() + 1]);
                      await ethers.provider.send("evm_mine", []); // must mine a block in order for the time adjustment above to be in effect.

                      // Now we will pretend to be a chainlink keeper and get checkUpKeep to return true.
                      await raffleContract.performUpkeep([]);
                      await expect(raffleContract.enterRaffle({ value: eligibleFeeAmount })).to.be.revertedWith(
                          "Raffle__RaffleNotOpen"
                      );
                  });
              });

              describe("checkUpKeep should return false", function () {
                  it("openRaffle, timeIntervalMet, noPlayerPresent", async function () {
                      await ethers.provider.send("evm_increaseTime", [timeInterval.toNumber() + 1]); // time interval met
                      await ethers.provider.send("evm_mine", []);
                      // this will create an actual txn - we want to avoid this
                      // let result = await raffleContract.checkUpkeep([]);
                      const { upkeepNeeded } = await raffleContract.callStatic.checkUpkeep([]);
                      console.log(`Result: ${JSON.stringify(upkeepNeeded)}`);
                      assert.isFalse(upkeepNeeded);
                  });

                  it("allConditionsMet except raffle is not open", async function () {
                      await raffleContract.enterRaffle({ value: eligibleFeeAmount });
                      await ethers.provider.send("evm_increaseTime", [timeInterval.toNumber() + 1]);
                      await ethers.provider.send("evm_mine", []);
                      await raffleContract.performUpkeep([]);
                      // raffle is now closed.
                      assert.equal((await raffleContract.getRaffleState()).toString(), "1");
                      await ethers.provider.send("evm_increaseTime", [timeInterval.toNumber() + 1]);
                      await ethers.provider.send("evm_mine", []);
                      const { upkeepNeeded } = await raffleContract.callStatic.checkUpkeep([]);
                      assert.isFalse(upkeepNeeded);
                  });
              });
          });

          describe("selectsAWinnerFromLottery", function () {
              it("selects a winner and sends fund", async function () {
                  let signers = await ethers.getSigners();
                  let players = [signers[0], signers[1], signers[2]]; // 3 players

                  for (let player of players) {
                      await raffleContract.connect(player).enterRaffle({ value: eligibleFeeAmount });
                  }

                  await raffleContract.connect(players[0]);
                  const raffleBalance = await ethers.provider.getBalance(raffleContract.address);
                  console.log(`Raffle Balance: ${raffleBalance.toString()}`);
                  assert.equal((await raffleContract.getNumberOfPlayers()).toString(), "3");
                  await ethers.provider.send("evm_increaseTime", [timeInterval.toNumber() + 100]);
                  await ethers.provider.send("evm_mine", []);

                  let txnResponse = await raffleContract.performUpkeep([]);
                  let txnReceipt = await txnResponse.wait(1);
                  let requestId = txnReceipt.events[1].args;
                  await ethers.provider.send("evm_mine", []);
                  // ToDo: Fix this. Should invoke this within a Promise based listener. See Patricks course
                  await mockVrfCoordinatorV2Contract.fulfillRandomWords(requestId.toString(), raffleContract.address);
                  let winner = await raffleContract.getRecentWinner();
                  let winningBalance = await ethers.provider.getBalance(winner);
                  console.log(`Winning Balance: ${winningBalance.toString()}`);

                  assert.equal(winningBalance.toString(), raffleBalance.toString());
              });
          });
      });
