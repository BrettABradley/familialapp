
ALTER TABLE private_messages ADD COLUMN media_urls text[] DEFAULT '{}';
ALTER TABLE group_chat_messages ADD COLUMN media_urls text[] DEFAULT '{}';
