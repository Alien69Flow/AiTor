import { ProtectedChatContainer } from "@/components/chat/ProtectedChatContainer";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>AI Tor - ΔlieπFlΦw DAO Synapse Collective</title>
        <meta name="description" content="Interfaz de chat multi-IA especializada en Blockchain, Web3, Web4, Computación Cuántica, Filosofía y más. Powered by Gemini y GPT." />
      </Helmet>
      <ProtectedChatContainer />
    </>
  );
};

export default Index;
