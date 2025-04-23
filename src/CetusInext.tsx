// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Box, Button, Text, Card } from "@radix-ui/themes";
import { useState } from 'react';
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { Transaction } from '@mysten/sui/transactions';
import BN from 'bn.js';
const aggregatorURL = "https://api-sui.cetus.zone/router_v2/find_routes";

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
		env: Env.Testnet,
	});

	async function swapWSOLToSUI() {
		try {
			if (!currentAccount) {
				setSwapStatus('请先连接钱包');
				return;
			}

			setSwapStatus('正在准备交易...');

			// 定义代币类型
			const wSOL = "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93b::coin::COIN"; // wSOL 代币类型
			const SUI = "0x2::sui::SUI"; // SUI 代币类型

			// 设置兑换数量（这里以 1 wSOL 为例）
			const amount = new BN(1000000000); // 1 wSOL = 1000000000 最小单位

			// 查找最佳兑换路径
			const routers = await client.findRouters({
				from: wSOL,
				target: SUI,
				amount,
				byAmountIn: true, // 固定输入数量
			});

			console.log('找到兑换路径:', routers);

			if (!routers) {
				throw new Error('未找到兑换路径');
			}

			// 创建交易构建器
			const txb = new Transaction();

			// 构建兑换交易
			const targetCoin = await client.routerSwap({
				routers,
				inputCoin: txb.object(currentAccount.address), // 使用钱包中的 wSOL
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
