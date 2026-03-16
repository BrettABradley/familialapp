-- Insert the Supabase URL into vault (public, non-sensitive)
SELECT vault.create_secret(
  'https://qxkwxolssapayqyfdwqc.supabase.co',
  'SUPABASE_URL'
);