// chunkUtils.js

// Rough chunk limit to avoid exceeding GPT's context window
// ~4 chars = 1 token. Here ~6000 chars ~ 1500 tokens, which is safe for 8k context.
const MAX_CHARS_PER_CHUNK = 6000;

export function chunkMessages(messages) {
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const msg of messages) {
    const msgLength = msg.length + 1; // +1 for spacing
    if (currentLength + msgLength > MAX_CHARS_PER_CHUNK) {
      chunks.push(currentChunk);
      currentChunk = [msg];
      currentLength = msgLength;
    } else {
      currentChunk.push(msg);
      currentLength += msgLength;
    }
  }

  // Last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}