// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Jimizz.sol";

contract BatchTransfer is Ownable, ReentrancyGuard {
  using SafeERC20 for Jimizz;


  // ==== State ==== //
  /**
   * @notice Jimizz BEP20
   */
  Jimizz private immutable token;


  // ==== Events ==== //

  /**
   * @notice Event emitted every batch
   */
  event Batched(address recipient, uint256 amount);

  /**
   * @notice Event emitted when owner drain funds
   */
  event Drained(uint256 amount);


  // ==== Constructor ==== //

  /**
   * @dev constructor
   * @param _token The address of Jimizz BEP20
   */
  constructor(address _token) {
    require(
      _token != address(0),
      "Token address is not valid"
    );
    token = Jimizz(_token);
  }

  /**
   * @dev Batch transfer to given recipients with given amounts
   * @param _recipients The recipients
   * @param _amounts The amounts
   */
  function batchTransfer(
    address[] calldata _recipients,
    uint256[] calldata _amounts
  )
    external
    nonReentrant
  {
    // Check transfer
    uint total;
    for (uint i = 0; i < _amounts.length; i++) {
      total += _amounts[i];
    }
    require(
      token.transferFrom(_msgSender(), address(this), total),
      "Transfer failed"
    );

    // Check inputs
    uint256 l = _recipients.length;
    require(
      l > 0 && l <= 100,
      "Maximum 100 recipients"
    );
    require(
      l == _amounts.length,
      "Invalid input parameters"
    );

    l = uint8(l);
    for (uint8 i = 0; i < l; i++) {
      if (
        _recipients[i] != address(0) &&
        _amounts[i] > 0
      ) {
        require(
          token.transfer(_recipients[i], _amounts[i]),
          "Unable to transfer tokens"
        );

        emit Batched(_recipients[i], _amounts[i]);
      }
    }
  }


  // ==== Public methods ==== //

  /**
   * @notice Allows to recover funds
   */
  function drain()
    external
    onlyOwner
  {
    uint256 balance = token.balanceOf(address(this));
    require(
      balance > 0,
      "No token to drain"
    );
    token.safeTransfer(owner(), balance);

    emit Drained(balance);
  }
}
