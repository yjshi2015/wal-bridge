// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Box, Button, Text, Card } from "@radix-ui/themes";
import { useState } from 'react';
import { AggregatorClient, CETUS, Env } from "@cetusprotocol/aggregator-sdk";
import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import BN from 'bn.js';
const aggregatorURL = "https://api-sui.cetus.zone/router_v2/find_routes";
// const aggregatorURL = "https://api-sui.devcetus.com/router_v2";


export function SwapComponent() {
	const suiClient = useSuiClient();
	const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
	const currentAccount = useCurrentAccount();
	const [swapStatus, setSwapStatus] = useState<string>('');

	// 初始化 Cetus 聚合器客户端
	const client = new AggregatorClient({
		endpoint:aggregatorURL,
		signer: currentAccount?.address,
		client: suiClient,
		env: Env.Mainnet,
	});

	async function swapWSOLToSUI() {
		try {
			if (!currentAccount) {
				setSwapStatus('请先连接钱包');
				return;
			}

			setSwapStatus('正在准备交易...');

			// 定义代币类型
			// const USDC = "0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc::usdc::USDC";
			const fromToken = "0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS"
			const targetToken = "0x2::sui::SUI"; // SUI 代币类型

			// 设置兑换数量（这里以 0.1 SUI 为例）
			const amountStr = 1;

			// 查找最佳兑换路径
			const routers = await client.findRouters({
				from: fromToken,
				target: targetToken,
				amount: new BN(amountStr),
				byAmountIn: true, // 固定输入数量
			});

			console.log('找到兑换路径:', routers);

			if (!routers) {
				throw new Error('未找到兑换路径');
			}

			// 创建交易构建器
			let coin: TransactionObjectArgument;
			const txb = new Transaction();

			if (fromToken.toUpperCase() === "SUI") {
				coin = txb.splitCoins(txb.gas, [amountStr]);
			} else {
				const allCoins = await suiClient.getCoins({
					owner: currentAccount.address,
					coinType: fromToken,
					limit: 30,
				});
	
				if (allCoins.data.length === 0) {
					console.error("No coins found");
					throw new Error('No coins found');
				}
	
				const mergeCoins = [];
	
				for (let i = 1; i < allCoins.data.length; i++) {
					console.info("Coin:", allCoins.data[i]);
					mergeCoins.push(allCoins.data[i].coinObjectId);
				}
				console.info("Merge coins:", mergeCoins);
	
				txb.mergeCoins(allCoins.data[0].coinObjectId, mergeCoins);
				coin = txb.splitCoins(allCoins.data[0].coinObjectId, [amountStr]);
			}

			// 构建兑换交易
			const targetCoin = await client.routerSwap({
				routers,
				inputCoin: coin,
				slippage: 0.01, // 1% 滑点
				txb,
			});

			// 将兑换得到的 SUI 转移到用户钱包
			txb.transferObjects([targetCoin], currentAccount.address);
			txb.setSender(currentAccount.address);

			setSwapStatus('正在签名交易...');

			// 签名并执行交易
			const { digest } = await signAndExecuteTransaction({ 
				transaction: txb 
			});

			setSwapStatus('等待交易确认...');

			// 等待交易确认
			const { effects } = await suiClient.waitForTransaction({
				digest,
				options: { showEffects: true },
			});

			if (effects?.status.status === 'success') {
				setSwapStatus('兑换成功！');
			} else {
				throw new Error('兑换失败');
			}

		} catch (error: any) {
			console.error('兑换过程中出错:', error);
			setSwapStatus(`兑换失败: ${error.message}`);
		}
	}

	return (
		<Card>
			<Box p="4">
				<Text as="div" size="2" mb="4">
					将 wSOL 兑换成 SUI
				</Text>
				<Button onClick={swapWSOLToSUI} disabled={!currentAccount}>
					{currentAccount ? '开始兑换' : '请先连接钱包'}
				</Button>
				{swapStatus && (
					<Text as="div" size="2" mt="2" color={swapStatus.includes('成功') ? 'green' : 'gray'}>
						{swapStatus}
					</Text>
				)}
			</Box>
		</Card>
	);
}
