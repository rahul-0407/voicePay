// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PaymentLedger is Ownable, ReentrancyGuard {

    IERC20 public immutable usdc;

    mapping(bytes32 => address) public phoneHashToWallet;



    event UserRegistered(bytes32 indexed phoneHash, address wallet);
    

    constructor(address _usdc) Ownable(msg.sender){
        usdc = IERC20(_usdc);
    }

    function registerUser(bytes32 phoneHash, address wallet) external onlyOwner{
        phoneHashToWallet[phoneHash] = wallet;
        emit UserRegistered(phoneHash, wallet);
    }

}