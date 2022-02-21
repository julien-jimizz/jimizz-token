// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @custom:security-contact support-jmz@jimizz.com
abstract contract EmergencyDrainable is Ownable {
  /**
   * @notice Allows to recover ERC20 funds
   */
  function drainERC20(address erc20Address)
    external
  {
    IERC20 erc20 = IERC20(erc20Address);
    uint256 balance = erc20.balanceOf(address(this));
    require(
      balance > 0,
      "No token to drain"
    );
    erc20.transfer(owner(), balance);
  }

  /**
   * @notice Allows to recover native funds
   */
  function drain()
    external
  {
    uint256 balance = address(this).balance;
    require(
      balance > 0,
      "No native coin to drain"
    );

    (bool sent, ) = owner().call{value: balance}('');
    require(
      sent,
      "Unable to drain native coins"
    );
  }
}
