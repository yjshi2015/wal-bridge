// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { WalrusClient } from '@mysten/walrus';
import { Box, Button, Text, Card } from "@radix-ui/themes";
import { useState } from 'react';

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
	});

	async function uploadFile() {
		try {
			if (!currentAccount) {
				setUploadStatus('请先连接钱包');
				return;
			}

			setUploadStatus('正在准备文件...');
			const file = new TextEncoder().encode('Hello from the TS SDK!!!\n');

			setUploadStatus('正在编码文件...');
			const encoded = await walrusClient.encodeBlob(file);

			setUploadStatus('正在注册文件...');
			const registerBlobTransaction = await walrusClient.registerBlobTransaction({
				blobId: encoded.blobId,
				rootHash: encoded.rootHash,
				size: file.length,
				deletable: true,
				epochs: 3,
				owner: currentAccount.address,
			});

			const { digest } = await signAndExecuteTransaction({ transaction: registerBlobTransaction });

			const { objectChanges, effects } = await suiClient.waitForTransaction({
				digest,
				options: { showObjectChanges: true, showEffects: true },
			});

			if (effects?.status.status !== 'success') {
				throw new Error('Failed to register blob');
			}

			const blobType = await walrusClient.getBlobType();

			const blobObject = objectChanges?.find(
				(change) => change.type === 'created' && change.objectType === blobType,
			);

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

			setUploadStatus('正在认证文件...');
			const certifyBlobTransaction = await walrusClient.certifyBlobTransaction({
				blobId: encoded.blobId,
				blobObjectId: blobObject.objectId,
				confirmations,
				deletable: true,
			});

			const { digest: certifyDigest } = await signAndExecuteTransaction({
				transaction: certifyBlobTransaction,
			});

			const { effects: certifyEffects } = await suiClient.waitForTransaction({
				digest: certifyDigest,
				options: { showEffects: true },
			});

			if (certifyEffects?.status.status !== 'success') {
				throw new Error('Failed to certify blob');
			}

			setBlobId(encoded.blobId);
			setUploadStatus('文件上传成功！');
		} catch (error: any) {
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
