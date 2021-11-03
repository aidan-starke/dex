// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Dex {
    enum Side {
        BUY,
        SELL
    }

    struct Token {
        bytes32 ticker;
        address tokenAddress;
    }

    struct Order {
        uint256 id;
        address trader;
        Side side;
        bytes32 ticker;
        uint256 amount;
        uint256 filled;
        uint256 price;
        uint256 date;
    }

    address public admin;
    bytes32[] public tokenList;
    mapping(bytes32 => Token) public tokens;
    mapping(address => mapping(bytes32 => uint256)) public traderBalances;
    mapping(bytes32 => mapping(uint256 => Order[])) public orderBook;
    uint256 public nextOrderId;
    uint256 public nextTradeId;
    bytes32 constant DAI = bytes32("DAI");

    event NewTrade(
        uint256 tradeId,
        uint256 orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint256 amount,
        uint256 price,
        uint256 date
    );

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier tokenExists(bytes32 _ticker) {
        require(
            tokens[_ticker].tokenAddress != address(0),
            "this token doesn't exist"
        );
        _;
    }

    modifier tokenIsNotDai(bytes32 _ticker) {
        require(_ticker != DAI, "cannot trade DAI");
        _;
    }

    function addToken(bytes32 _ticker, address _tokenAddress)
        external
        onlyAdmin
    {
        tokens[_ticker] = Token(_ticker, _tokenAddress);
        tokenList.push(_ticker);
    }

    function deposit(uint256 _amount, bytes32 _ticker)
        external
        tokenExists(_ticker)
    {
        IERC20(tokens[_ticker].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        traderBalances[msg.sender][_ticker] += _amount;
    }

    function withdraw(uint256 _amount, bytes32 _ticker)
        external
        tokenExists(_ticker)
    {
        require(
            traderBalances[msg.sender][_ticker] >= _amount,
            "balance too low"
        );
        traderBalances[msg.sender][_ticker] -= _amount;
        IERC20(tokens[_ticker].tokenAddress).transfer(msg.sender, _amount);
    }

    function createLimitOrder(
        bytes32 _ticker,
        uint256 _amount,
        uint256 _price,
        Side _side
    ) external tokenExists(_ticker) tokenIsNotDai(_ticker) {
        if (_side == Side.SELL) {
            require(
                traderBalances[msg.sender][_ticker] >= _amount,
                "token balance is too low"
            );
        } else {
            require(
                traderBalances[msg.sender][DAI] >= _amount * _price,
                "dai balance is too low"
            );
        }
        Order[] storage orders = orderBook[_ticker][uint256(_side)];
        orders.push(
            Order(
                nextOrderId,
                msg.sender,
                _side,
                _ticker,
                _amount,
                0,
                _price,
                block.timestamp
            )
        );
        uint256 i = orders.length > 0 ? orders.length - 1 : 0;
        while (i > 0) {
            if (_side == Side.BUY && orders[i - 1].price > orders[i].price) {
                break;
            }
            if (_side == Side.SELL && orders[i - 1].price < orders[i].price) {
                break;
            }
            Order memory order = orders[i - 1];
            orders[i - 1] = orders[i];
            orders[i] = order;
            i--;
        }
        nextOrderId++;
    }

    function createMarketOrder(
        bytes32 _ticker,
        uint256 _amount,
        Side _side
    ) external tokenExists(_ticker) tokenIsNotDai(_ticker) {
        if (_side == Side.SELL) {
            require(
                traderBalances[msg.sender][_ticker] >= _amount,
                "token balance is too low"
            );
        }
        Order[] storage orders = orderBook[_ticker][
            uint256(_side == Side.BUY ? Side.SELL : Side.BUY)
        ];
        uint256 i;
        uint256 remaining = _amount;

        while (i < orders.length && remaining > 0) {
            uint256 available = orders[i].amount - orders[i].filled;
            uint256 matched = (remaining > available) ? available : remaining;
            remaining -= matched;
            orders[i].filled += matched;
            emit NewTrade(
                nextTradeId,
                orders[i].id,
                _ticker,
                orders[i].trader,
                msg.sender,
                matched,
                orders[i].price,
                block.timestamp
            );
            if (_side == Side.SELL) {
                traderBalances[msg.sender][_ticker] -= matched;
                traderBalances[msg.sender][DAI] += matched * orders[i].price;
                traderBalances[orders[i].trader][_ticker] += matched;
                traderBalances[orders[i].trader][DAI] -=
                    matched *
                    orders[i].price;
            }
            if (_side == Side.BUY) {
                require(
                    traderBalances[msg.sender][DAI] >=
                        matched * orders[i].price,
                    "dai balance is too low"
                );
                traderBalances[msg.sender][_ticker] += matched;
                traderBalances[msg.sender][DAI] -= matched * orders[i].price;
                traderBalances[orders[i].trader][_ticker] -= matched;
                traderBalances[orders[i].trader][DAI] +=
                    matched *
                    orders[i].price;
            }
            nextTradeId++;
            i++;
        }

        i = 0;
        while (i < orders.length && orders[i].filled == orders[i].amount) {
            for (uint256 j = i; j < orders.length - 1; j++) {
                orders[j] = orders[j + 1];
            }
            orders.pop();
            i++;
        }
    }

    function getOrders(bytes32 _ticker, Side _side)
        external
        view
        returns (Order[] memory)
    {
        return orderBook[_ticker][uint256(_side)];
    }

    function getTokens() external view returns (Token[] memory) {
        Token[] memory _tokens = new Token[](tokenList.length);
        for (uint256 i = 0; i < tokenList.length; i++) {
            _tokens[i] = Token(
                tokens[tokenList[i]].ticker,
                tokens[tokenList[i]].tokenAddress
            );
        }
        return _tokens;
    }
}
