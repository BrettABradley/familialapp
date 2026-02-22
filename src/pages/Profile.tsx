import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Profile = () => {
  const { user } = useAuth();
  if (user) return <Navigate to={`/profile/${user.id}`} replace />;
  return <Navigate to="/auth" replace />;
};

export default Profile;
