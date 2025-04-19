import { ConnectButton } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, Button, Text } from "@radix-ui/themes";
import { WalletStatus } from "./WalletStatus";
import { FileUpload } from "./WalrusIndex";

function App() {
  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>Walrus Storage dApp</Heading>
        </Box>

        <Box>
          <ConnectButton />
        </Box>
      </Flex>
      <Container>
        <Container
          mt="5"
          pt="2"
          px="4"
          style={{ background: "var(--gray-a2)", minHeight: 500 }}
        >
          <Box mb="4">
            <Text size="5" weight="bold" mb="2">钱包状态</Text>
            <WalletStatus />
          </Box>
          
          <Box>
            <Text size="5" weight="bold" mb="2">文件存储</Text>
            <FileUpload />
          </Box>
        </Container>
      </Container>
    </>
  );
}

export default App;