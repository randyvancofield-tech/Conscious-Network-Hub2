// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HCNProfileAnchor
/// @notice Anchors off-chain profile metadata by storing only the IPFS CID on-chain.
contract HCNProfileAnchor {
    mapping(address => string) private _profileCidByAddress;
    mapping(address => uint256) private _profileUpdatedAt;

    event ProfileCidAttached(address indexed account, string cid, uint256 updatedAt);

    function attachProfileCid(string calldata cid) external {
        require(bytes(cid).length > 0, "CID is required");
        _profileCidByAddress[msg.sender] = cid;
        _profileUpdatedAt[msg.sender] = block.timestamp;
        emit ProfileCidAttached(msg.sender, cid, block.timestamp);
    }

    function profileCidOf(address account) external view returns (string memory) {
        return _profileCidByAddress[account];
    }

    function profileUpdatedAtOf(address account) external view returns (uint256) {
        return _profileUpdatedAt[account];
    }
}
