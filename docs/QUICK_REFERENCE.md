# Quick Reference: Update Your Existing ApptivPlatform.jsx

## 1. Add These Imports (at the top of file)

```javascript
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LogOut } from 'lucide-react'; // Add LogOut to your existing lucide-react imports
```

## 2. Replace the currentUser State Declaration

### FIND THIS (around line 85-95):
```javascript
const [currentUser] = useState({
  id: 1,
  name: 'Sarah Johnson',
  role: 'Manager',
  email: 'sarah.johnson@company.com',
  phone: '+1 (555) 123-4567',
  department: 'Sales',
  level: 'Proficient',
  permissions: ['view_team_data', 'create_contests', 'export_data', 'manage_team', 'create_playbooks']
});
```

### REPLACE WITH THIS:
```javascript
const navigate = useNavigate();
const { user, logout } = useAuth();
const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
```

## 3. Add Logout Handler Function

Add this function inside your ApptivPlatform component (before the return statement):

```javascript
const handleLogout = () => {
  logout();
  navigate('/login');
};
```

## 4. Update All References to currentUser

Use Find & Replace in VS Code:
- Find: `currentUser.name`
- Replace: `user?.name`

Do the same for:
- `currentUser.role` → `user?.role`
- `currentUser.email` → `user?.email`
- `currentUser.phone` → `user?.phone`
- `currentUser.department` → `user?.department`
- `currentUser.level` → `user?.level`
- `currentUser.permissions` → `user?.permissions`

⚠️ **IMPORTANT**: Use `user?.` (with question mark) instead of `user.` to handle null cases

## 5. Add Logout Modal

Add this BEFORE your sidebar (inside the main return statement):

```javascript
return (
  <div className="flex h-screen bg-gray-50">
    {/* ADD THIS LOGOUT MODAL */}
    {showLogoutConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Confirm Logout</h3>
          <p className="text-gray-600 mb-6">Are you sure you want to log out?</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Your existing sidebar starts here */}
    <div className={`${sidebarOpen ? 'w-64' : 'w-16'} ...`}>
```

## 6. Add Logout Button in Sidebar

Find your sidebar's bottom section (usually has the menu toggle button). It should look like:

```javascript
<div className="p-4 border-t">
  <button
    onClick={() => setSidebarOpen(!sidebarOpen)}
    className="w-full flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
  >
    <Menu size={20} />
  </button>
</div>
```

REPLACE WITH:

```javascript
<div className="p-4 border-t space-y-2">
  {sidebarOpen && (
    <button
      onClick={() => setShowLogoutConfirm(true)}
      className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    >
      <LogOut size={20} />
      <span className="font-medium">Logout</span>
    </button>
  )}
  <button
    onClick={() => setSidebarOpen(!sidebarOpen)}
    className="w-full flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
  >
    <Menu size={20} />
  </button>
</div>
```

## 7. Update Page Component Props

All your page components receive `currentUser` as a prop. Update them to receive `user` instead:

### FIND (in each page component):
```javascript
const ScorecardPage = ({ currentUser }) => {
  // ... code
}
```

### NO CHANGE NEEDED! 
Just keep passing `user` from the parent component:

```javascript
{currentPage === 'scorecard' && <ScorecardPage currentUser={user} />}
```

The page components will automatically get the authenticated user.

## Complete Example of Changes

### BEFORE:
```javascript
const ApptivPlatform = () => {
  const [currentPage, setCurrentPage] = useState('scorecard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  
  const [currentUser] = useState({
    id: 1,
    name: 'Sarah Johnson',
    role: 'Manager',
    // ... more fields
  });
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* sidebar */}
    </div>
  );
};
```

### AFTER:
```javascript
const ApptivPlatform = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('scorecard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Logout Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          {/* modal content */}
        </div>
      )}
      
      {/* sidebar with logout button */}
    </div>
  );
};
```

## Testing Your Changes

After making these changes:

1. Save all files
2. Run `npm start`
3. You should see the login page
4. Login with: manager@apptiv.com / manager123
5. You should see your dashboard
6. Click the logout button
7. You should be redirected to login

## Common Issues

### Error: "user is undefined"
- Make sure you're using `user?.name` with the `?.` operator
- Verify AuthContext is properly imported

### Logout button not showing
- Check that LogOut icon is imported from lucide-react
- Verify sidebarOpen condition

### Can't login
- Check that App.jsx has correct routing
- Verify AuthContext is wrapping your app

### Still seeing currentUser errors
- Use Find & Replace to catch all instances
- Search for `currentUser` in your file
