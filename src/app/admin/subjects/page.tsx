'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { createSubject, updateSubject, deleteSubject } from '@/app/actions/subjects'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  Users, 
  GraduationCap 
} from 'lucide-react'

export default function SubjectsAdminPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Modal / Form state
  const [isOpen, setIsOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<any>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch subjects with student & mentor counts
  const { data: subjects = [] as any[], isLoading } = useQuery({
    queryKey: ['admin-subjects-details'],
    queryFn: async () => {
      // Fetch subjects
      const { data: subjectsData, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      const enrichedSubjects = []
      for (const sub of (subjectsData as any[]) || []) {
        // Count students
        const { count: studentCount } = await supabase
          .from('student_subjects')
          .select('*', { count: 'exact', head: true })
          .eq('subject_id', sub.id)

        // Count mentors
        const { count: mentorCount } = await supabase
          .from('mentor_subjects')
          .select('*', { count: 'exact', head: true })
          .eq('subject_id', sub.id)

        enrichedSubjects.push({
          ...sub,
          studentCount: studentCount || 0,
          mentorCount: mentorCount || 0,
        })
      }

      return enrichedSubjects
    }
  })

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingSubject(null)
    setName('')
    setDescription('')
    setIsOpen(true)
  }

  // Open modal for Edit
  const handleOpenEdit = (subject: any) => {
    setEditingSubject(subject)
    setName(subject.name)
    setDescription(subject.description || '')
    setIsOpen(true)
  }

  // Handle Save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Subject name is required')
      return
    }

    setSaving(true)
    try {
      let res
      if (editingSubject) {
        res = await updateSubject(editingSubject.id, name, description)
      } else {
        res = await createSubject(name, description)
      }

      if (res.success) {
        toast.success(editingSubject ? 'Subject updated!' : 'Subject created!')
        setIsOpen(false)
        queryClient.invalidateQueries({ queryKey: ['admin-subjects-details'] })
      } else {
        toast.error(res.error || 'Failed to save subject')
      }
    } catch (err: any) {
      toast.error('Connection error')
    } finally {
      setSaving(false)
    }
  }

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject? All linked exams, question banks, and progress records will be deleted.')) return
    try {
      const res = await deleteSubject(id)
      if (res.success) {
        toast.success('Subject deleted!')
        queryClient.invalidateQueries({ queryKey: ['admin-subjects-details'] })
      } else {
        toast.error(res.error || 'Failed to delete subject')
      }
    } catch (err) {
      toast.error('Error deleting subject')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subject Management</h1>
          <p className="text-sm text-slate-400">Add academic subjects, define curriculum, and assign teachers.</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md">
          <Plus className="h-4 w-4" />
          Create Subject
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-24 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span>Loading academic subjects...</span>
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center p-16 border border-dashed border-slate-800 rounded-xl text-slate-400">
          No subjects created yet. Click "Create Subject" to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((sub: any) => (
            <Card key={sub.id} className="border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between hover:border-slate-700 transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base font-bold">{sub.name}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-2 flex-1">
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed min-h-[4rem]">
                  {sub.description || 'No description provided for this subject.'}
                </p>
                
                {/* Enrolls */}
                <div className="flex gap-4 border-t border-slate-800/60 pt-3 mt-4 text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-cyan-500" />
                    <span>{sub.studentCount} Students</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-emerald-500" />
                    <span>{sub.mentorCount} Mentors</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-800/40 bg-slate-950/20 flex justify-end gap-2 py-2.5 rounded-b-xl">
                <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(sub)} className="text-indigo-400 hover:text-white">
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(sub.id)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">
                {editingSubject ? 'Edit Subject Details' : 'Create Academic Subject'}
              </h3>
              <p className="text-xs text-slate-400">Enter details to organize exams and student enrollments.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sub-name">Subject Name</Label>
                <Input
                  id="sub-name"
                  placeholder="e.g. Mathematics, ICT, Chemistry"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-desc">Description (Optional)</Label>
                <Textarea
                  id="sub-desc"
                  placeholder="Summarize course content or exam scopes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 min-h-[6rem] focus-visible:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Subject'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
