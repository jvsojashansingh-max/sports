import { ConversationPanel } from '@/components/chat/ConversationPanel';

type ChatPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { conversationId } = await params;
  return <ConversationPanel conversationId={conversationId} />;
}
