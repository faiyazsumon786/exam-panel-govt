'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { updateMentorAdmin } from '@/app/actions/mentor-admin'
import { deleteUserAccount, resetUserPasswordAdmin } from '@/app/actions/student-admin'
import { bulkImportUsers } from '@/app/actions/bulk-upload'
import Papa from 'papaparse'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Search, 
  Upload, 
  Loader2, 
  Check, 
  X, 
  Trash2, 
  Plus, 
  FileDown,
  Key
} from 'lucide-react'

export default function MentorsAdminPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal / Form states
  const [selectedMentor, setSelectedMentor] = useState<any>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)

  // Password Reset states
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)

  // Edit fields
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [editSubjects, setEditSubjects] = useState<string[]>([])

  // Bulk Upload states
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [importReport, setImportReport] = useState<any>(null)

  // Fetch subjects
  const { data: subjects = [] as any[] } = useQuery({
    queryKey: ['admin-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*').order('name', { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  // Fetch mentors list
  const { data: mentors = [] as any[], isLoading: loadingMentors } = useQuery({
    queryKey: ['admin-mentors'],
    queryFn: async () => {
      const { data: mentorsData, error } = await supabase
        .from('users')
        .select(`
          *,
          mentor_subjects(subject_id)
        `)
        .eq('role', 'mentor')
        .order('created_at', { ascending: false })

      if (error) throw error
      return mentorsData || []
    }
  })

  // Open edit modal
  const handleOpenEdit = (mentor: any) => {
    setSelectedMentor(mentor)
    setEditName(mentor.full_name)
    setEditPhone(mentor.phone || '')
    setEditStatus(mentor.status)
    setEditSubjects(mentor.mentor_subjects?.map((ms: any) => ms.subject_id) || [])
    setIsEditOpen(true)
  }

  // Save changes
  const handleSaveEdit = async () => {
    if (!selectedMentor) return
    try {
      const res = await updateMentorAdmin({
        mentorId: selectedMentor.id,
        fullName: editName,
        phone: editPhone,
        status: editStatus,
        subjectIds: editSubjects
      })

      if (res.success) {
        toast.success('Mentor profile updated!')
        setIsEditOpen(false)
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] })
      } else {
        toast.error(res.error || 'Failed to update mentor')
      }
    } catch (err: any) {
      toast.error('Error updating profile')
    }
  }

  // Quick Status change
  const handleApprovalChange = async (mentorId: string, status: 'approved' | 'rejected') => {
    try {
      const mentor = mentors.find((m: any) => m.id === mentorId)
      if (!mentor) return
      
      const subIds = mentor.mentor_subjects?.map((ms: any) => ms.subject_id) || []
      const res = await updateMentorAdmin({
        mentorId,
        fullName: mentor.full_name,
        phone: mentor.phone || '',
        status,
        subjectIds: subIds
      })

      if (res.success) {
        toast.success(`Mentor application ${status}!`)
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] })
      } else {
        toast.error(res.error || 'Failed to change status')
      }
    } catch (err) {
      toast.error('Operation failed')
    }
  }

  // Delete account
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this mentor account?')) return
    try {
      const res = await deleteUserAccount(userId)
      if (res.success) {
        toast.success('Account deleted successfully')
        queryClient.invalidateQueries({ queryKey: ['admin-mentors'] })
      } else {
        toast.error(res.error || 'Failed to delete account')
      }
    } catch (err) {
      toast.error('Deletion error')
    }
  }

  // Bulk Import CSV handling
  const handleBulkImport = () => {
    if (!csvFile) {
      toast.error('Please select a CSV file first')
      return
    }

    setBulkUploading(true)
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[]
        const validRows = rows.map((row) => {
          const email = row.email || row.Email || row.email_address
          const password = row.password || row.Password
          return { email: email?.trim(), password: password?.trim() }
        })

        try {
          const report = await bulkImportUsers(validRows, 'mentor')
          setImportReport(report)
          toast.success(`Import finished! Created: ${report.successCount}, Failed: ${report.failedRows.length}`)
          queryClient.invalidateQueries({ queryKey: ['admin-mentors'] })
        } catch (err: any) {
          toast.error(`Import failed: ${err.message}`)
        } finally {
          setBulkUploading(false)
        }
      },
      error: () => {
        toast.error('Error reading CSV file')
        setBulkUploading(false)
      }
    })
  }

  // Subject selection toggle
  const handleToggleSubject = (subId: string, checked: boolean) => {
    const next = [...editSubjects]
    if (checked) {
      next.push(subId)
    } else {
      const idx = next.indexOf(subId)
      if (idx > -1) next.splice(idx, 1)
    }
    setEditSubjects(next)
  }

  // Generate random password helper
  const handleGeneratePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPassword(password)
  }

  // Open reset password modal
  const handleOpenResetPassword = (mentor: any) => {
    setSelectedMentor(mentor)
    setNewPassword('')
    setIsResetPasswordOpen(true)
  }

  // Handle password reset submit
  const handleResetPasswordSubmit = async () => {
    if (!selectedMentor || !newPassword) {
      toast.error('Please enter a new password')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setResettingPassword(true)
    try {
      const res = await resetUserPasswordAdmin(selectedMentor.id, newPassword)
      if (res.success) {
        toast.success(`Password for ${selectedMentor.full_name} has been reset successfully!`)
        setIsResetPasswordOpen(false)
      } else {
        toast.error(res.error || 'Failed to reset password')
      }
    } catch (err) {
      toast.error('Connection error occurred')
    } finally {
      setResettingPassword(false)
    }
  }

  // Filter mentors
  const filteredMentors = mentors.filter((mentor: any) => 
    mentor.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mentor.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredMentors.length / itemsPerPage)
  const paginatedMentors = filteredMentors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mentor Management</h1>
          <p className="text-sm text-slate-400">Manage mentor registration approvals, profile details, and subject assignments.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2" onClick={() => setIsBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import (CSV)
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
            />
          </div>
        </div>
      </Card>

      {/* Mentor Table */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loadingMentors ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching mentors list...</span>
            </div>
          ) : paginatedMentors.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No mentors found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Email / Phone</TableHead>
                    <TableHead className="text-slate-400">Assigned Subjects</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMentors.map((mentor: any) => {
                    const fallbackChar = mentor.full_name.charAt(0).toUpperCase()
                    return (
                      <TableRow key={mentor.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                        <TableCell className="font-medium flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-indigo-500/20">
                            <AvatarImage src={mentor.profile_picture || ''} className="object-cover" />
                            <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                              {fallbackChar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white font-medium">{mentor.full_name}</span>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-slate-300 text-sm">{mentor.email}</span>
                            <span className="text-slate-500 text-xs">{mentor.phone || 'No phone'}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {mentor.mentor_subjects && mentor.mentor_subjects.length > 0 ? (
                              mentor.mentor_subjects.map((ms: any) => {
                                const sub = subjects.find((s) => s.id === ms.subject_id)
                                return sub ? (
                                  <Badge key={ms.subject_id} variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-normal">
                                    {sub.name}
                                  </Badge>
                                ) : null
                              })
                            ) : (
                              <span className="text-slate-500 text-xs">None</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge 
                            className={
                              mentor.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : mentor.status === 'rejected'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }
                          >
                            {mentor.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {mentor.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprovalChange(mentor.id, 'approved')}
                                  className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprovalChange(mentor.id, 'rejected')}
                                  className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenResetPassword(mentor)}
                              className="h-8 w-8 text-amber-400 hover:text-white"
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(mentor)}
                              className="h-8 w-8 text-indigo-400 hover:text-white"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(mentor.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-500">Showing page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="border-slate-800 text-slate-400"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="border-slate-800 text-slate-400"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modal 1: Edit Mentor Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Edit Mentor Profile & Subjects</h3>
              <p className="text-xs text-slate-400">Modify personal information, approval status, and subject assignments.</p>
            </div>

            {selectedMentor && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-mentor-name">Full Name</Label>
                  <Input
                    id="edit-mentor-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-mentor-phone">Phone Number</Label>
                  <Input
                    id="edit-mentor-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-mentor-status">Registration Status</Label>
                  <select
                    id="edit-mentor-status"
                    value={editStatus}
                    onChange={(e: any) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Assigned Subjects</Label>
                  <div className="grid grid-cols-2 gap-2 border border-slate-800 bg-slate-950/60 p-3 rounded-lg max-h-40 overflow-y-auto">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-mentor-sub-${sub.id}`}
                          checked={editSubjects.includes(sub.id)}
                          onCheckedChange={(checked) => handleToggleSubject(sub.id, !!checked)}
                        />
                        <Label htmlFor={`edit-mentor-sub-${sub.id}`} className="text-slate-300 text-sm cursor-pointer select-none">
                          {sub.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Bulk Import Mentor Modal */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Bulk Mentor Ingestion</h3>
              <p className="text-xs text-slate-400">Upload a CSV file containing columns: `email` and `password`. Mentors will be created and auto-approved.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mentor-csv-file">Select CSV File</Label>
                <Input
                  id="mentor-csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              {importReport && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5">
                  <p className="font-semibold text-emerald-400">Import Finished Report:</p>
                  <p>Successful Accounts Created: <span className="text-white font-bold">{importReport.successCount}</span></p>
                  {importReport.failedRows.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-red-400 font-semibold">Failed Rows:</p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5 font-mono text-[10px] text-slate-400 bg-slate-950 p-1.5 rounded">
                        {importReport.failedRows.map((err: any, idx: number) => (
                          <p key={idx}>Row {err.row}: {err.email} - {err.reason}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-emerald-400 font-medium">All accounts created successfully!</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setIsBulkOpen(false); setImportReport(null); }} className="border-slate-800 text-slate-300">
                Close
              </Button>
              <Button onClick={handleBulkImport} className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={bulkUploading}>
                {bulkUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Mentors'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Reset Account Password</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set a new password for {selectedMentor?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="mentor-new-password">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="mentor-new-password"
                  type="text"
                  placeholder="Enter or generate password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleGeneratePassword}
                  className="border-slate-800 text-slate-300 hover:bg-slate-900"
                >
                  Generate
                </Button>
              </div>
              <p className="text-[10px] text-slate-500">
                Minimum 6 characters. The user will be notified of the reset.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsResetPasswordOpen(false)} 
              className="border-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResetPasswordSubmit} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={resettingPassword}
            >
              {resettingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
