// This file contains the user credentials for frontend authentication
// This is a temporary solution and should be replaced with API calls

const userCredentials = {
  'admin@cosmicsolutions.com': {
    id: '1',
    name: 'Super Admin',
    email: 'admin@cosmicsolutions.com',
    password: 'Admin@123',
    role: 'super-admin',
  },
  'manager@cosmicsolutions.com': {
    id: '2',
    name: 'Manager',
    email: 'manager@cosmicsolutions.com',
    password: 'Manager@123',
    role: 'manager',
  },
  'sarah.johnson@cosmicsolutions.com': {
    id: '3',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@cosmicsolutions.com',
    password: 'Sarah@123',
    role: 'manager',
  },
  'david.kim@cosmicsolutions.com': {
    id: '4',
    name: 'David Kim',
    email: 'david.kim@cosmicsolutions.com',
    password: 'David@123',
    role: 'manager',
  },
  'technician@cosmicsolutions.com': {
    id: '5',
    name: 'Technician',
    email: 'technician@cosmicsolutions.com',
    password: 'Tech@123',
    role: 'technician',
  },
  'mike.chen@cosmicsolutions.com': {
    id: '6',
    name: 'Mike Chen',
    email: 'mike.chen@cosmicsolutions.com',
    password: 'Mike@123',
    role: 'technician',
  },
  'lisa.rodriguez@cosmicsolutions.com': {
    id: '7',
    name: 'Lisa Rodriguez',
    email: 'lisa.rodriguez@cosmicsolutions.com',
    password: 'Lisa@123',
    role: 'technician',
  },
  'james.wilson@cosmicsolutions.com': {
    id: '8',
    name: 'James Wilson',
    email: 'james.wilson@cosmicsolutions.com',
    password: 'James@123',
    role: 'technician',
  },
};

// Authenticate user function
export const authenticateUser = async (email, password, role) => {
  try {
    // Make API call to backend
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      // Store token in localStorage
      localStorage.setItem('token', data.data.token);
      return data.data.user;
    } else {
      console.error('Login failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Login error:', error);
    
    // Fallback to local authentication if API is not available
    const user = userCredentials[email];
    if (user && user.password === password && user.role === role) {
      return user;
    }
    
    return null;
  }
};

// Get users by role function
export const getUsersByRole = (role) => {
  return Object.values(userCredentials).filter(user => user.role === role);
};

// Get all users function
export const getAllUsers = () => {
  return Object.values(userCredentials);
};

// Get user by ID function
export const getUserById = (id) => {
  return Object.values(userCredentials).find(user => user.id === id);
};

// Update user function
export const updateUser = async (id, userData) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`http://localhost:5000/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return data.data.user;
    } else {
      console.error('Update failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Update error:', error);
    return null;
  }
};

// Create user function
export const createUser = async (userData) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return data.data.user;
    } else {
      console.error('Registration failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Registration error:', error);
    return null;
  }
};

// Change password function
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch('http://localhost:5000/api/auth/change-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return true;
    } else {
      console.error('Password change failed:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Password change error:', error);
    return false;
  }
};

// Logout function
export const logout = async () => {
  try {
    const token = localStorage.getItem('token');
    
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // Clear token from localStorage
    localStorage.removeItem('token');
    
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    // Clear token anyway
    localStorage.removeItem('token');
    return false;
  }
};