'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  addQuestionToBank, 
  editQuestionInBank, 
  deleteQuestionFromBank, 
  bulkImportQuestionsToBank,
  bulkDeleteQuestionsFromBank
} from '@/app/actions/exams-mentor'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Loader2, 
  Filter, 
  Database,
  CheckCircle2,
  XCircle,
  FileSpreadsheet
} from 'lucide-react'

export default function QuestionBankPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Subject filter
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])

  // Clear selection on subject change
  useEffect(() => {
    setSelectedQuestionIds([])
  }, [selectedSubjectId])

  // Modal / Form state
  const [isOpen, setIsOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [isBulkOpen, setIsBulkOpen] = useState(false)

  // Fields
  const [questionTitle, setQuestionTitle] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionC, setOptionC] = useState('')
  const [optionD, setOptionD] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  // CSV Bulk Upload state
  const [csvText, setCsvText] = useState('')
  const [importReport, setImportReport] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  // Bulk Delete state
  const [deletingBulk, setDeletingBulk] = useState(false)

  // 1. Fetch mentor subjects
  const { data: rawMentorSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['mentor-assigned-subjects', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('mentor_subjects')
        .select('subject_id, subjects(name)')
        .eq('mentor_id', profile.id)

      if (error) throw error
      const list = data || []
      
      // Auto-select first subject
      if (list.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId((list[0] as any).subject_id)
      }
      return list
    },
    enabled: !!profile
  })
  const mentorSubjects = rawMentorSubjects as any[]

  // 2. Fetch questions for selected subject
  const { data: rawQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['questions-bank', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return []
      const { data, error } = await supabase
        .from('question_bank')
        .select('*')
        .eq('subject_id', selectedSubjectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!selectedSubjectId
  })
  const questions = rawQuestions as any[]

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingQuestion(null)
    setQuestionTitle('')
    setOptionA('')
    setOptionB('')
    setOptionC('')
    setOptionD('')
    setCorrectAnswer('A')
    setDifficulty('medium')
    setTagsInput('')
    setIsOpen(true)
  }

  // Open Edit Dialog
  const handleOpenEdit = (q: any) => {
    setEditingQuestion(q)
    setQuestionTitle(q.question_title)
    setOptionA(q.option_a)
    setOptionB(q.option_b)
    setOptionC(q.option_c)
    setOptionD(q.option_d)
    setCorrectAnswer(q.correct_answer)
    setDifficulty(q.difficulty)
    setTagsInput(q.tags ? q.tags.join(', ') : '')
    setIsOpen(true)
  }

  // Save question
  const handleSave = async () => {
    if (!questionTitle.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      toast.error('All question and options fields are required.')
      return
    }

    if (!selectedSubjectId) {
      toast.error('Please select a subject first')
      return
    }

    setSaving(true)
    const tagsArr = tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : []

    try {
      let res
      if (editingQuestion) {
        res = await editQuestionInBank(editingQuestion.id, {
          questionTitle,
          optionA,
          optionB,
          optionC,
          optionD,
          correctAnswer,
          difficulty,
          tags: tagsArr
        })
      } else {
        res = await addQuestionToBank({
          subjectId: selectedSubjectId,
          questionTitle,
          optionA,
          optionB,
          optionC,
          optionD,
          correctAnswer,
          difficulty,
          tags: tagsArr
        })
      }

      if (res.success) {
        toast.success(editingQuestion ? 'Question updated in bank!' : 'Question added to bank!')
        setIsOpen(false)
        queryClient.invalidateQueries({ queryKey: ['questions-bank', selectedSubjectId] })
      } else {
        toast.error(res.error || 'Failed to save question')
      }
    } catch (err) {
      toast.error('Connection failed')
    } finally {
      setSaving(false)
    }
  }

  // Delete question
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question? It will not affect existing examinations, but will remove it from the reusable bank.')) return
    try {
      const res = await deleteQuestionFromBank(id)
      if (res.success) {
        toast.success('Question removed from bank!')
        queryClient.invalidateQueries({ queryKey: ['questions-bank', selectedSubjectId] })
      } else {
        toast.error(res.error || 'Failed to delete question')
      }
    } catch (err) {
      toast.error('Error during deletion')
    }
  }

  // Helper to parse plain text MCQ questions in the numbered format:
  // 1. Question?
  // A. Option A
  // B. Option B
  // ...
  // Answer: A
  const parseTextQuestions = (text: string) => {
    const cleanText = text.replace(/\r\n/g, '\n')
    const lines = cleanText.split('\n').map((l) => l.trim()).filter(Boolean)

    const questionsList: any[] = []
    let currentQuestion: any = null

    const mapOptionLetter = (char: string): string => {
      const mapping: { [key: string]: string } = {
        'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D',
        'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D'
      }
      return mapping[char.toUpperCase()] || char.toUpperCase()
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Match question line: starts with number (English or Bengali) followed by dot or parenthesis (e.g. "1.", "৫৯)")
      const questionMatch = line.match(/^([0-9০-৯]+)[\.\)]\s*(.+)$/i)
      if (questionMatch) {
        if (currentQuestion) {
          questionsList.push(currentQuestion)
        }
        currentQuestion = {
          question: questionMatch[2].trim(),
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_answer: '',
          difficulty: 'medium',
          tags: ''
        }
        continue
      }

      if (!currentQuestion) continue

      // Check for inline Bengali options on the same line, e.g.:
      // ক. কর্মীর     খ. মালিকের       গ. সুপারভাইজারের      ঘ. গ্রাহকের।
      const inlineBengaliMatch = line.match(/^\s*ক[\.\)]\s*(.+?)\s+খ[\.\)]\s*(.+?)\s+গ[\.\)]\s*(.+?)\s+ঘ[\.\)]\s*(.+)$/i)
      if (inlineBengaliMatch) {
        currentQuestion.option_a = inlineBengaliMatch[1].trim()
        currentQuestion.option_b = inlineBengaliMatch[2].trim()
        currentQuestion.option_c = inlineBengaliMatch[3].trim()
        currentQuestion.option_d = inlineBengaliMatch[4].trim()
        continue
      }

      // Check for inline English options on the same line, e.g.:
      // A. Option A  B. Option B  C. Option C  D. Option D
      const inlineEnglishMatch = line.match(/^\s*A[\.\)]\s*(.+?)\s+B[\.\)]\s*(.+?)\s+C[\.\)]\s*(.+?)\s+D[\.\)]\s*(.+)$/i)
      if (inlineEnglishMatch) {
        currentQuestion.option_a = inlineEnglishMatch[1].trim()
        currentQuestion.option_b = inlineEnglishMatch[2].trim()
        currentQuestion.option_c = inlineEnglishMatch[3].trim()
        currentQuestion.option_d = inlineEnglishMatch[4].trim()
        continue
      }

      // Match options on separate lines (either English A-D or Bengali ক-ঘ)
      const optAMatch = line.match(/^(?:A|ক)[\.\)]\s*(.+)$/i)
      if (optAMatch) {
        currentQuestion.option_a = optAMatch[1].trim()
        continue
      }
      const optBMatch = line.match(/^(?:B|খ)[\.\)]\s*(.+)$/i)
      if (optBMatch) {
        currentQuestion.option_b = optBMatch[1].trim()
        continue
      }
      const optCMatch = line.match(/^(?:C|গ)[\.\)]\s*(.+)$/i)
      if (optCMatch) {
        currentQuestion.option_c = optCMatch[1].trim()
        continue
      }
      const optDMatch = line.match(/^(?:D|ঘ)[\.\)]\s*(.+)$/i)
      if (optDMatch) {
        currentQuestion.option_d = optDMatch[1].trim()
        continue
      }

      // Match Answer line: Answer: A / উত্তরঃ গ / Ans: খ etc.
      const ansMatch = line.match(/^(?:Answer|Correct Answer|Ans|Correct|উত্তরঃ|উত্তর|উঃ)[:：]?\s*([A-Dক-ঘ])/i)
      if (ansMatch) {
        currentQuestion.correct_answer = mapOptionLetter(ansMatch[1].trim())
        continue
      }

      // Match Difficulty: easy/medium/hard (optional)
      const diffMatch = line.match(/^Difficulty:\s*(easy|medium|hard)/i)
      if (diffMatch) {
        currentQuestion.difficulty = diffMatch[1].trim().toLowerCase()
        continue
      }

      // Match Tags: tag1, tag2 (optional)
      const tagsMatch = line.match(/^Tags:\s*(.+)/i)
      if (tagsMatch) {
        currentQuestion.tags = tagsMatch[1].trim()
        continue
      }

      // Append multi-line question titles if options haven't started yet
      if (
        currentQuestion &&
        !currentQuestion.option_a &&
        !currentQuestion.option_b &&
        !currentQuestion.option_c &&
        !currentQuestion.option_d &&
        !currentQuestion.correct_answer
      ) {
        currentQuestion.question += ' ' + line
      }
    }

    if (currentQuestion) {
      questionsList.push(currentQuestion)
    }

    return questionsList
  }

  const processImportRows = async (rows: any[]) => {
    // Pre-validate columns: question, option_a, option_b, option_c, option_d, correct_answer
    const errorsList: string[] = []
    const cleanRows = rows.map((row, idx) => {
      const rowNum = idx + 1
      const question = row.question || row.Question || row.question_title
      const option_a = row.option_a || row.option_A || row.Option_A
      const option_b = row.option_b || row.option_B || row.Option_B
      const option_c = row.option_c || row.option_C || row.Option_C
      const option_d = row.option_d || row.option_D || row.Option_D
      const correct_answer = row.correct_answer || row.Correct_Answer || row.answer

      if (!question) errorsList.push(`Item ${rowNum}: Question field is blank.`)
      if (!option_a || !option_b || !option_c || !option_d) errorsList.push(`Item ${rowNum}: All options (A-D) must be provided.`)
      
      const ans = correct_answer?.trim().toUpperCase()
      if (!ans || !['A', 'B', 'C', 'D'].includes(ans)) {
        errorsList.push(`Item ${rowNum}: Correct answer must be A, B, C, or D (got ${ans || 'blank'}).`)
      }

      return {
        question: question?.trim(),
        option_a: option_a?.trim(),
        option_b: option_b?.trim(),
        option_c: option_c?.trim(),
        option_d: option_d?.trim(),
        correct_answer: ans,
        difficulty: row.difficulty?.trim().toLowerCase() || 'medium',
        tags: row.tags?.trim() || ''
      }
    })

    if (errorsList.length > 0) {
      setImportReport({ success: false, errors: errorsList })
      toast.error('Validation errors found. Please fix before importing.')
      setImporting(false)
      return
    }

    try {
      const res = await bulkImportQuestionsToBank(selectedSubjectId, cleanRows)
      if (res.success) {
        setImportReport({ success: true, count: cleanRows.length })
        toast.success(`Successfully imported ${cleanRows.length} questions!`)
        queryClient.invalidateQueries({ queryKey: ['questions-bank', selectedSubjectId] })
      } else {
        toast.error(res.error || 'Failed to import questions')
      }
    } catch (err: any) {
      toast.error(`Ingest error: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  // Bulk Ingest
  const handleBulkImport = () => {
    if (!csvText.trim()) {
      toast.error('Please paste your questions text first')
      return
    }

    if (!selectedSubjectId) {
      toast.error('Please choose a subject first')
      return
    }

    setImporting(true)

    // Check if the pasted text looks like a CSV (contains header row with comma)
    const firstLine = csvText.trim().split('\n')[0]
    const isCSV = firstLine.toLowerCase().includes('question') && firstLine.toLowerCase().includes('option_a')

    if (isCSV) {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          processImportRows(results.data as any[])
        },
        error: () => {
          toast.error('Failed to parse CSV format')
          setImporting(false)
        }
      })
    } else {
      try {
        const parsedRows = parseTextQuestions(csvText)
        if (parsedRows.length === 0) {
          toast.error('No valid questions found in the pasted text. Check the format.')
          setImporting(false)
          return
        }
        processImportRows(parsedRows)
      } catch (err: any) {
        toast.error(`Parsing error: ${err.message}`)
        setImporting(false)
      }
    }
  }

  const handleCreateExamFromSelected = () => {
    if (selectedQuestionIds.length === 0) return
    localStorage.setItem('selected_bank_question_ids', JSON.stringify(selectedQuestionIds))
    router.push('/mentor/exams?fromQuestions=true')
  }

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return
    if (!confirm(`Are you sure you want to delete the ${selectedQuestionIds.length} selected questions? This will remove them from the reusable bank.`)) return

    setDeletingBulk(true)
    try {
      const res = await bulkDeleteQuestionsFromBank(selectedQuestionIds)
      if (res.success) {
        toast.success('Selected questions removed from bank!')
        setSelectedQuestionIds([])
        queryClient.invalidateQueries({ queryKey: ['questions-bank', selectedSubjectId] })
      } else {
        toast.error(res.error || 'Failed to delete selected questions')
      }
    } catch (err) {
      toast.error('Error during bulk deletion')
    } finally {
      setDeletingBulk(false)
    }
  }

  // Filter questions by search term
  const filteredQuestions = questions.filter((q: any) => 
    q.question_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.tags && q.tags.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase())))
  )

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-indigo-500" />
            Subject Question Bank
          </h1>
          <p className="text-sm text-slate-400">Manage reusable question pools, configure difficulty ratings, and bulk import templates.</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {selectedQuestionIds.length > 0 && (
            <>
              <Button 
                onClick={handleCreateExamFromSelected} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md transition-all"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Create Exam from Selected ({selectedQuestionIds.length})
              </Button>
              <Button 
                onClick={handleBulkDelete} 
                className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-md transition-all"
                disabled={deletingBulk}
              >
                {deletingBulk ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Selected ({selectedQuestionIds.length})
              </Button>
            </>
          )}
          <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 gap-2" onClick={() => setIsBulkOpen(true)}>
            <Upload className="h-4 w-4" />
            Bulk Import CSV
          </Button>
          <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md">
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Subject Filter Box */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500 w-full sm:w-56"
            >
              {loadingSubjects ? (
                <option>Loading subjects...</option>
              ) : mentorSubjects.length === 0 ? (
                <option>No assigned subjects</option>
              ) : (
                mentorSubjects.map((s: any) => (
                  <option key={s.subject_id} value={s.subject_id}>{s.subjects?.name}</option>
                ))
              )}
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search questions or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
            />
          </div>
        </div>
      </Card>

      {/* Reusable Questions List */}
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <CardContent className="p-0">
          {loadingQuestions ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span>Loading question bank...</span>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center p-16 text-slate-500">
              {selectedSubjectId 
                ? 'No questions built in the bank for this subject.' 
                : 'Please select a subject to load questions.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox 
                        checked={filteredQuestions.length > 0 && selectedQuestionIds.length === filteredQuestions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedQuestionIds(filteredQuestions.map(q => q.id))
                          } else {
                            setSelectedQuestionIds([])
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Question Title</TableHead>
                    <TableHead className="text-slate-400">Options Preview</TableHead>
                    <TableHead className="text-slate-400 text-center">Correct Answer</TableHead>
                    <TableHead className="text-slate-400 text-center">Difficulty</TableHead>
                    <TableHead className="text-slate-400">Tags</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((q) => (
                    <TableRow key={q.id} className="border-b border-slate-800/60 hover:bg-slate-900/30">
                      <TableCell className="text-center w-12">
                        <Checkbox 
                          checked={selectedQuestionIds.includes(q.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedQuestionIds(prev => [...prev, q.id])
                            } else {
                              setSelectedQuestionIds(prev => prev.filter(id => id !== q.id))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-white max-w-[200px] truncate">
                        {q.question_title}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 max-w-[250px] truncate">
                        A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono">
                          {q.correct_answer}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          className={
                            q.difficulty === 'easy' 
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : q.difficulty === 'hard'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }
                        >
                          {q.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {q.tags && q.tags.length > 0 ? (
                            q.tags.map((tag: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-300 font-normal text-[10px]">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(q)} className="h-8 w-8 text-indigo-400 hover:text-white">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal 1: Create / Edit Question Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl w-full border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">
                {editingQuestion ? 'Edit Question Bank Item' : 'Add Question to Bank'}
              </h3>
              <p className="text-xs text-slate-400">Create a reusable MCQ question. This will be available for exam building.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="q-title">Question Prompt</Label>
                <Input
                  id="q-title"
                  placeholder="e.g. What is the derivative of x^2?"
                  value={questionTitle}
                  onChange={(e) => setQuestionTitle(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                />
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="opt-a">Option A</Label>
                  <Input
                    id="opt-a"
                    placeholder="Option A"
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="opt-b">Option B</Label>
                  <Input
                    id="opt-b"
                    placeholder="Option B"
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="opt-c">Option C</Label>
                  <Input
                    id="opt-c"
                    placeholder="Option C"
                    value={optionC}
                    onChange={(e) => setOptionC(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="opt-d">Option D</Label>
                  <Input
                    id="opt-d"
                    placeholder="Option D"
                    value={optionD}
                    onChange={(e) => setOptionD(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Answers & Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="correct-ans">Correct Option</Label>
                  <select
                    id="correct-ans"
                    value={correctAnswer}
                    onChange={(e: any) => setCorrectAnswer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="difficulty-sel">Difficulty Level</Label>
                  <select
                    id="difficulty-sel"
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg p-2 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <Label htmlFor="tags">Tags (Comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. algebra, calculus, derivatives"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
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
                  'Save Question'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Bulk Upload Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="sm:max-w-4xl w-full border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Bulk Import MCQ Questions</h3>
              <p className="text-xs text-slate-400">
                Paste your questions directly into the box below. You can use standard plain text format (Numbered with Options and Answer) or CSV.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="q-csv-text" className="text-slate-300">Paste Questions Content</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCsvText(`1. What is Meta?\nA. Meta is the parent company of Facebook, Instagram, and WhatsApp.\nB. Meta is a mobile phone company.\nC. Meta is a search engine.\nD. Meta is a web browser.\nAnswer: A\n\n2. Which platform belongs to Meta?\nA. YouTube\nB. Instagram\nC. LinkedIn\nD. Telegram\nAnswer: B`)}
                    className="text-indigo-400 hover:text-indigo-300 text-xs h-7 px-2"
                  >
                    Load Sample Format
                  </Button>
                </div>
                <textarea
                  id="q-csv-text"
                  rows={12}
                  placeholder={`1. What is Meta?\nA. Meta is the parent company of Facebook, Instagram, and WhatsApp.\nB. Meta is a mobile phone company.\nC. Meta is a search engine.\nD. Meta is a web browser.\nAnswer: A\n\n2. Which platform belongs to Meta?\nA. YouTube\nB. Instagram\nC. LinkedIn\nD. Telegram\nAnswer: B`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg p-3 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:border-indigo-500 transition-all resize-y"
                />
              </div>

              {/* Expected Format section */}
              <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Expected Plain Text Format (Example):
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Difficulty & tags can be optionally added below answers</span>
                </div>

                <pre className="p-2 bg-slate-950/80 rounded border border-slate-800/60 text-[10px] text-indigo-200 font-mono overflow-x-auto select-all leading-normal">
{`1. What is Meta?
A. Meta is the parent company of Facebook, Instagram, and WhatsApp.
B. Meta is a mobile phone company.
C. Meta is a search engine.
D. Meta is a web browser.
Answer: A

2. Which platform belongs to Meta?
A. YouTube
B. Instagram
C. LinkedIn
D. Telegram
Answer: B`}
                </pre>
              </div>

              {importReport && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-2 max-h-48 overflow-y-auto">
                  {importReport.success ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Successfully imported {importReport.count} questions to the bank!</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-red-400 font-semibold mb-1">
                        <XCircle className="h-4 w-4" />
                        <span>Validation Errors:</span>
                      </div>
                      <div className="space-y-0.5 text-[10px] text-slate-400 font-mono">
                        {importReport.errors.map((err: string, i: number) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setIsBulkOpen(false); setImportReport(null); setCsvText(''); }} className="border-slate-800 text-slate-300">
                Close
              </Button>
              <Button onClick={handleBulkImport} className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Import Questions'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
