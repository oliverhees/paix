import { Metadata } from "next";

import AIChatSidebar from "../components/ai-chat-sidebar";
import AIChatInterface from "../components/ai-chat-interface";

export const metadata: Metadata = {
  title: "AI Chat V2",
  description:
    "AI chatbot is an app ui template that allows users to interact with an AI for messaging and assistance. Built with shadcn/ui, Next.js and Tailwind CSS.",
};

export default function Page() {
  return (
    <div className="relative flex h-[calc(100vh-var(--header-height)-3rem)] rounded-md lg:border">
      <AIChatSidebar />
      <div className="flex w-full grow flex-col">
        <AIChatInterface />
      </div>
    </div>
  );
}
