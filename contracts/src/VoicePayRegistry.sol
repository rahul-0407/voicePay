// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract VoicePayRegistry is Ownable {

    mapping(bytes32 => address) public phoneHashToWallet;
    mapping(address => bytes32) public walletToPhoneHash;



    event UserRegistered(bytes32 indexed phoneHash, address indexed wallet, uint256 timestamp);
    

    constructor() Ownable(msg.sender) {}

    function registerUser(bytes32 phoneHash, address wallet) external onlyOwner{
        require(phoneHashToWallet[phoneHash] == address(0), "Phone already registered");
        require(wallet != address(0), "Invalid wallet");

        phoneHashToWallet[phoneHash] = wallet;
        walletToPhoneHash[wallet] = phoneHash;

        emit UserRegistered(phoneHash, wallet, block.timestamp);
    }

    function resolveWallet(bytes32 phoneHash) external view returns (address) {
        return phoneHashToWallet[phoneHash];
    }

    function isRegistered(bytes32 phoneHash) external view returns (bool) {
        return phoneHashToWallet[phoneHash] != address(0);
    }

}