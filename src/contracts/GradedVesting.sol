// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Jimizz.sol";
import "./EmergencyDrainable.sol";

contract GradedVesting is Context, ReentrancyGuard, EmergencyDrainable {
  using SafeMath for uint256;


  // ==== Events ==== //

  /**
   * @notice Event emitted when beneficiary collects
   */
  event Collected(uint256 amount, uint256 timestamp);


  // ==== Modifiers ==== //

  /**
   * @dev Throws if called by any account other than the beneficiary
   */
  modifier onlyBeneficiary() {
    require(
      beneficiary == _msgSender(),
      "Caller is not the beneficiary"
    );
    _;
  }


  // ==== Structs ==== //

  /**
   * @notice
   * This struct is used to represent a schedule
   * It contains the total percentage of total amount released at a given date (timestamp)
   */
  struct Schedule {
    uint64 timestamp;
    uint8 percentage;
  }


  // ==== State ==== //

  /**
   * @notice Jimizz BEP20
   */
  Jimizz private immutable jimizz;

  /**
   * @notice Beneficiary address
   */
  address private immutable beneficiary;

  /**
   * @notice Number of schedules in the schedules map
   */
  uint private scheduleCount;

  /**
   * @notice Schedules map
   */
  mapping(uint => Schedule) private schedules;

  /**
   * @notice Initial balance of JMZ
   */
  uint256 public initialBalance;

  /**
   * @notice Total of withdrawn amount
   */
  uint256 public withdrawnAmount;


  // ==== Constructor ==== //

  /**
   * @dev constructor
   * @param _jimizz The address of Jimizz BEP20
   * @param _beneficiary The address of the beneficiary
   * @param _timestamps Array containing all release dates
   * @param _percentages Array containing all release percentages
   */
  constructor(
    address _jimizz,
    address _beneficiary,
    uint256 _amount,
    uint64[] memory _timestamps,
    uint8[] memory _percentages
  ) {
    require(
      _jimizz != address(0),
      "Jimizz address is not valid"
    );
    jimizz = Jimizz(_jimizz);

    require(
      _beneficiary != address(0),
      "Beneficiary address is not valid"
    );
    beneficiary = _beneficiary;

    require(
      _amount > 0,
      "Amount should be greater than 0"
    );
    initialBalance = _amount;

    require(
      _timestamps.length == _percentages.length,
      "Invalid input parameters"
    );

    // Build schedules
    scheduleCount = 0;
    for (uint i = 0; i < _timestamps.length; i++) {
      if (i > 0) {
        require(
          _timestamps[i] > _timestamps[i - 1] &&
            _percentages[i] > _percentages[i - 1],
          "Schedules are not ordered properly"
        );
      }

      schedules[i] = Schedule(_timestamps[i], _percentages[i]);
      scheduleCount++;
    }
  }


  // ==== Public methods ==== //

  /**
   * @notice This method is used to collect released tokens
   * @dev Only the beneficiary can call this method
   */
  function collect()
    external
    onlyBeneficiary
    nonReentrant
  {
    // Retrieve balance
    uint256 balance = jimizz.balanceOf(address(this));
    require(
      balance > 0,
      "This contract does not have any token"
    );

    // Get amount to release
    uint256 availableAmount = getAvailableAmount();
    require(
      availableAmount > 0,
      "Nothing to collect"
    );

    // Update withdrawn amount
    withdrawnAmount = withdrawnAmount.add(availableAmount);

    // Send JMZ
    jimizz.transfer(beneficiary, availableAmount);

    // Emit event
    emit Collected(availableAmount, block.timestamp);
  }


  // ==== Views ==== //

  /**
   * @notice This method calculates the available amount to collect
   */
  function getAvailableAmount()
    public
    view
    returns (uint256 availableAmount)
  {
    // Retrieve current percentage
    uint8 percentage;
    for (uint i = 0; i < scheduleCount; i++) {
      if (block.timestamp >= schedules[i].timestamp) {
        percentage = schedules[i].percentage;
      }
    }

    // Retrieve available amount to withdraw
    availableAmount = jimizz.balanceOf(address(this));
    if (percentage < 100) {
      availableAmount = initialBalance.mul(percentage).div(100);

      // Subtract the already withdrawn amount
      availableAmount = availableAmount.sub(withdrawnAmount);
    }
  }

  /**
   * @notice This method returns an array of the schedules
   */
  function getSchedules()
    external
    view
    returns (Schedule[] memory)
  {
    // Build and return array of schedules
    Schedule[] memory _schedules = new Schedule[](scheduleCount);
    for (uint i = 0; i < scheduleCount; i++) {
      Schedule storage schedule = schedules[i];
      _schedules[i] = schedule;
    }

    return _schedules;
  }
}
