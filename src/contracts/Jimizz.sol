// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EmergencyDrainable.sol";

/// @custom:security-contact support-jmz@jimizz.com
contract Jimizz is ERC20, Ownable, EmergencyDrainable {
  constructor() ERC20("Jimizz", "JMZ") {
    _mint(msg.sender, 8000000000 * 10 ** decimals());
  }

  function burn(uint256 amount)
    public
    onlyOwner
  {
    _burn(_msgSender(), amount);
  }
}
