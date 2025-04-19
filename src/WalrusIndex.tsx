// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { WalrusClient } from '@mysten/walrus';
import { Box, Button, Text, Card } from "@radix-ui/themes";
import { useState } from 'react';
// import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url';

export function FileUpload() {
	const suiClient = useSuiClient();
	const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
	const currentAccount = useCurrentAccount();
	const [uploadStatus, setUploadStatus] = useState<string>('');
	const [blobId, setBlobId] = useState<string>('');

	const walrusClient = new WalrusClient({
		network: 'testnet',
		suiClient,
		storageNodeClientOptions: {
			timeout: 60_000,
		},
		wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
	});

	async function uploadFile() {
		try {
			if (!currentAccount) {
				setUploadStatus('请先连接钱包');
				return;
			}

			console.log('当前钱包地址:', currentAccount.address);
			setUploadStatus('正在准备文件...');
			const file = new TextEncoder().encode('Hello from the TS SDK!!! SYJ \n');

			setUploadStatus('正在编码文件...');
			const encoded = await walrusClient.encodeBlob(file);
			console.log('文件编码完成:', encoded);

			setUploadStatus('正在注册文件...');
			const registerBlobTransaction = await walrusClient.registerBlobTransaction({
				blobId: encoded.blobId,
				rootHash: encoded.rootHash,
				size: file.length,
				deletable: true,
				epochs: 3,
				owner: currentAccount.address,
			});
			console.log('注册文件交易已创建:', registerBlobTransaction);

			registerBlobTransaction.setSender(currentAccount.address);

			console.log('准备签名交易...');
			const { digest } = await signAndExecuteTransaction({ transaction: registerBlobTransaction });
			console.log('交易已签名，digest:', digest);

			console.log('等待交易确认...');
			const { objectChanges, effects } = await suiClient.waitForTransaction({
				digest,
				options: { showObjectChanges: true, showEffects: true },
			});
			console.log('交易确认结果:', { objectChanges, effects });

			if (effects?.status.status !== 'success') {
				throw new Error('Failed to register blob');
			}

			const blobType = await walrusClient.getBlobType();
			console.log('获取到 blob 类型:', blobType);

			const blobObject = objectChanges?.find(
				(change) => change.type === 'created' && change.objectType === blobType,
			);
			console.log('找到 blob 对象:', blobObject);

			if (!blobObject || blobObject.type !== 'created') {
				throw new Error('Blob object not found');
			}

			setUploadStatus('正在写入存储节点...');
			const confirmations = await walrusClient.writeEncodedBlobToNodes({
				blobId: encoded.blobId,
				metadata: encoded.metadata,
				sliversByNode: encoded.sliversByNode,
				deletable: true,
				objectId: blobObject.objectId,
			});
			console.log('存储节点写入确认:', confirmations);

			setUploadStatus('正在认证文件...');
			const certifyBlobTransaction = await walrusClient.certifyBlobTransaction({
				blobId: encoded.blobId,
				blobObjectId: blobObject.objectId,
				confirmations,
				deletable: true,
			});
			console.log('认证文件交易已创建:', certifyBlobTransaction);

			certifyBlobTransaction.setSender(currentAccount.address);

			console.log('准备签名认证交易...');
			const { digest: certifyDigest } = await signAndExecuteTransaction({
				transaction: certifyBlobTransaction,
			});
			console.log('认证交易已签名，digest:', certifyDigest);

			console.log('等待认证交易确认...');
			const { effects: certifyEffects } = await suiClient.waitForTransaction({
				digest: certifyDigest,
				options: { showEffects: true },
			});
			console.log('认证交易确认结果:', certifyEffects);

			if (certifyEffects?.status.status !== 'success') {
				throw new Error('Failed to certify blob');
			}

			setBlobId(encoded.blobId);
			setUploadStatus('文件上传成功！');
		} catch (error: any) {
			console.error('上传过程中出错:', error);
			setUploadStatus(`上传失败: ${error.message}`);
		}
	}

	return (
		<Card>
			<Box p="4">
				<Text as="div" size="2" mb="4">
					点击按钮上传示例文件到 Walrus 存储网络
				</Text>
				<Button onClick={uploadFile} disabled={!currentAccount}>
					{currentAccount ? '上传文件' : '请先连接钱包'}
				</Button>
				{uploadStatus && (
					<Text as="div" size="2" mt="2" color={uploadStatus.includes('成功') ? 'green' : 'gray'}>
						{uploadStatus}
					</Text>
				)}
				{blobId && (
					<Text as="div" size="2" mt="2">
						文件 ID: {blobId}
					</Text>
				)}
			</Box>
		</Card>
	);
}
