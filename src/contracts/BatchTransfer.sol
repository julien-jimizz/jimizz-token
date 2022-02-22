// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Jimizz.sol";

contract BatchTransfer is Ownable, ReentrancyGuard {
  using SafeMath for uint256;

  Jimizz private immutable token;

  constructor(address _token) {
    require(_token != address(0));
    token = Jimizz(_token);
  }

  function batchTransfer(
    address[] calldata _recipients,
    uint256[] calldata _amounts
  )
    external
    onlyOwner
    nonReentrant
  {
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
      }
    }
  }

  function drain()
    external
  {
    uint256 balance = token.balanceOf(address(this));
    require(
      balance > 0,
      "No token to drain"
    );
    token.transfer(owner(), balance);
  }
}
