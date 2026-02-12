# Apptiv Authentication Integration Guide

## Overview
This guide will help you integrate the complete authentication system into your existing Apptiv application in VS Code.

## Files Created
1. `Login.jsx` - Login page component
2. `AuthContext.jsx` - Authentication state management
3. `ProtectedRoute.jsx` - Route protection component
4. `ApptivPlatformWithAuth.jsx` - Updated platform with logout
5. `App.jsx` - Main app with routing
6. `index.js` - Application entry point

## Step-by-Step Integration

### Step 1: Install Required Dependencies

Open your terminal in VS Code and run:

```bash
npm install react-router-dom
```

Make sure you already have these installed (you should from your existing project):
- react
- react-dom
- recharts
- lucide-react

### Step 2: Update Your Project Structure

Your `src` folder should look like this:

```
src/
├── App.jsx (NEW - replace existing)
├── index.js (UPDATE - replace existing)
├── index.css (existing - your Tailwind CSS)
├── Login.jsx (NEW)
├── AuthContext.jsx (NEW)
├── ProtectedRoute.jsx (NEW)
├── ApptivPlatform.jsx (RENAME from existing)
└── components/ (optional - for organizing)
```

### Step 3: File Placement

1. **Copy the Login.jsx file** to `src/Login.jsx`
2. **Copy the AuthContext.jsx file** to `src/AuthContext.jsx`
3. **Copy the ProtectedRoute.jsx file** to `src/ProtectedRoute.jsx`
4. **Copy the App.jsx file** to `src/App.jsx` (replace existing if present)
5. **Copy the index.js file** to `src/index.js` (replace existing)

### Step 4: Update Your Existing ApptivPlatform Component

**IMPORTANT:** You have two options here:

**Option A: Keep Your Existing Page Components (RECOMMENDED)**

1. Open your existing `ApptivPlatform.jsx` (or whatever you called it)
2. Add these imports at the top:
   ```javascript
   import { useNavigate } from 'react-router-dom';
   import { useAuth } from './AuthContext';
   import { LogOut } from 'lucide-react';
   ```

3. At the very beginning of your ApptivPlatform function, add:
   ```javascript
   const navigate = useNavigate();
   const { user, logout } = useAuth();
   const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
   ```

4. Replace this line:
   ```javascript
   const [currentUser] = useState({ ... });
   ```
   
   With:
   ```javascript
   // currentUser is now coming from useAuth hook as 'user'
   // Update all instances of currentUser to use 'user' instead
   ```

5. In your sidebar, find the bottom section (usually has a menu toggle) and add the logout button BEFORE the menu toggle:

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

6. Add the logout confirmation modal at the top of your return statement (before the sidebar):

   ```javascript
   return (
     <div className="flex h-screen bg-gray-50">
       {/* Logout Confirmation Modal */}
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
       
       {/* Rest of your existing code */}
   ```

7. Add the logout handler function:
   ```javascript
   const handleLogout = () => {
     logout();
     navigate('/login');
   };
   ```

**Option B: Use the Provided Template**

If you want to start fresh or your existing code is significantly different:
1. Use the `ApptivPlatformWithAuth.jsx` as a template
2. Copy your existing page components (ScorecardPage, CoachPage, etc.) into it
3. Replace the placeholder page components in ApptivPlatformWithAuth.jsx with your actual implementations

### Step 5: Update All References to currentUser

Search your entire ApptivPlatform.jsx file for `currentUser` and replace with `user`:
- `currentUser.name` → `user?.name` (note the optional chaining)
- `currentUser.role` → `user?.role`
- `currentUser.email` → `user?.email`
- etc.

The `?.` is important because `user` might be null during initial load.

### Step 6: Verify Your index.css

Make sure your `src/index.css` has Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Your custom styles below */
```

### Step 7: Test Locally

1. Start your development server:
   ```bash
   npm start
   ```

2. You should be redirected to `/login`

3. Test with demo accounts:
   - Manager: manager@apptiv.com / manager123
   - Power User: poweruser@apptiv.com / power123
   - Admin: admin@apptiv.com / admin123

4. After login, you should see the dashboard

5. Test the logout button

### Step 8: Deploy to Production

Once everything works locally:

1. Build your production bundle:
   ```bash
   npm run build
   ```

2. Deploy the `build` folder to apptivia.app using your hosting service (Vercel, Netlify, etc.)

## Demo Accounts

The system comes with three pre-configured demo accounts:

| Email | Password | Role | Name |
|-------|----------|------|------|
| manager@apptiv.com | manager123 | Manager | Sarah Johnson |
| poweruser@apptiv.com | power123 | Power User | Mike Chen |
| admin@apptiv.com | admin123 | Admin | Alex Rivera |

## Features Included

✅ Secure login page with modern UI
✅ Demo accounts for testing
✅ Session persistence (localStorage)
✅ Protected routes
✅ Automatic redirect to login if not authenticated
✅ Logout confirmation modal
✅ Role-based permissions
✅ Loading states
✅ Error handling
✅ Responsive design

## Security Notes

**For Production:**
1. Replace demo accounts with real authentication API
2. Add backend authentication endpoint
3. Use JWT tokens instead of localStorage
4. Implement refresh tokens
5. Add password reset functionality
6. Enable HTTPS only
7. Add rate limiting

## Troubleshooting

### "Cannot find module 'react-router-dom'"
Run: `npm install react-router-dom`

### Login page not showing
- Check that App.jsx has the correct route setup
- Verify index.js is importing App correctly

### Can't access dashboard after login
- Check browser console for errors
- Verify localStorage has 'apptiv_user' entry
- Check that user object has all required fields

### Logout not working
- Verify the logout function is called correctly
- Check that navigate('/login') is being called
- Clear localStorage manually if needed

### Styling looks broken
- Verify Tailwind CSS is properly configured
- Check that index.css has @tailwind directives
- Rebuild your project: `npm run build`

## Next Steps

After basic authentication is working:

1. **Add Password Reset**
   - Create password reset flow
   - Add email verification

2. **Connect to Backend**
   - Replace demo accounts with API calls
   - Implement real user authentication

3. **Add More Security**
   - Implement JWT tokens
   - Add refresh token rotation
   - Add session timeout

4. **User Management**
   - Add user registration (for admins)
   - Add user profile editing
   - Add role management

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all files are in correct locations
3. Ensure all dependencies are installed
4. Clear browser cache and localStorage
5. Restart development server

## File References

All authentication files are located in: `/home/claude/apptiv-auth/`

You can copy these files directly into your VS Code project's `src` folder.
