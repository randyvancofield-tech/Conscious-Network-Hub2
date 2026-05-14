// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProviderManager
/// @notice Maintains a wallet-only allowlist for approved CNH providers.
/// @dev Do not store names, emails, licenses, PHI, application data, or profile data on-chain.
contract ProviderManager {
    address public owner;
    mapping(address => bool) public admins;
    mapping(address => bool) public approvedProviders;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AdminUpdated(address indexed admin, bool authorized, address indexed operator);
    event ProviderApprovalUpdated(address indexed provider, bool approved, address indexed operator);

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AdminUpdated(msg.sender, true, msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner required");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == owner || admins[msg.sender], "admin required");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner is required");
        address previousOwner = owner;
        owner = newOwner;
        admins[newOwner] = true;
        emit OwnershipTransferred(previousOwner, newOwner);
        emit AdminUpdated(newOwner, true, msg.sender);
    }

    function setAdmin(address admin, bool authorized) external onlyOwner {
        require(admin != address(0), "admin is required");
        admins[admin] = authorized;
        emit AdminUpdated(admin, authorized, msg.sender);
    }

    function addProvider(address provider) external onlyAdmin {
        _setProviderApproval(provider, true);
    }

    function removeProvider(address provider) external onlyAdmin {
        _setProviderApproval(provider, false);
    }

    function setProviderApproval(address provider, bool approved) external onlyAdmin {
        _setProviderApproval(provider, approved);
    }

    function setProviderApprovals(
        address[] calldata providers,
        bool[] calldata approvals
    ) external onlyAdmin {
        require(providers.length == approvals.length, "length mismatch");
        for (uint256 index = 0; index < providers.length; index += 1) {
            _setProviderApproval(providers[index], approvals[index]);
        }
    }

    function isAdmin(address account) external view returns (bool) {
        return account == owner || admins[account];
    }

    function isApprovedProvider(address provider) external view returns (bool) {
        return approvedProviders[provider];
    }

    function _setProviderApproval(address provider, bool approved) private {
        require(provider != address(0), "provider is required");
        approvedProviders[provider] = approved;
        emit ProviderApprovalUpdated(provider, approved, msg.sender);
    }
}
