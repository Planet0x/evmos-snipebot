# pool-sniper

This bot will simply look for when ETH-EVMOS pools are created on uniswapV2 or uniswapV3.
When those pools are created, it will simply place buy order as long as the marketcap stays within certain range assuming 200m genesis supply.
Inspired by Anish-Agnihotri

## Usage

```bash

# Install dependencies
npm install

# Re-run post install (just in case, see issue #1)
npm run postinstall

# Update environment variables
cp .env.sample > .env
vim .env

# Run pool-sniper
npm run start
```

This code is not audited, use at your own risk.
