import { getContext, setContext } from 'svelte';

/** What any message in the chat view can ask the view to do. */
export interface ChatActions {
  openMedia(messageIndex: number): void;
  showMessage(messageIndex: number): void;
}

const KEY = Symbol('chat-actions');

export function provideChatActions(actions: ChatActions): void {
  setContext(KEY, actions);
}

export function useChatActions(): ChatActions | undefined {
  return getContext<ChatActions | undefined>(KEY);
}
