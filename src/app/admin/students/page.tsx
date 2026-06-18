'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { 
  updateStudentAdmin, 
  resetStudentAttempt, 
  deleteUserAccount, 
  resetUserPasswordAdmin,
  bulkUpdateStudentStatus,
  bulkDeleteUserAccounts,
  bulkAssignSubjectToStudents
} from '@/app/actions/student-admin'
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
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Filter, 
  Plus, 
  FileDown, 
  Upload, 
  Loader2, 
  Eye, 
  Check, 
  X, 
  Trash2, 
  RefreshCw,
  UserCheck,
  Award,
  Key
} from 'lucide-react'

const parseTextToRows = (
  text: string, 
  separator: 'space' | 'comma' | 'colon' | 'tab',
  format: 'simple' | 'full'
) => {
  const lines = text.split('\n')
  const rows: { email: string; password: string; fullName?: string; phone?: string }[] = []
  
  let splitRegex = /\s+/
  let sepChar = ' '
  if (separator === 'comma') {
    splitRegex = /,/
    sepChar = ','
  } else if (separator === 'colon') {
    splitRegex = /:/
    sepChar = ':'
  } else if (separator === 'tab') {
    splitRegex = /\t/
    sepChar = '\t'
  }
  
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    
    let parts: string[] = []
    if (separator === 'space') {
      parts = trimmed.split(/\s+/).map(p => p.trim()).filter(Boolean)
    } else {
      parts = trimmed.split(splitRegex).map(p => p.trim())
    }
    
    if (format === 'full') {
      if (parts.length >= 4) {
        const password = parts[parts.length - 1]
        const email = parts[parts.length - 2]
        const phone = parts[parts.length - 3]
        const fullName = parts.slice(0, parts.length - 3).join(separator === 'space' ? ' ' : sepChar)
        
        rows.push({
          email,
          password,
          fullName,
          phone
        })
      }
    } else {
      if (parts.length >= 2) {
        rows.push({
          email: parts[0],
          password: parts[1]
        })
      }
    }
  })
  return rows
}

