REVOKE ALL ON FUNCTION public.delete_group_chat_as_creator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_group_chat_as_creator(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_group_chat_as_creator(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_private_conversation_as_creator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_private_conversation_as_creator(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_private_conversation_as_creator(uuid) TO authenticated;