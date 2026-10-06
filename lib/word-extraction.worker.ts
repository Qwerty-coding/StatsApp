// Runs extractAndFilterWords off the main thread so large chats don't freeze
// the UI while the word cloud is being computed.
import { extractAndFilterWords } from "./optimized-word-extraction";

interface ExtractRequest {
  id: number;
  messages: Parameters<typeof extractAndFilterWords>[0];
  config: Parameters<typeof extractAndFilterWords>[1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = self;

ctx.onmessage = function (e: MessageEvent<ExtractRequest>) {
  const { id, messages, config } = e.data;
  try {
    const result = extractAndFilterWords(messages, config);
    ctx.postMessage({ id, words: result.words, error: null });
  } catch (error) {
    ctx.postMessage({ id, words: [], error: (error as Error).message });
  }
};
