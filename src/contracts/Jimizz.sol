// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EmergencyDrainable.sol";

/// @custom:security-contact support-jmz@jimizz.com
contract Jimizz is ERC20, ERC20Burnable, Ownable, EmergencyDrainable {
  constructor()
    ERC20("Jimizz", "JMZ")
    EmergencyDrainable(address(0x0))
  {
    _mint(msg.sender, 8000000000 * 10 ** decimals());
  }
}
