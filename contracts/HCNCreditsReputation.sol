// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HCNCreditsReputation
/// @notice Reputation staking and backend-signed reward claims for HCN.
contract HCNCreditsReputation {
    string public constant name = "HCN Credits";
    string public constant symbol = "HCN";
    uint8 public constant decimals = 18;

    address public owner;
    address public oracleSigner;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public reputationOf;
    mapping(bytes32 => bool) public claimedRewards;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event ReputationStaked(address indexed staker, uint256 amount, uint256 reputationAfter);
    event RewardsClaimed(
        address indexed recipient,
        bytes32 indexed txid,
        uint256 amount,
        uint256 reputationPoints
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "owner only");
        _;
    }

    constructor(address initialOracleSigner) {
        require(initialOracleSigner != address(0), "oracle signer required");
        owner = msg.sender;
        oracleSigner = initialOracleSigner;
        emit OwnershipTransferred(address(0), msg.sender);
        emit OracleSignerUpdated(address(0), initialOracleSigner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "new owner required");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setOracleSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "new signer required");
        address previousSigner = oracleSigner;
        oracleSigner = newSigner;
        emit OracleSignerUpdated(previousSigner, newSigner);
    }

    /// @notice Optional owner-only utility to seed balances for staking.
    function grantInitialCredits(address account, uint256 amount) external onlyOwner {
        require(account != address(0), "account required");
        require(amount > 0, "amount required");
        balanceOf[account] += amount;
    }

    function stakeReputation(uint256 amount) external {
        require(amount > 0, "amount required");
        uint256 currentBalance = balanceOf[msg.sender];
        require(currentBalance >= amount, "insufficient balance");

        unchecked {
            balanceOf[msg.sender] = currentBalance - amount;
            reputationOf[msg.sender] += amount;
        }

        emit ReputationStaked(msg.sender, amount, reputationOf[msg.sender]);
    }

    /// @notice Oracle-signed reward claim. Signature must be produced by the HCN backend.
    /// digest = keccak256(abi.encodePacked(address(this), chainId, recipient, txid, amount, reputationPoints))
    /// ethSignedDigest = keccak256("\x19Ethereum Signed Message:\n32" ++ digest)
    function claimRewards(
        bytes32 txid,
        uint256 amount,
        uint256 reputationPoints,
        bytes calldata signature
    ) external {
        require(txid != bytes32(0), "txid required");
        require(!claimedRewards[txid], "reward already claimed");
        require(amount > 0 || reputationPoints > 0, "reward values required");

        bytes32 digest = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                msg.sender,
                txid,
                amount,
                reputationPoints
            )
        );
        bytes32 ethSignedDigest = _toEthSignedMessageHash(digest);
        address recoveredSigner = _recoverSigner(ethSignedDigest, signature);
        require(recoveredSigner == oracleSigner, "invalid oracle signature");

        claimedRewards[txid] = true;
        balanceOf[msg.sender] += amount;
        reputationOf[msg.sender] += reputationPoints;

        emit RewardsClaimed(msg.sender, txid, amount, reputationPoints);
    }

    function _toEthSignedMessageHash(bytes32 digest) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) private pure returns (address) {
        require(signature.length == 65, "invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "invalid signature v");

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid signature");
        return signer;
    }
}
