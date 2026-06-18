'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchUsersAction,
  createUserAction,
  updateUserAction,
  deleteUserAction,
  resetUserPasswordAction
} from '@/app/actions/users'
import { toast } from 'sonner'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Search, 
  Filter, 
  Plus, 
  Loader2, 
  Trash2, 
  Key, 
  Edit, 
  User, 
  Mail, 
  Phone, 
  Check, 
  X, 
  ShieldAlert,
  Users,
  GraduationCap,
  AlertTriangle,
  UserCheck,
  Shield
} from 'lucide-react'

export default function UserManagementPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'mentor' | 'student'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Dialog open/close states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Current selected user state (for editing, deleting, reset password)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false)

  // Form states - Create User
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createFullName, setCreateFullName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createRole, setCreateRole] = useState<'admin' | 'mentor' | 'student'>('student')
  const [createStatus, setCreateStatus] = useState<'pending' | 'approved' | 'rejected'>('approved')
  const [createSubjects, setCreateSubjects] = useState<string[]>([])

  // Form states - Edit User
  const [editEmail, setEditEmail] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'mentor' | 'student'>('student')
  const [editStatus, setEditStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [editSubjects, setEditSubjects] = useState<string[]>([])

  // Form states - Reset Password
  const [newPassword, setNewPassword] = useState('')

  // Query: Fetch all users
  const { data: users = [], isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      return await fetchUsersAction()
    }
  })

  // Query: Fetch all subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['admin-subjects-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*').order('name', { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  // Handlers - Modals Setup
  const openCreateModal = () => {
    setCreateEmail('')
    setCreatePassword('')
    setCreateFullName('')
    setCreatePhone('')
    setCreateRole('student')
    setCreateStatus('approved')
    setCreateSubjects([])
    setIsCreateOpen(true)
  }

  const openEditModal = (user: any) => {
    setSelectedUser(user)
    setEditEmail(user.email)
    setEditFullName(user.full_name)
    setEditPhone(user.phone || '')
    setEditRole(user.role)
    setEditStatus(user.status)
    
    // Map existing subjects
    const userSubs = user.role === 'student'
      ? (user.student_subjects?.map((ss: any) => ss.subject_id) || [])
      : (user.mentor_subjects?.map((ms: any) => ms.subject_id) || [])
    
    setEditSubjects(userSubs)
    setIsEditOpen(true)
  }

  const openResetPasswordModal = (user: any) => {
    setSelectedUser(user)
    setNewPassword('')
    setIsResetPasswordOpen(true)
  }

  const openDeleteModal = (user: any) => {
    setSelectedUser(user)
    setIsDeleteOpen(true)
  }

  // Handle Form Submit: Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createEmail || !createPassword || !createFullName) {
      toast.error('Email, Password, and Full Name are required.')
      return
    }

    setActionLoading(true)
    try {
      const res = await createUserAction({
        email: createEmail.trim(),
        password: createPassword,
        fullName: createFullName.trim(),
        phone: createPhone.trim(),
        role: createRole,
        status: createStatus,
        subjectIds: createRole === 'admin' ? [] : createSubjects
      })

      if (res.success) {
        toast.success('User account created successfully!')
        setIsCreateOpen(false)
        refetchUsers()
      } else {
        toast.error(res.error || 'Failed to create user')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Form Submit: Edit User
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (!editEmail || !editFullName) {
      toast.error('Email and Full Name are required.')
      return
    }

    setActionLoading(true)
    try {
      const res = await updateUserAction(selectedUser.id, {
        email: editEmail.trim(),
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        status: editStatus,
        subjectIds: editRole === 'admin' ? [] : editSubjects
      })

      if (res.success) {
        toast.success('User details updated successfully!')
        setIsEditOpen(false)
        refetchUsers()
      } else {
        toast.error(res.error || 'Failed to update user')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Form Submit: Reset Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    setActionLoading(true)
    try {
      const res = await resetUserPasswordAction(selectedUser.id, newPassword)
      if (res.success) {
        toast.success(`Password updated for ${selectedUser.full_name}!`)
        setIsResetPasswordOpen(false)
      } else {
        toast.error(res.error || 'Failed to reset password')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Action: Delete User
  const handleDeleteUserConfirm = async () => {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      const res = await deleteUserAction(selectedUser.id)
      if (res.success) {
        toast.success('User account permanently deleted.')
        setIsDeleteOpen(false)
        refetchUsers()
      } else {
        toast.error(res.error || 'Failed to delete user account')
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  // Helper: Toggle subject selection
  const handleToggleSubjectCreate = (subId: string, checked: boolean) => {
    if (checked) {
      setCreateSubjects(prev => [...prev, subId])
    } else {
      setCreateSubjects(prev => prev.filter(id => id !== subId))
    }
  }

  const handleToggleSubjectEdit = (subId: string, checked: boolean) => {
    if (checked) {
      setEditSubjects(prev => [...prev, subId])
    } else {
      setEditSubjects(prev => prev.filter(id => id !== subId))
    }
  }

  // Helper: Password generator
  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCreatePassword(password)
    setNewPassword(password)
  }

  // Filter & Search users
  const filteredUsers = users.filter((user: any) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone && user.phone.includes(searchTerm))
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  // Counts for summary metrics
  const totalCount = users.length
  const adminCount = users.filter((u: any) => u.role === 'admin').length
  const mentorCount = users.filter((u: any) => u.role === 'mentor').length
  const studentCount = users.filter((u: any) => u.role === 'student').length

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      {/* Header and Add User Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-sm text-slate-400">Manage all application users including Admin, Mentor, and Student accounts.</p>
        </div>
        <div>
          <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-2">
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-600/10 flex items-center justify-center text-indigo-500">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Admins</p>
              <h3 className="text-2xl font-bold text-white mt-1">{adminCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-500">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Mentors</p>
              <h3 className="text-2xl font-bold text-white mt-1">{mentorCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cyan-600/10 flex items-center justify-center text-cyan-500">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Students</p>
              <h3 className="text-2xl font-bold text-white mt-1">{studentCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-600/10 flex items-center justify-center text-amber-500">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter panel */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value as any); setCurrentPage(1); }}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="mentor">Mentor</option>
                <option value="student">Student</option>
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-2">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">Showing page {currentPage} of {Math.max(1, totalPages)}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded p-1 focus:ring-indigo-500 outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="border-slate-800 text-slate-400 hover:bg-slate-900"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="border-slate-800 text-slate-400 hover:bg-slate-900"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Users List Table */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching user records...</span>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No users found matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">Contact</TableHead>
                    <TableHead className="text-slate-400">Role</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Registered</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user: any) => {
                    const fallbackChar = user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'
                    
                    // Style badges depending on role
                    let roleBadgeColor = 'bg-slate-800 text-slate-300'
                    if (user.role === 'admin') roleBadgeColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    if (user.role === 'mentor') roleBadgeColor = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    if (user.role === 'student') roleBadgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20'

                    // Style badges depending on status
                    let statusBadgeColor = 'bg-slate-800 text-slate-300'
                    if (user.status === 'approved') statusBadgeColor = 'bg-emerald-500/10 text-emerald-400'
                    if (user.status === 'pending') statusBadgeColor = 'bg-yellow-500/10 text-yellow-400'
                    if (user.status === 'rejected') statusBadgeColor = 'bg-rose-500/10 text-rose-400'

                    return (
                      <TableRow key={user.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-slate-800">
                              <AvatarFallback className="bg-indigo-950/60 text-indigo-400 text-xs font-bold">
                                {fallbackChar}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="block font-semibold text-white text-sm">{user.full_name}</span>
                              <span className="block text-xs text-slate-500">{user.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-300">{user.phone || 'N/A'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleBadgeColor}>{user.role.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeColor}>{user.status.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-400">
                            {new Date(user.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3.5">
                          <div className="flex justify-end gap-1.5">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openEditModal(user)}
                              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openResetPasswordModal(user)}
                              className="text-amber-500 hover:text-amber-400 hover:bg-slate-800 h-8 w-8 p-0"
                              title="Reset Password"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openDeleteModal(user)}
                              className="text-rose-500 hover:text-rose-400 hover:bg-slate-800 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG: Create User */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-lg">
          <form onSubmit={handleCreateUserSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create User Account</DialogTitle>
              <DialogDescription className="text-slate-400">
                Setup credentials and settings for a new user account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="create-name" className="text-xs text-slate-400">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                      id="create-name"
                      placeholder="e.g. John Doe"
                      value={createFullName}
                      onChange={(e) => setCreateFullName(e.target.value)}
                      className="pl-9 border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="create-phone" className="text-xs text-slate-400">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                      id="create-phone"
                      placeholder="e.g. +88017000000"
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      className="pl-9 border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-email" className="text-xs text-slate-400">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    id="create-email"
                    type="email"
                    placeholder="e.g. user@domain.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="pl-9 border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="create-pass" className="text-xs text-slate-400">Password</Label>
                <div className="flex gap-2">
                  <Input 
                    id="create-pass"
                    type="text"
                    placeholder="Provide a password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                    required
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleGeneratePassword}
                    className="border-slate-800 hover:bg-slate-900 shrink-0 text-xs text-slate-300"
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="create-role" className="text-xs text-slate-400">Account Role</Label>
                  <select
                    id="create-role"
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="mentor">Mentor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="create-status" className="text-xs text-slate-400">Status</Label>
                  <select
                    id="create-status"
                    value={createStatus}
                    disabled={createRole === 'admin'}
                    onChange={(e) => setCreateStatus(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Subject assignment panel (only for students and mentors) */}
              {createRole !== 'admin' && subjects.length > 0 && (
                <div className="space-y-2 border-t border-slate-800/80 pt-3">
                  <Label className="text-xs text-slate-400">Assign Subject Access</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {subjects.map((subject: any) => (
                      <div key={subject.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`create-sub-${subject.id}`}
                          checked={createSubjects.includes(subject.id)}
                          onCheckedChange={(checked) => handleToggleSubjectCreate(subject.id, !!checked)}
                          className="border-slate-800 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <label 
                          htmlFor={`create-sub-${subject.id}`} 
                          className="text-xs text-slate-300 font-medium truncate cursor-pointer hover:text-white"
                        >
                          {subject.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateOpen(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-900"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Edit User */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-lg">
          <form onSubmit={handleEditUserSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Edit User Details</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update account profile settings, status, and subjects.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-name" className="text-xs text-slate-400">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                      id="edit-name"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="pl-9 border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-phone" className="text-xs text-slate-400">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                      id="edit-phone"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="pl-9 border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-email" className="text-xs text-slate-400">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="pl-9 border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-role" className="text-xs text-slate-400">Account Role</Label>
                  <select
                    id="edit-role"
                    value={editRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as any
                      setEditRole(nextRole)
                      if (nextRole === 'admin') setEditStatus('approved')
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="mentor">Mentor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-status" className="text-xs text-slate-400">Status</Label>
                  <select
                    id="edit-status"
                    value={editStatus}
                    disabled={editRole === 'admin'}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-lg p-2.5 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Subject assignment panel (only for students and mentors) */}
              {editRole !== 'admin' && subjects.length > 0 && (
                <div className="space-y-2 border-t border-slate-800/80 pt-3">
                  <Label className="text-xs text-slate-400">Assign Subject Access</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {subjects.map((subject: any) => (
                      <div key={subject.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-sub-${subject.id}`}
                          checked={editSubjects.includes(subject.id)}
                          onCheckedChange={(checked) => handleToggleSubjectEdit(subject.id, !!checked)}
                          className="border-slate-800 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <label 
                          htmlFor={`edit-sub-${subject.id}`} 
                          className="text-xs text-slate-300 font-medium truncate cursor-pointer hover:text-white"
                        >
                          {subject.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditOpen(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-900"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Reset Password */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-sm">
          <form onSubmit={handleResetPasswordSubmit}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Reset Password</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update account password for <strong className="text-white">{selectedUser?.full_name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div className="space-y-1">
                <Label htmlFor="reset-pass" className="text-xs text-slate-400">New Password</Label>
                <div className="flex gap-2">
                  <Input 
                    id="reset-pass"
                    type="text"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="border-slate-800 bg-slate-900 text-white focus-visible:ring-indigo-500"
                    required
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleGeneratePassword}
                    className="border-slate-800 hover:bg-slate-900 shrink-0 text-xs text-slate-300"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-800/80 pt-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsResetPasswordOpen(false)}
                className="border-slate-800 text-slate-300 hover:bg-slate-900"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : 'Reset Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Confirm Delete */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white max-w-sm">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-center">Delete Account?</DialogTitle>
            <DialogDescription className="text-slate-400 text-center">
              Are you sure you want to permanently delete the account for <strong className="text-white">{selectedUser?.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-rose-400/90 bg-rose-500/5 border border-rose-500/10 rounded-lg p-3 my-2 text-center">
            Warning: This action will permanently remove the user from Supabase Authentication and cascade-delete all of their public profiles, registered settings, exam entries, results, and records. This action is irreversible.
          </p>

          <DialogFooter className="border-t border-slate-800/80 pt-3 flex sm:justify-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteOpen(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-900 flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleDeleteUserConfirm}
              disabled={actionLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white font-medium flex-1"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
