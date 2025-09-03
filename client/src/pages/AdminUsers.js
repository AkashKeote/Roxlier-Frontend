import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Edit3, Trash2,
  Eye, UserPlus, Shield, Store, User,
  ArrowUpDown, ArrowUp, ArrowDown, X, Star
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(null);
  const [userRatings, setUserRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [showRatings, setShowRatings] = useState(false);

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    address: '',
    password: '',
    role: 'normal_user'
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm })
      });

      const response = await axios.get(`/api/admin/users?${params}`);
      setUsers(response.data.users);
      setTotalPages(Math.ceil(response.data.total / 10));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, searchTerm]);

  const fetchUserRatings = useCallback(async (userId) => {
    try {
      setRatingsLoading(true);
      const response = await axios.get(`/api/admin/users/${userId}/ratings`);
      setUserRatings(response.data.ratings);
      setShowRatings(true);
    } catch (error) {
      console.error("Error fetching user ratings:", error);
      toast.error("Failed to fetch user ratings");
    } finally {
      setRatingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userForm.name || !userForm.email || !userForm.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (userForm.name.length < 2 || userForm.name.length > 100) {
      toast.error('Name must be between 2-100 characters');
      return;
    }

    if (userForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      if (editingUser) {
        await axios.put(`/api/admin/users/${editingUser.id}`, userForm);
        toast.success('User updated successfully!');
      } else {
        await axios.post('/api/admin/users', userForm);
        toast.success('User created successfully!');
      }

      setShowAddForm(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', address: '', password: '', role: 'normal_user' });
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Failed to save user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      toast.success('User deleted successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      address: user.address || '',
      password: '',
      role: user.role
    });
    setShowAddForm(true);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      normal_user: { label: 'Customer', color: 'bg-green-100 text-green-800', icon: User },
      store_owner: { label: 'Store Owner', color: 'bg-blue-100 text-blue-800', icon: Store },
      system_admin: { label: 'Admin', color: 'bg-red-100 text-red-800', icon: Shield }
    };

    const config = roleConfig[role] || roleConfig.normal_user;
    const IconComponent = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <IconComponent className="w-3 h-3" />
        <span>{config.label}</span>
      </span>
    );
  };

  const getRatingStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span
          key={i}
          className={`text-lg ${
            i <= rating ? "text-yellow-400" : "text-gray-300"
          }`}
        >
          {i <= rating ? "★" : "☆"}
        </span>
      );
    }
    return stars;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark-400 mb-2">Users ({users.length})</h1>
          <p className="text-dark-300">Manage all registered users in the system</p>
        </div>

        {/* Search and Controls */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-300 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10 w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="input-field w-auto min-w-[120px]"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
                <option value="created_at">Date Created</option>
              </select>

              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-dark-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-lg font-semibold text-primary-600">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-dark-400">{user.name}</div>
                          <div className="text-sm text-dark-300">ID: {user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-dark-400">{user.email}</div>
                      {user.address && (
                        <div className="text-sm text-dark-300 truncate max-w-xs">
                          {user.address}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowUserDetails(user)}
                          className="p-2 text-primary-600 hover:bg-primary-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && !loading && (
            <div className="px-6 py-12 text-center">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-dark-400 mb-2">No users found</h3>
              <p className="text-dark-300">Create your first user to get started</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-dark-300">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="btn-outline px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="btn-outline px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Add/Edit User Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md animate-slide-up">
              <div className="p-6 border-b border-primary-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-dark-400">
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingUser(null);
                      setUserForm({ name: '', email: '', address: '', password: '', role: 'normal_user' });
                    }}
                    className="text-dark-300 hover:text-dark-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-400 mb-2">Name *</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-400 mb-2">Email *</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-400 mb-2">Address</label>
                  <textarea
                    value={userForm.address}
                    onChange={(e) => setUserForm({ ...userForm, address: e.target.value })}
                    className="input-field w-full"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-400 mb-2">Password *</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="input-field w-full"
                    required
                    placeholder={editingUser ? 'Leave blank to keep current' : ''}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-400 mb-2">Role *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="input-field w-full"
                    required
                  >
                    <option value="normal_user">Customer</option>
                    <option value="store_owner">Store Owner</option>
                    <option value="system_admin">Admin</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingUser(null);
                      setUserForm({ name: '', email: '', address: '', password: '', role: 'normal_user' });
                    }}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Details Modal */}
        {showUserDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-md animate-slide-up">
              <div className="p-6 border-b border-primary-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-dark-400">User Details</h3>
                  <button
                    onClick={() => {
                      setShowUserDetails(null);
                      setShowRatings(false);
                      setUserRatings([]);
                    }}
                    className="text-dark-300 hover:text-dark-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="text-center mb-4">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-primary-600">
                      {showUserDetails.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold text-dark-400">{showUserDetails.name}</h4>
                  {getRoleBadge(showUserDetails.role)}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-dark-300">Email</p>
                    <p className="text-dark-400 font-medium">{showUserDetails.email}</p>
                  </div>

                  <div>
                    <p className="text-sm text-dark-300">Address</p>
                    <p className="text-dark-400 font-medium">{showUserDetails.address || 'No address provided'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-dark-300">User ID</p>
                    <p className="text-dark-400 font-medium">{showUserDetails.id}</p>
                  </div>

                  <div>
                    <p className="text-sm text-dark-300">Member Since</p>
                    <p className="text-dark-400 font-medium">
                      {new Date(showUserDetails.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowUserDetails(null);
                      setShowRatings(false);
                      setUserRatings([]);
                      handleEdit(showUserDetails);
                    }}
                    className="btn-primary flex-1"
                  >
                    Edit User
                  </button>
                  <button
                    onClick={() => fetchUserRatings(showUserDetails.id)}
                    className="btn-secondary flex-1"
                    disabled={ratingsLoading}
                  >
                    {ratingsLoading ? "Loading..." : "View Ratings"}
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDetails(null);
                      setShowRatings(false);
                      setUserRatings([]);
                    }}
                    className="btn-outline flex-1"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Ratings Modal */}
        {showRatings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="card w-full max-w-2xl animate-slide-up">
              <div className="p-6 border-b border-primary-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-dark-400">
                    Rating History - {showUserDetails?.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowRatings(false);
                      setUserRatings([]);
                    }}
                    className="text-dark-300 hover:text-dark-400 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {userRatings.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-dark-400 mb-2">No ratings yet</h4>
                    <p className="text-dark-300">This user hasn't rated any stores yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-dark-300 mb-4">
                      Total Ratings: {userRatings.length}
                    </div>
                    {userRatings.map((rating) => (
                      <div key={rating.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-dark-400">{rating.store_name}</h5>
                          <div className="flex items-center gap-2">
                            {getRatingStars(rating.rating)}
                            <span className="text-sm text-dark-300">({rating.rating}/5)</span>
                          </div>
                        </div>
                        <p className="text-sm text-dark-300 mb-2">{rating.store_address}</p>
                        {rating.comment && (
                          <p className="text-sm text-dark-400 italic">"{rating.comment}"</p>
                        )}
                        <p className="text-xs text-dark-300 mt-2">
                          Rated on {new Date(rating.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
