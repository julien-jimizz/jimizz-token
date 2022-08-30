// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "../IJimizzFeeReceiver.sol";

contract JimizzFeeReceiverMock is IJimizzFeeReceiver {
  function onJimizzFeeReceived(uint)
    external
    pure
  { }
}
