import { supabase } from './supabaseAuth.js';

// Create a new chat
export async function createChat(userId, title) {
  try {
    const { data, error } = await supabase
      .from('chats')
      .insert([
        {
          user_id: userId,
          title: title,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, chat: data[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get all chats for a user
export async function getUserChats(userId) {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, chats: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get a specific chat with all messages
export async function getChatWithMessages(chatId, userId) {
  try {
    // First, verify the chat belongs to the user
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chatData) {
      return { success: false, error: 'Chat not found' };
    }

    // Then get all messages for this chat
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return { success: false, error: messagesError.message };
    }

    return { success: true, chat: chatData, messages: messagesData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Add a message to a chat
export async function addMessageToChat(chatId, role, content, userId) {
  try {
    // Verify the chat belongs to the user
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chatData) {
      return { success: false, error: 'Chat not found' };
    }

    // Add the message
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          chat_id: chatId,
          role: role,
          content: content,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: data[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update chat title
export async function updateChatTitle(chatId, title, userId) {
  try {
    const { data, error } = await supabase
      .from('chats')
      .update({ title: title })
      .eq('id', chatId)
      .eq('user_id', userId)
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, chat: data[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Delete a chat and all its messages
export async function deleteChat(chatId, userId) {
  try {
    // Verify the chat belongs to the user
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chatData) {
      return { success: false, error: 'Chat not found' };
    }

    // Delete messages first
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', chatId);

    if (messagesError) {
      return { success: false, error: messagesError.message };
    }

    // Delete the chat
    const { error: chatDeleteError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (chatDeleteError) {
      return { success: false, error: chatDeleteError.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
