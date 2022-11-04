/**
 * Raffle
 *
 * Functions:
 *  - User pays a fixed fee to enter the lottery.
 *  - Raffle selects a random number (Chainlink - VRF / Chainlink Oracle) that corresponds to a random winner.
 *  - Winner to be selected every X minutes -> (Completely automated)
 *
 * Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers, triggers selecting a winner every arbitary period)
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);
error Raffle__NotEnoughETHEnterred();
error Raffle__TransferFailed();
error Raffle__RaffleNotOpen();

contract Raffle is VRFConsumerBaseV2, AutomationCompatible {
    // Types
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    // State Variables
    address payable[] private s_players;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    uint256 private immutable i_entranceFee;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private immutable i_timeInterval;
    address payable private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastRaffleTimestamp;

    // Events
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address _vrfCoordinator,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 timeInterval
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        i_entranceFee = entranceFee;
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        i_timeInterval = timeInterval;
        s_lastRaffleTimestamp = block.timestamp;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEnterred();
        }

        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__RaffleNotOpen();
        }
        s_players.push(payable(msg.sender)); //msg.sender is of type address not payable address hence we must typecast.
        // We want to Emit an event when we update a dynamic array or mapping.
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev we want to ensure the following conditions are met for checkUpKeep to return true:
     * @dev 1) RaffleState is OPEN
     * @dev 2) There is atleast 1 player in the Raffle.
     * @dev 3) The time difference between the last raffle and picking the winner is greater than a certain time interval.
     * @dev 4) The contract has non-zero ETH balance.
     */
    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /*performData*/
        )
    {
        bool isRaffleOpen = RaffleState.OPEN == s_raffleState;
        bool hasAtleastOnePlayer = s_players.length > 0;
        bool isTimeIntervalMet = block.timestamp - s_lastRaffleTimestamp > i_timeInterval;
        bool isBalanceNonZero = address(this).balance > 0;
        upkeepNeeded = isRaffleOpen && hasAtleastOnePlayer && isTimeIntervalMet && isBalanceNonZero;
    }

    function performUpkeep(
        bytes calldata /*performData*/
    ) external override {
        s_raffleState = RaffleState.CALCULATING;
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // gasLane specifies the maximum ETH we will pay for a request in WEI.
            i_subscriptionId, // subscription ID from the subscription on Chainlink.
            3,
            i_callbackGasLimit, // limit for how much gas to use for the callback request to your contract's fulfillRandomWords() function.
            // if fufillRandomWords is extremely gas inefficient callbackGasLimit can protect us.
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // can remove parameter name if not needed, however parameter type is still required.
    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        uint256 winnerIndex = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[winnerIndex];
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        s_recentWinner = recentWinner;
        emit WinnerPicked(recentWinner);
        s_lastRaffleTimestamp = block.timestamp;
        s_players = new address payable[](0); // reset the players array to be of size 0.
        s_raffleState = RaffleState.OPEN;
    }

    /* View / Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    // ToDo: Ensure this has private access modifier.
    function getPlayer(uint256 index) public view returns (address payable) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address payable) {
        return s_recentWinner;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getTimestampOfLastWinning() public view returns (uint256) {
        return s_lastRaffleTimestamp;
    }

    function getNumberOfConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getNumberOfWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getTimeInterval() public view returns (uint256) {
        return i_timeInterval;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getGasLane() public view returns (bytes32) {
        return i_gasLane;
    }
}
