// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VoicePayRegistry.sol";

contract VoicePayRegistryTest is Test {

    VoicePayRegistry public registry;

    address owner = address(this);
    address userWallet1 = address(0x1111);
    address userWallet2 = address(0x2222);

    bytes32 phoneHash1 = keccak256(abi.encodePacked("+919999999999"));
    bytes32 phoneHash2 = keccak256(abi.encodePacked("+918888888888"));

    function setUp() public {
        registry = new VoicePayRegistry();
    }

    function test_RegisterUser_Success() public {
        registry.registerUser(phoneHash1, userWallet1);

        assertEq(registry.resolveWallet(phoneHash1), userWallet1);
        assertEq(registry.walletToPhoneHash(userWallet1), phoneHash1);
        assertTrue(registry.isRegistered(phoneHash1));
    }

    function test_RevertWhen_DuplicateRegistration() public {
        registry.registerUser(phoneHash1, userWallet1);

        vm.expectRevert("Phone already registered");
        registry.registerUser(phoneHash1, userWallet2);
    }

    function test_RevertWhen_NotOwner() public {
        vm.prank(address(0xBEEF)); // random non-owner caller
        vm.expectRevert();
        registry.registerUser(phoneHash1, userWallet1);
    }

    function test_IsRegistered_FalseForUnknownPhone() public view {
        assertFalse(registry.isRegistered(phoneHash2));
    }

    function test_MultipleUsers_NoCollision() public {
        registry.registerUser(phoneHash1, userWallet1);
        registry.registerUser(phoneHash2, userWallet2);

        assertEq(registry.resolveWallet(phoneHash1), userWallet1);
        assertEq(registry.resolveWallet(phoneHash2), userWallet2);
    }

     function testFuzz_RegisterManyUsers(bytes32[10] memory phoneHashes, address[10] memory wallets) public {
        for (uint256 i = 0; i < 10; i++) {
            if (wallets[i] == address(0)) continue;
            if (registry.isRegistered(phoneHashes[i])) continue;
            if (registry.walletToPhoneHash(wallets[i]) != bytes32(0)) continue;

            registry.registerUser(phoneHashes[i], wallets[i]);
            assertEq(registry.resolveWallet(phoneHashes[i]), wallets[i]);
        }
     }


}