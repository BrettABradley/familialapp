-- Attach the banned email check to auth.users signups
CREATE TRIGGER check_banned_email_on_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.check_banned_email();