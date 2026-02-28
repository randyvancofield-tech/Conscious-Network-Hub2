// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HCNProfileAnchor
/// @notice Anchors off-chain profile metadata by storing only CID/hash/timestamp/address binding on-chain.
contract HCNProfileAnchor {
    address public owner;
    mapping(address => bool) private _authorizedAnchors;
    mapping(address => string) private _profileCidByAddress;
    mapping(address => bytes32) private _profileHashByAddress;
    mapping(address => uint256) private _profileUpdatedAt;

    event AnchorAuthorizationUpdated(address indexed anchor, bool authorized);
    event ProfileIntegrityAnchored(
        address indexed account,
        string cid,
        bytes32 indexed profileHash,
        uint256 updatedAt
    );

    constructor() {
        owner = msg.sender;
        _authorizedAnchors[msg.sender] = true;
        emit AnchorAuthorizationUpdated(msg.sender, true);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner required");
        _;
    }

    modifier onlyAuthorizedAnchor() {
        require(_authorizedAnchors[msg.sender], "anchor authorization required");
        _;
    }

    function setAnchorAuthorization(address anchor, bool authorized) external onlyOwner {
        require(anchor != address(0), "anchor is required");
        _authorizedAnchors[anchor] = authorized;
        emit AnchorAuthorizationUpdated(anchor, authorized);
    }

    function isAuthorizedAnchor(address anchor) external view returns (bool) {
        return _authorizedAnchors[anchor];
    }

    function anchorProfileIntegrity(
        address account,
        string calldata cid,
        bytes32 profileHash
    ) external onlyAuthorizedAnchor {
        require(account != address(0), "account is required");
        require(bytes(cid).length > 0, "CID is required");
        require(profileHash != bytes32(0), "profile hash is required");

        _profileCidByAddress[account] = cid;
        _profileHashByAddress[account] = profileHash;
        _profileUpdatedAt[account] = block.timestamp;

        emit ProfileIntegrityAnchored(account, cid, profileHash, block.timestamp);
    }

    function profileCidOf(address account) external view returns (string memory) {
        return _profileCidByAddress[account];
    }

    function profileHashOf(address account) external view returns (bytes32) {
        return _profileHashByAddress[account];
    }

    function profileUpdatedAtOf(address account) external view returns (uint256) {
        return _profileUpdatedAt[account];
    }
}
