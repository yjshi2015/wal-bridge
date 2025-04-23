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

			// 创建一个文件输入元素
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = '*/*'; // 接受所有文件类型

			// 等待用户选择文件
			const file = await new Promise<File>((resolve) => {
				input.onchange = (e) => {
					const file = (e.target as HTMLInputElement).files?.[0];
					if (file) resolve(file);
				};
				input.click();
			});

			// 读取文件内容
			const arrayBuffer = await file.arrayBuffer();
			const fileBytes = new Uint8Array(arrayBuffer);

			setUploadStatus('正在编码文件...');
			const encoded = await walrusClient.encodeBlob(fileBytes);
			console.log('文件编码完成:', encoded);

			setUploadStatus('正在注册文件...');
			const registerBlobTransaction = await walrusClient.registerBlobTransaction({
				blobId: encoded.blobId,
				rootHash: encoded.rootHash,
				size: fileBytes.length,
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

	async function retrieveBlob(blobId: string) {
		try {
			// 从 Walrus 客户端读取 blob 数据
			const blobBytes = await walrusClient.readBlob({ blobId });
			
			// 将 blob 数据保存为文件
			const blob = new Blob([new Uint8Array(blobBytes)]);
			
			const attributes = await walrusClient.readBlobAttributes({
				blobObjectId: blobId,
			});
		
			console.log(attributes);

			// 创建下载链接
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			
			// 设置文件名（可以根据需要修改）
			a.download = `blob-${blobId}.bin`;
			
			// 触发下载
			document.body.appendChild(a);
			a.click();
			
			// 清理
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			
		} catch (error) {
			console.error('读取 blob 失败:', error);
			throw error;
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
					<Box mt="4">
						<Text as="div" size="2" mb="2">
							文件 ID: {blobId}
						</Text>
						<Button 
							onClick={() => retrieveBlob(blobId)}
							variant="outline"
						>
							下载文件
						</Button>
					</Box>
				)}
			</Box>
		</Card>
	);
}
