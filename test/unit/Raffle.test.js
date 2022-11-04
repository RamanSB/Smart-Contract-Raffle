const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers, getChainId, getUnnamedAccounts } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Test", function () {
          // My tests will require
          let raffleContract;
          let mockVrfCoordinatorV2Contract;
          let players;

          beforeEach(async function () {
              const { deployer } = await getNamedAccounts();
              await deployments.fixture(["all"]);
              raffleContract = await ethers.getContract("Raffle", deployer);
              mockVrfCoordinatorV2Contract = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
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
              const ineligibleFeeAmount = ethers.utils.parseEther("0.005");
              const eligibleFeeAmount = ethers.utils.parseEther("0.3");

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

              describe("raffleClosed", function () {});
          });
      });
