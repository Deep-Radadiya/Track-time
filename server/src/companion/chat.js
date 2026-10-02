// The whole chat flow, in order:
//  1. save the user's message   2. gather context   3. write the prompt   4. ask the AI
//  5. read its answer           6. do what it decided   7. save the reply   8. return both
import { ChatMessage } from '../models/ChatMessage.js';
import { askGroq } from '../groq.js';
import { broadcast } from '../websocket.js';
import { buildContext } from './context.js';
import { buildSystemPrompt, buildUserMessage } from './prompt.js';
import { parseIntent } from './parseIntent.js';
import { executeIntent } from './actions.js';

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

export async function processChatMessage(user, content, taskId) {
  // 1. Save the user's message first, so it is part of the history.
  const userMessage = await ChatMessage.create({
    user_id: user._id, task_id: taskId, role: 'user', content, token_count: wordCount(content),
  });

  // 2 + 3. Context and prompt.
  const ctx = await buildContext(user);

  // 4. Ask the AI. If it fails for any reason, the user still gets a friendly answer.
  let rawAnswer;
  try {
    rawAnswer = await askGroq({
      messages: [
        { role: 'system', content: buildSystemPrompt(ctx) },
        { role: 'user', content: buildUserMessage(content, ctx) },
      ],
      maxTokens: 1024,
      temperature: 0.2,
    });
  } catch (err) {
    console.error('[Chat] AI error:', err.message);
    rawAnswer = '{"action":"unknown", "reply":"I am having trouble connecting to my brain right now. Please try again later."}';
  }

  // 5. Read the answer (never throws).
  const intent = parseIntent(rawAnswer);

  // 6. Do what the AI decided.
  try {
    if (await executeIntent(user, intent)) broadcast(user.id, { event: 'task_updated' }); // open tabs refresh
  } catch (err) {
    console.error('[Chat] could not run the action:', err);
    intent.reply = 'I understood you, but I ran into a database error trying to do that.';
  }

  // 7. Save the reply.
  const assistantMessage = await ChatMessage.create({
    user_id: user._id, task_id: taskId, role: 'assistant', content: intent.reply, token_count: wordCount(intent.reply),
  });

  // 8. Return both messages.
  return [userMessage, assistantMessage];
}
