// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/VoicePayRegistry.sol";

contract Deploy is Script {
    function run() external returns (VoicePayRegistry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(deployerKey);
        VoicePayRegistry registry = new VoicePayRegistry();
        vm.stopBroadcast();

        console.log("VoicePayRegistry deployed to:", address(registry));

        return registry;
    }
}