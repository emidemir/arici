import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RootRedirect() {
  const { user } = useAuth();
  return user
  ? <Navigate to="/explore/" replace />
  : <Navigate to="/auth/login/" replace />;
}