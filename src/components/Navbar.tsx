import { useAuth } from '../context/AuthContext';
function Navbar() {
  const { user, profile } = useAuth();

  return (
    <nav>
      {/* ...other navbar content... */}
      {user && profile ? (
        <div>
          Welcome, {profile.name || user.email}!<br />
          Role: {profile.role}
        </div>
      ) : (
        <div>Please log in</div>
      )}
    </nav>
  );
}

export default Navbar;