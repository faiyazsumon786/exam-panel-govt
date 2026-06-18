'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { createAnnouncement, deleteAnnouncement } from '@/app/actions/announcements'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Megaphone, Plus, Trash2, Loader2, Calendar } from 'lucide-react'

export default function AnnouncementsAdminPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Form / Dialog states
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch announcements
  const { data: announcements = [] as any[], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('publish_date', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Save Announcement
  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Both title and description are required')
      return
    }

    setSaving(true)
    try {
      const res = await createAnnouncement(title, description)
      if (res.success) {
        toast.success('Announcement published!')
        setIsOpen(false)
        setTitle('')
        setDescription('')
        queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
      } else {
        toast.error(res.error || 'Failed to publish')
      }
    } catch (err: any) {
      toast.error('Connection failed')
    } finally {
      setSaving(false)
    }
  }

  // Delete Announcement
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return
    try {
      const res = await deleteAnnouncement(id)
      if (res.success) {
        toast.success('Announcement deleted!')
        queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
      } else {
        toast.error(res.error || 'Failed to delete')
      }
    } catch (err) {
      toast.error('Deletion error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-indigo-500" />
            Announcement System
          </h1>
          <p className="text-sm text-slate-400">Broadcast bulletins, reminders, and schedules to students and mentors.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md">
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Fetching announcements list...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              No announcements published yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="text-slate-400">Title</TableHead>
                    <TableHead className="text-slate-400">Content</TableHead>
                    <TableHead className="text-slate-400">Publish Date</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((item) => (
                    <TableRow key={item.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                      <TableCell className="font-semibold text-white max-w-[200px] truncate">{item.title}</TableCell>
                      <TableCell className="text-slate-300 text-xs max-w-[400px] truncate">{item.description}</TableCell>
                      <TableCell className="text-slate-400 text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                          {new Date(item.publish_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Announcement Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Create Announcement</h3>
              <p className="text-xs text-slate-400">Publish messages to students and mentors dashboards.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  placeholder="e.g. Schedule Update, System Maintenance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ann-desc">Description</Label>
                <Textarea
                  id="ann-desc"
                  placeholder="Write bulletin text..."
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
                    Publishing...
                  </>
                ) : (
                  'Publish Announcement'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
