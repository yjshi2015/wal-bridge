import { Button, Card, Box, Text } from "@radix-ui/themes";
import { useState } from 'react';
import {
    Wormhole,
    canonicalAddress,
    routes,
    wormhole,
  } from '@wormhole-foundation/sdk';
  
  import solana from '@wormhole-foundation/sdk/solana';
  import sui from '@wormhole-foundation/sdk/sui';
  import { getSigner } from './helpers';
  
  export function StartBridge() {
    const [status, setStatus] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
  
    async function handleBridge() {
      try {
        setIsLoading(true);
        setStatus('正在准备跨链...');
  
        // 设置网络和链
        const wh = await wormhole('Testnet', [solana, sui]);
    
        // 获取链上下文
        const sendChain = wh.getChain('Solana');
        const destChain = wh.getChain('Sui');
    
        // 获取签名者
        const sender = await getSigner(sendChain);
        const receiver = await getSigner(destChain);
    
        // 创建路由解析器
        const resolver = wh.resolver([
          routes.TokenBridgeRoute, // 手动代币桥
          routes.AutomaticTokenBridgeRoute, // 自动代币桥
          routes.CCTPRoute, // 手动 CCTP
          routes.AutomaticCCTPRoute, // 自动 CCTP
          routes.AutomaticPorticoRoute, // 原生代币转账
        ]);
    
        // 获取源链上可用的代币
        // const srcTokens = await resolver.supportedSourceTokens(sendChain);
        // console.log('允许的源代币:', srcTokens.map((t) => canonicalAddress(t)));
    
        // 选择原生代币
        const sendToken = Wormhole.tokenId(sendChain.chain, 'native');
    
        // 获取目标链上可接收的代币
        const destTokens = await resolver.supportedDestinationTokens(
          sendToken,
          sendChain,
          destChain
        );
        console.log('可接收的目标代币:', destTokens.map((t) => canonicalAddress(t)));
        
        // 选择第一个可用的目标代币
        const destinationToken = destTokens[0]!;
    
        // 创建转账请求
        const tr = await routes.RouteTransferRequest.create(wh, {
          source: sendToken,
          destination: destinationToken,
        });
    
        // 查找可用的路由
        const foundRoutes = await resolver.findRoutes(tr);
        console.log('找到的路由:', foundRoutes);
    
        // 选择第一个路由
        const bestRoute = foundRoutes[0]!;
        console.log('选择的路由:', bestRoute);
    
        // 获取默认选项
        console.log('默认选项:', bestRoute.getDefaultOptions());
    
        // 设置转账金额
        const amt = '0.001';
        const transferParams = { amount: amt, options: { nativeGas: 0 } };
    
        // 验证参数
        const validated = await bestRoute.validate(tr, transferParams);
        if (!validated.valid) throw validated.error;
        console.log('验证后的参数:', validated.params);
    
        // 获取报价
        const quote = await bestRoute.quote(tr, validated.params);
        if (!quote.success) throw quote.error;
        console.log('最佳路由报价:', quote);
    
        // 执行转账
        const receipt = await bestRoute.initiate(
          tr,
          sender.signer,
          quote,
          receiver.address
        );
        console.log('转账收据:', receipt);
    
        // 等待转账完成
        await routes.checkAndCompleteTransfer(bestRoute, receipt, receiver.signer);
        
        setStatus('跨链转账成功！');
      } catch (error: any) {
        setStatus(`跨链失败: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  
    return (
      <Card>
        <Box p="4">
          <Button onClick={handleBridge} disabled={isLoading}>
            {isLoading ? '处理中...' : '开始跨链'}
          </Button>
          {status && (
            <Text as="div" size="2" mt="2" color={status.includes('成功') ? 'green' : 'gray'}>
              {status}
            </Text>
          )}
        </Box>
      </Card>
    );
  }