export default function StudentsAdminPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Modal / Form states
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
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
  const [editNotes, setEditNotes] = useState<any[]>([])
  const [newNoteText, setNewNoteText] = useState('')

  // Bulk selection and actions state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Clear selection when filters or page changes
  useEffect(() => {
    setSelectedIds([])
  }, [searchTerm, statusFilter, subjectFilter, currentPage])

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [importReport, setImportReport] = useState<any>(null)
  const [bulkInputMode, setBulkInputMode] = useState<'text' | 'file'>('text')
  const [rawTextContent, setRawTextContent] = useState('')
  const [bulkIdType, setBulkIdType] = useState<'email' | 'phone'>('email')
  const [bulkSeparator, setBulkSeparator] = useState<'space' | 'comma' | 'colon' | 'tab'>('space')
  const [bulkFormat, setBulkFormat] = useState<'simple' | 'full'>('simple')
  const [bulkImportSubjectId, setBulkImportSubjectId] = useState<string>('')

  // Bulk subject assignment states
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false)
  const [bulkAssignSubjectId, setBulkAssignSubjectId] = useState('')
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false)

  // Fetch subjects
  const { data: subjects = [] as any[] } = useQuery({
    queryKey: ['admin-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*').order('name', { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  // Fetch students list
  const { data: students = [] as any[], isLoading: loadingStudents } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      // Fetch users with role='student'
      const { data: studentsData, error: studentError } = await supabase
        .from('users')
        .select(`
          *,
          student_subjects(subject_id)
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false })

      if (studentError) throw studentError
      return studentsData || []
    }
  })

  // Fetch student exam history (specifically for detailed view modal)
  const { data: studentHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['student-history', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent) return []
      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          exams (
            title,
            passing_marks
          )
        `)
        .eq('student_id', selectedStudent.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!selectedStudent
  })

  // Open edit modal and load data
  const handleOpenEdit = (student: any) => {
    setSelectedStudent(student)
    setEditName(student.full_name)
    setEditPhone(student.phone || '')
    setEditStatus(student.status)
    setEditSubjects(student.student_subjects?.map((ss: any) => ss.subject_id) || [])
    
    let parsed: any[] = []
    if (student.notes) {
      try {
        const data = JSON.parse(student.notes)
        if (Array.isArray(data)) {
          parsed = data
        } else {
          parsed = [{ id: 'legacy', text: student.notes, createdAt: student.updated_at || new Date().toISOString() }]
        }
      } catch {
        parsed = [{ id: 'legacy', text: student.notes, createdAt: student.updated_at || new Date().toISOString() }]
      }
    }
    setEditNotes(parsed)
    setNewNoteText('')
    setIsEditOpen(true)
  }

  // Save student modifications
  const handleSaveEdit = async () => {
    if (!selectedStudent) return
    try {
      const res = await updateStudentAdmin({
        studentId: selectedStudent.id,
        fullName: editName,
        phone: editPhone,
        status: editStatus,
        subjectIds: editSubjects,
        notes: JSON.stringify(editNotes)
      })

      if (res.success) {
        toast.success('Student profile updated!')
        setIsEditOpen(false)
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || 'Failed to update student')
      }
    } catch (err: any) {
      toast.error('Error occurred during update')
    }
  }

  const handleAddNote = () => {
    if (!newNoteText.trim()) return
    const newNote = {
      id: Math.random().toString(36).substring(2, 9),
      text: newNoteText.trim(),
      createdAt: new Date().toISOString()
    }
    setEditNotes(prev => [newNote, ...prev])
    setNewNoteText('')
  }

  const handleDeleteNote = (noteId: string) => {
    setEditNotes(prev => prev.filter(n => n.id !== noteId))
  }

  // Quick Approval change
  const handleApprovalChange = async (studentId: string, status: 'approved' | 'rejected') => {
    try {
      const student = students.find((s: any) => s.id === studentId)
      if (!student) return
      
      const subIds = student.student_subjects?.map((ss: any) => ss.subject_id) || []
      const res = await updateStudentAdmin({
        studentId,
        fullName: student.full_name,
        phone: student.phone || '',
        status,
        subjectIds: subIds
      })

      if (res.success) {
        toast.success(`Account application ${status}!`)
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || 'Failed to update status')
      }
    } catch (err) {
      toast.error('Connection failed')
    }
  }

  // Delete account
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this student account? All exam attempts and scores will be deleted.')) return
    try {
      const res = await deleteUserAccount(userId)
      if (res.success) {
        toast.success('Account deleted successfully')
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
        if (selectedStudent?.id === userId) setIsDetailOpen(false)
      } else {
        toast.error(res.error || 'Failed to delete account')
      }
    } catch (err) {
      toast.error('Deletion error')
    }
  }

  // Reset exam attempt
  const handleResetAttempt = async (examId: string) => {
    if (!selectedStudent) return
    if (!confirm('Are you sure you want to delete this result? The student will be allowed to retake this exam.')) return
    try {
      const res = await resetStudentAttempt(selectedStudent.id, examId)
      if (res.success) {
        toast.success('Exam attempt reset successfully!')
        refetchHistory()
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || 'Failed to reset attempt')
      }
    } catch (err) {
      toast.error('Reset attempt error')
    }
  }

  // Handle individual selection toggle
  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, studentId])
    } else {
      setSelectedIds(prev => prev.filter(id => id !== studentId))
    }
  }

  // Handle page-level selection toggle
  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedStudents.map(s => s.id)
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])))
    } else {
      const pageIds = paginatedStudents.map(s => s.id)
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)))
    }
  }

  // Handle bulk status updates
  const handleBulkStatusChange = async (status: 'approved' | 'rejected') => {
    if (selectedIds.length === 0) return
    setBulkActionLoading(true)
    try {
      const res = await bulkUpdateStudentStatus(selectedIds, status)
      if (res.success) {
        toast.success(`Successfully ${status} ${selectedIds.length} students!`)
        setSelectedIds([])
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || `Failed to update status in bulk`)
      }
    } catch (err) {
      toast.error('Bulk update error')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Handle bulk delete operations
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Are you sure you want to permanently delete these ${selectedIds.length} student accounts? All attempts, marks, and profiles will be lost.`)) return
    setBulkActionLoading(true)
    try {
      const res = await bulkDeleteUserAccounts(selectedIds)
      if (res.success) {
        toast.success(`Successfully deleted ${selectedIds.length} students!`)
        setSelectedIds([])
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || `Failed to delete students in bulk`)
      }
    } catch (err) {
      toast.error('Bulk delete error')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Handle bulk subject assignment
  const handleBulkAssignSubject = async () => {
    if (selectedIds.length === 0) return
    if (!bulkAssignSubjectId) {
      toast.error('Please select a subject to assign')
      return
    }
    setBulkAssignLoading(true)
    try {
      const res = await bulkAssignSubjectToStudents(selectedIds, bulkAssignSubjectId)
      if (res.success) {
        toast.success(`Successfully assigned subject to ${selectedIds.length} students!`)
        setSelectedIds([])
        setIsBulkAssignOpen(false)
        setBulkAssignSubjectId('')
        queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      } else {
        toast.error(res.error || `Failed to assign subject in bulk`)
      }
    } catch (err) {
      toast.error('Bulk subject assignment error')
    } finally {
      setBulkAssignLoading(false)
    }
  }

  const getSeparatorChar = (sep: 'space' | 'comma' | 'colon' | 'tab') => {
    if (sep === 'comma') return ','
    if (sep === 'colon') return ':'
    if (sep === 'tab') return '\t'
    return ' '
  }

  const getDummyData = (
    idType: 'email' | 'phone', 
    sep: 'space' | 'comma' | 'colon' | 'tab',
    format: 'simple' | 'full'
  ) => {
    const char = getSeparatorChar(sep)
    if (format === 'full') {
      return `John Doe${char}01712345678${char}john.doe@gmail.com${char}pass123\nRahim Ali${char}01987654321${char}rahim.ali@gmail.com${char}pass456\nKarim Khan${char}01888888888${char}karim.khan@gmail.com${char}pass789`
    }
    if (idType === 'email') {
      return `student1@gmail.com${char}pass123\nstudent2@gmail.com${char}pass456\nstudent3@gmail.com${char}pass789`
    } else {
      return `01712345678${char}pass123\n01987654321${char}pass456\n01888888888${char}pass789`
    }
  }

  // Bulk Ingestion handling (CSV, TXT, or Pasted Text)
  const handleBulkImport = async () => {
    setBulkUploading(true)
    setImportReport(null)

    let parsedRows: any[] = []

    try {
      if (bulkInputMode === 'text') {
        if (!rawTextContent.trim()) {
          toast.error('Please enter student credentials first')
          setBulkUploading(false)
          return
        }
        parsedRows = parseTextToRows(rawTextContent, bulkSeparator, bulkFormat)
      } else {
        if (!csvFile) {
          toast.error('Please select a file first')
          setBulkUploading(false)
          return
        }

        const fileExt = csvFile.name.split('.').pop()?.toLowerCase()
        if (fileExt === 'txt') {
          const fileText = await csvFile.text()
          parsedRows = parseTextToRows(fileText, bulkSeparator, bulkFormat)
        } else if (fileExt === 'csv') {
          await new Promise<void>((resolve, reject) => {
            Papa.parse(csvFile, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                const rows = results.data as any[]
                if (bulkFormat === 'full') {
                  parsedRows = rows
                    .map((row) => {
                      const fullName = row.fullName || row.FullName || row.name || row.Name || row.full_name || Object.values(row)[0]
                      const phone = row.phone || row.Phone || row.mobile || row.Mobile || row.phone_number || Object.values(row)[1]
                      const email = row.email || row.Email || row.email_address || Object.values(row)[2]
                      const password = row.password || row.Password || Object.values(row)[3]
                      return {
                        fullName: typeof fullName === 'string' ? fullName.trim() : '',
                        phone: typeof phone === 'string' ? phone.trim() : '',
                        email: typeof email === 'string' ? email.trim() : '',
                        password: typeof password === 'string' ? password.trim() : '',
                      }
                    })
                    .filter((r) => r.email || r.phone)
                } else {
                  parsedRows = rows
                    .map((row) => {
                      const email = row.email || row.Email || row.email_address || Object.values(row)[0]
                      const password = row.password || row.Password || Object.values(row)[1]
                      return {
                        email: typeof email === 'string' ? email.trim() : '',
                        password: typeof password === 'string' ? password.trim() : '',
                      }
                    })
                    .filter((r) => r.email && r.password)
                }
                resolve()
              },
              error: (err) => reject(err),
            })
          })
        } else {
          toast.error('Unsupported file format. Please upload .csv or .txt file.')
          setBulkUploading(false)
          return
        }
      }

      if (parsedRows.length === 0) {
        toast.error('No credentials parsed. Make sure your input format matches the selected format.')
        setBulkUploading(false)
        return
      }

      const report = await bulkImportUsers(parsedRows, 'student', bulkImportSubjectId || undefined)
      setImportReport(report)
      toast.success(`Import finished! Created: ${report.successCount}, Failed: ${report.failedRows.length}`)
      queryClient.invalidateQueries({ queryKey: ['admin-students'] })
      
      // Clear inputs on success
      if (report.successCount > 0) {
        setRawTextContent('')
        setCsvFile(null)
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message || err}`)
    } finally {
      setBulkUploading(false)
    }
  }

  // Subject list toggle inside editing
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
  const handleOpenResetPassword = (student: any) => {
    setSelectedStudent(student)
    setNewPassword('')
    setIsResetPasswordOpen(true)
  }

  // Handle password reset submit
  const handleResetPasswordSubmit = async () => {
    if (!selectedStudent || !newPassword) {
      toast.error('Please enter a new password')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setResettingPassword(true)
    try {
      const res = await resetUserPasswordAdmin(selectedStudent.id, newPassword)
      if (res.success) {
        toast.success(`Password for ${selectedStudent.full_name} has been reset successfully!`)
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

  // Filter students based on search, status, and subjects
  const filteredStudents = students.filter((student: any) => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter
    
    const matchesSubject = subjectFilter === 'all' || student.student_subjects?.some((ss: any) => ss.subject_id === subjectFilter)

    return matchesSearch && matchesStatus && matchesSubject
  })

  // Pagination
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Export to CSV helper
  const handleExportCSV = () => {
    const csvRows = filteredStudents.map((s: any) => ({
      Name: s.full_name,
      Email: s.email,
      Phone: s.phone || '',
      Status: s.status,
      SubjectsCount: s.student_subjects?.length || 0,
      RegistrationDate: new Date(s.created_at).toLocaleDateString()
    }))

    const csvContent = Papa.unparse(csvRows)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'SH_TECH_ZONE_Students.csv')
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Student Management</h1>
          <p className="text-sm text-slate-400">View profiles, approve registrations, configure subjects, and import lists.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2" onClick={handleExportCSV}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2" onClick={() => setIsBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import (CSV)
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
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

            {/* Subject Filter */}
            <select
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
            >
              <option value="all">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
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
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={36}>36</option>
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
        )}
      </div>

      {/* Main Student List Table */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loadingStudents ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching student accounts...</span>
            </div>
          ) : paginatedStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No student accounts found matching the filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox 
                        checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.includes(s.id))}
                        onCheckedChange={(checked) => handleSelectAllOnPage(!!checked)}
                        className="border-slate-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Email / Phone</TableHead>
                    <TableHead className="text-slate-400">Registered Subjects</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Notes (মন্তব্য)</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((student: any) => {
                    const fallbackChar = student.full_name.charAt(0).toUpperCase()
                    const isSelected = selectedIds.includes(student.id)
                    return (
                      <TableRow 
                        key={student.id} 
                        className={`border-b border-slate-800/60 transition-colors duration-150 ${isSelected ? 'bg-indigo-950/10 hover:bg-indigo-950/15' : 'hover:bg-slate-900/40'}`}
                      >
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectStudent(student.id, !!checked)}
                            className="border-slate-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                          />
                        </TableCell>
                        {/* Profile Photo & Name */}
                        <TableCell className="font-medium flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-indigo-500/20">
                            <AvatarImage src={student.profile_picture || ''} className="object-cover" />
                            <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                              {fallbackChar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white font-medium">{student.full_name}</span>
                        </TableCell>
                        
                        {/* Email & Phone */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-slate-300 text-sm">{student.email}</span>
                            <span className="text-slate-500 text-xs">{student.phone || 'No phone'}</span>
                          </div>
                        </TableCell>

                        {/* Subjects count badge */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {student.student_subjects && student.student_subjects.length > 0 ? (
                              student.student_subjects.map((ss: any) => {
                                const sub = subjects.find((s) => s.id === ss.subject_id)
                                return sub ? (
                                  <Badge key={ss.subject_id} variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-400 font-normal">
                                    {sub.name}
                                  </Badge>
                                ) : null
                              })
                            ) : (
                              <span className="text-slate-500 text-xs">None</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={
                              student.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : student.status === 'rejected'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }
                          >
                            {student.status}
                          </Badge>
                        </TableCell>

                        {/* Notes Cell */}
                        {/* Notes Cell */}
                        <TableCell className="max-w-[150px] truncate">
                          {(() => {
                            if (!student.notes) {
                              return (
                                <span 
                                  className="text-xs text-slate-500 italic cursor-pointer hover:underline hover:text-slate-400" 
                                  onClick={() => handleOpenEdit(student)}
                                >
                                  No notes
                                </span>
                              )
                            }
                            try {
                              const parsed = JSON.parse(student.notes)
                              if (Array.isArray(parsed) && parsed.length > 0) {
                                return (
                                  <span 
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer hover:underline" 
                                    onClick={() => handleOpenEdit(student)}
                                    title={parsed.map((n: any) => `• ${n.text}`).join('\n')}
                                  >
                                    ({parsed.length}) {parsed[0].text}
                                  </span>
                                )
                              }
                              return (
                                <span 
                                  className="text-xs text-slate-300 cursor-pointer hover:underline" 
                                  onClick={() => handleOpenEdit(student)}
                                  title={student.notes}
                                >
                                  {student.notes}
                                </span>
                              )
                            } catch {
                              return (
                                <span 
                                  className="text-xs text-slate-300 cursor-pointer hover:underline" 
                                  onClick={() => handleOpenEdit(student)}
                                  title={student.notes}
                                >
                                  {student.notes}
                                </span>
                              )
                            }
                          })()}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {student.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprovalChange(student.id, 'approved')}
                                  className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprovalChange(student.id, 'rejected')}
                                  className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedStudent(student); setIsDetailOpen(true); }}
                              className="h-8 w-8 text-slate-400 hover:text-white"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenResetPassword(student)}
                              className="h-8 w-8 text-amber-400 hover:text-white"
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(student)}
                              className="h-8 w-8 text-indigo-400 hover:text-white"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(student.id)}
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

      {/* Modal 1: Student Detail View */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Student Profile Details</DialogTitle>
            <DialogDescription className="text-slate-400">View registration info, subjects, and complete exam history.</DialogDescription>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-6">
              {/* Profile Card Summary */}
              <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                <Avatar className="h-16 w-16 border border-indigo-500/40">
                  <AvatarImage src={selectedStudent.profile_picture || ''} className="object-cover" />
                  <AvatarFallback className="bg-indigo-600 text-white font-bold text-lg">
                    {selectedStudent.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg text-white">{selectedStudent.full_name}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.email}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Joined on: {new Date(selectedStudent.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Subscribed Subjects */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Registered Subjects</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudent.student_subjects && selectedStudent.student_subjects.length > 0 ? (
                    selectedStudent.student_subjects.map((ss: any) => {
                      const sub = subjects.find((s) => s.id === ss.subject_id)
                      return sub ? (
                        <Badge key={ss.subject_id} className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-medium">
                          {sub.name}
                        </Badge>
                      ) : null
                    })
                  ) : (
                    <span className="text-xs text-slate-500">No subjects assigned</span>
                  )}
                </div>
              </div>

              {/* Exam & Score History */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Exam Attempts & Results</h4>
                {studentHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    No examination records found for this student.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg">
                    <Table>
                      <TableHeader className="bg-slate-950/40">
                        <TableRow>
                          <TableHead className="text-xs text-slate-400">Exam</TableHead>
                          <TableHead className="text-xs text-slate-400 text-center">Score</TableHead>
                          <TableHead className="text-xs text-slate-400 text-center">Percentage</TableHead>
                          <TableHead className="text-xs text-slate-400 text-center">Result</TableHead>
                          <TableHead className="text-xs text-slate-400 text-right">Reset</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentHistory.map((history: any) => (
                          <TableRow key={history.id} className="hover:bg-slate-900/40">
                            <TableCell className="text-xs font-medium text-white">{history.exams?.title || 'Unknown Exam'}</TableCell>
                            <TableCell className="text-xs text-center text-slate-300">
                              {history.obtained_marks} / {history.total_marks}
                            </TableCell>
                            <TableCell className="text-xs text-center text-slate-300">{history.percentage}%</TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge className={history.is_passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}>
                                {history.is_passed ? 'Pass' : 'Fail'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResetAttempt(history.exam_id)}
                                className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                                title="Reset Student Attempt"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-slate-800 text-slate-300">
              Close Detail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Edit Student Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Student Profile & Subjects</DialogTitle>
            <DialogDescription className="text-slate-400">Modify information, registration status, and subject access.</DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              {/* Left Column: Profile Info & Subjects */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Registration Status</Label>
                  <select
                    id="edit-status"
                    value={editStatus}
                    onChange={(e: any) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Registered Subjects</Label>
                  <div className="grid grid-cols-1 gap-2 border border-slate-800 bg-slate-950/60 p-3 rounded-lg max-h-40 overflow-y-auto">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-sub-${sub.id}`}
                          checked={editSubjects.includes(sub.id)}
                          onCheckedChange={(checked) => handleToggleSubject(sub.id, !!checked)}
                        />
                        <Label htmlFor={`edit-sub-${sub.id}`} className="text-slate-300 text-sm cursor-pointer select-none">
                          {sub.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Administrative Notes History */}
              <div className="space-y-4 flex flex-col h-full border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-semibold text-slate-200">Administrative Notes (মন্তব্য ইতিহাস)</Label>
                  {editNotes.length > 0 && (
                    <span className="text-[10px] text-indigo-400 font-medium">({editNotes.length} notes)</span>
                  )}
                </div>

                {/* Add New Note Box */}
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                  <Textarea
                    placeholder="নতুন মন্তব্য লিখুন..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white text-xs min-h-[60px] resize-none"
                  />
                  <Button
                    type="button"
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-8"
                  >
                    Add Note (মন্তব্য যোগ করুন)
                  </Button>
                </div>

                {/* Notes History Scroll Area */}
                <div className="flex-1 overflow-y-auto max-h-[180px] space-y-2 pr-1 custom-scrollbar">
                  {editNotes.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 italic">
                      No notes recorded for this student.
                    </div>
                  ) : (
                    editNotes.map((note) => (
                      <div 
                        key={note.id} 
                        className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-lg space-y-1 relative group hover:border-slate-700 transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-slate-500 font-mono">
                            {new Date(note.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded transition-colors"
                            title="Delete Note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 break-words whitespace-pre-wrap leading-relaxed">
                          {note.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Bulk Import Student Modal */}
      <Dialog open={isBulkOpen} onOpenChange={(open) => { setIsBulkOpen(open); if(!open) setImportReport(null); }}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bulk Student Ingestion</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create multiple student accounts quickly using text pasting or file uploads.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={bulkInputMode} onValueChange={(val: any) => setBulkInputMode(val)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-950 border border-slate-800 p-1 mb-4">
              <TabsTrigger value="text" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs">
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="file" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs">
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              {/* Configuration Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-format" className="text-[11px] text-slate-400">Data Format (তথ্য বিন্যাস)</Label>
                  <select
                    id="bulk-format"
                    value={bulkFormat}
                    onChange={(e: any) => setBulkFormat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="simple">Simple (Identifier + Password)</option>
                    <option value="full">Full Details (Name + Phone + Email + Password)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bulk-id-type" className={`text-[11px] text-slate-400 ${bulkFormat === 'full' ? 'opacity-40' : ''}`}>Username/Identifier Type</Label>
                  <select
                    id="bulk-id-type"
                    value={bulkIdType}
                    disabled={bulkFormat === 'full'}
                    onChange={(e: any) => setBulkIdType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-40"
                  >
                    <option value="email">Email Addresses (যেমন: student@gmail.com)</option>
                    <option value="phone">Phone Numbers (যেমন: 01712345678)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bulk-separator" className="text-[11px] text-slate-400">Separator character (বিভাজক চিহ্ন)</Label>
                  <select
                    id="bulk-separator"
                    value={bulkSeparator}
                    onChange={(e: any) => setBulkSeparator(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="space">Space (ফাঁকা স্পেস)</option>
                    <option value="comma">Comma ( , )</option>
                    <option value="colon">Colon ( : )</option>
                    <option value="tab">Tab</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bulk-import-subject" className="text-[11px] text-slate-400">Assign Subject (অপশনাল)</Label>
                  <select
                    id="bulk-import-subject"
                    value={bulkImportSubjectId}
                    onChange={(e: any) => setBulkImportSubjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  >
                    <option value="">None (কোনটিই নয়)</option>
                    {subjects.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulk-text" className="text-slate-300">Pasted Credentials List</Label>
                <div className="text-[10px] text-slate-400 pb-1 leading-relaxed">
                  {bulkFormat === 'full' 
                    ? 'প্রতি লাইনে স্টুডেন্টের Name, Phone, Email এবং Password দিন (সিলেক্টেড বিভাজক চিহ্ন দিয়ে আলাদা করে)।'
                    : 'পছন্দমত ফরম্যাটে স্টুডেন্ট লিস্ট পেস্ট করুন। প্রতি লাইনে একজন স্টুডেন্ট থাকতে হবে।'}
                </div>
                <Textarea
                  id="bulk-text"
                  placeholder={getDummyData(bulkIdType, bulkSeparator, bulkFormat)}
                  value={rawTextContent}
                  onChange={(e) => setRawTextContent(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 min-h-[140px] font-mono text-xs"
                />
              </div>

              {/* Dynamic Dummy Copyable Data */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-slate-400">Copyable Dummy Data Example:</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const dummy = getDummyData(bulkIdType, bulkSeparator, bulkFormat);
                      navigator.clipboard.writeText(dummy);
                      toast.success("Example data copied to clipboard!");
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Copy Example
                  </button>
                </div>
                <pre 
                  onClick={() => {
                    const dummy = getDummyData(bulkIdType, bulkSeparator, bulkFormat);
                    navigator.clipboard.writeText(dummy);
                    toast.success("Example data copied to clipboard!");
                  }}
                  className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-[11px] font-mono text-slate-300 select-all cursor-pointer hover:border-slate-700/80 transition-colors" 
                  title="Click to copy example"
                >
                  {getDummyData(bulkIdType, bulkSeparator, bulkFormat)}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file" className="text-slate-300">Select File (.csv or .txt)</Label>
                <div className="text-[10px] text-slate-400 pb-1 leading-relaxed">
                  Upload a <strong>.csv</strong> file containing columns `email` & `password` or a <strong>.txt</strong> file formatted with credentials.
                </div>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>

          {importReport && (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5 mt-2">
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

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setIsBulkOpen(false); setImportReport(null); }} className="border-slate-800 text-slate-300 text-xs">
              Close
            </Button>
            <Button onClick={handleBulkImport} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs" disabled={bulkUploading}>
              {bulkUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Students'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Reset Account Password</DialogTitle>
            <DialogDescription className="text-slate-400">
              Set a new password for {selectedStudent?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
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

      {/* Floating Premium Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-950/85 backdrop-blur-xl border border-indigo-500/30 px-6 py-4 rounded-2xl shadow-2xl shadow-indigo-500/20 max-w-2xl w-[90%] sm:w-auto transition-all animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-400">{selectedIds.length}</span>
              </div>
              <span className="text-sm text-slate-200 font-medium font-sans">Selected Students</span>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('approved')}
                disabled={bulkActionLoading}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs gap-1.5 h-9 font-medium"
              >
                {bulkActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('rejected')}
                disabled={bulkActionLoading}
                className="bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400 hover:text-amber-300 text-xs gap-1.5 h-9 font-medium"
              >
                {bulkActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                Reject
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                className="bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 hover:text-red-300 text-xs gap-1.5 h-9 font-medium"
              >
                {bulkActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkAssignOpen(true)}
                disabled={bulkActionLoading}
                className="bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-400 hover:text-indigo-300 text-xs gap-1.5 h-9 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Assign Subject
              </Button>
              <div className="h-5 w-[1px] bg-slate-800 mx-1 hidden sm:block" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                disabled={bulkActionLoading}
                className="text-slate-400 hover:text-white hover:bg-slate-900 text-xs h-9 font-medium"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Bulk Assign Subject Dialog */}
      <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Bulk Assign Subject</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a subject to assign to the {selectedIds.length} selected student accounts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-assign-subject-select">Select Subject</Label>
              <select
                id="bulk-assign-subject-select"
                value={bulkAssignSubjectId}
                onChange={(e) => setBulkAssignSubjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="">-- Choose Subject --</option>
                {subjects.map((sub: any) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setIsBulkAssignOpen(false); setBulkAssignSubjectId(''); }} 
              className="border-slate-800 text-slate-300"
              disabled={bulkAssignLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBulkAssignSubject} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={bulkAssignLoading || !bulkAssignSubjectId}
            >
              {bulkAssignLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Subject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
