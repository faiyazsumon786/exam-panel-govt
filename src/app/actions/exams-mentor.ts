'use server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

// Types for creating an exam
interface ExamInput {
  title: string
  subjectId: string
  description?: string
  startDate: string
  endDate: string
  totalMarks: number
  passingMarks: number
  allowBacktracking: boolean
  randomizeQuestions: boolean
  randomizeOptions: boolean
  maxAttempts: number
  allowRetake: boolean
  warningLimit: number
  autoSubmitAfterLimit: boolean
  examDurationMinutes?: number
  showResultAfterSubmit: boolean
  showCorrectAnswers: boolean
  negativeMarking: boolean
  negativeMarkValue: number
}

// 1. CREATE EXAM
export async function createExam(input: ExamInput) {
  const supabase = await createClient()

  // Get current user (mentor)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await (supabase
    .from('exams') as any)
    .insert({
      title: input.title,
      subject_id: input.subjectId,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      total_marks: input.totalMarks,
      passing_marks: input.passingMarks,
      status: 'draft', // defaults to draft
      allow_backtracking: input.allowBacktracking,
      randomize_questions: input.randomizeQuestions,
      randomize_options: input.randomizeOptions,
      max_attempts: input.maxAttempts,
      allow_retake: input.allowRetake,
      warning_limit: input.warningLimit,
      auto_submit_after_limit: input.autoSubmitAfterLimit,
      exam_duration_minutes: input.examDurationMinutes || null,
      show_result_after_submit: input.showResultAfterSubmit,
      show_correct_answers: input.showCorrectAnswers,
      negative_marking: input.negativeMarking,
      negative_mark_value: input.negativeMarkValue,
      created_by: user.id
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, exam: data }
}

// 2. UPDATE EXAM (Only editable in Draft status)
export async function updateExam(examId: string, input: Partial<ExamInput>) {
  const supabase = await createClient()

  // Check status
  const { data: currentExam } = await supabase.from('exams').select('status').eq('id', examId).single() as any
  if (currentExam?.status === 'completed') {
    return { success: false, error: 'Cannot modify a completed exam.' }
  }

  const { error } = await (supabase
    .from('exams') as any)
    .update({
      title: input.title,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      total_marks: input.totalMarks,
      passing_marks: input.passingMarks,
      allow_backtracking: input.allowBacktracking,
      randomize_questions: input.randomizeQuestions,
      randomize_options: input.randomizeOptions,
      max_attempts: input.maxAttempts,
      allow_retake: input.allowRetake,
      warning_limit: input.warningLimit,
      auto_submit_after_limit: input.autoSubmitAfterLimit,
      exam_duration_minutes: input.examDurationMinutes || null,
      show_result_after_submit: input.showResultAfterSubmit,
      show_correct_answers: input.showCorrectAnswers,
      negative_marking: input.negativeMarking,
      negative_mark_value: input.negativeMarkValue,
    })
    .eq('id', examId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Publish Exam
export async function publishExam(examId: string) {
  const supabase = await createClient()
  
  // Fetch exam details first to get title and subject_id
  const { data: examData, error: examError } = await supabase
    .from('exams')
    .select('title, subject_id')
    .eq('id', examId)
    .single() as any

  if (examError || !examData) {
    return { success: false, error: examError?.message || 'Exam not found' }
  }

  // Verify questions exist
  const { count } = await (supabase.from('questions') as any).select('*', { count: 'exact', head: true }).eq('exam_id', examId)
  if (!count || count === 0) {
    return { success: false, error: 'Cannot publish an exam with zero questions.' }
  }

  const { error } = await (supabase.from('exams') as any).update({ status: 'published' }).eq('id', examId)
  if (error) return { success: false, error: error.message }

  // Send notification to all students registered for this subject
  const { data: students, error: studentsError } = await supabase
    .from('student_subjects')
    .select('student_id')
    .eq('subject_id', examData.subject_id) as any

  if (!studentsError && students && students.length > 0) {
    const notificationsToInsert = students.map((student: any) => ({
      user_id: student.student_id,
      title: 'New Exam Published',
      message: `A new exam "${examData.title}" has been published. Go to Available Exams to start.`,
      type: 'exam'
    }))

    await (supabase.from('notifications') as any).insert(notificationsToInsert)
  }

  return { success: true }
}

// Delete Exam
export async function deleteExam(examId: string) {
  const supabase = await createClient()
  const { error } = await (supabase.from('exams') as any).delete().eq('id', examId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Re-open / Extend Exam
export async function reopenExam(examId: string, startDate: string, endDate: string) {
  const supabase = await createClient()

  // Get current user (mentor)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Update status to 'published' and set new dates
  const { error } = await (supabase
    .from('exams') as any)
    .update({
      status: 'published',
      start_date: startDate,
      end_date: endDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', examId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}


// 3. QUESTION BANK CRUD
interface QuestionBankInput {
  subjectId: string
  questionTitle: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
}

export async function addQuestionToBank(input: QuestionBankInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await (supabase.from('question_bank') as any).insert({
    subject_id: input.subjectId,
    question_title: input.questionTitle,
    option_a: input.optionA,
    option_b: input.optionB,
    option_c: input.optionC,
    option_d: input.optionD,
    correct_answer: input.correctAnswer,
    difficulty: input.difficulty,
    tags: input.tags,
    created_by: user?.id
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function editQuestionInBank(id: string, input: Partial<QuestionBankInput>) {
  const supabase = await createClient()
  const { error } = await (supabase
    .from('question_bank') as any)
    .update({
      question_title: input.questionTitle,
      option_a: input.optionA,
      option_b: input.optionB,
      option_c: input.optionC,
      option_d: input.optionD,
      correct_answer: input.correctAnswer,
      difficulty: input.difficulty,
      tags: input.tags,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteQuestionFromBank(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase.from('question_bank') as any).delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function bulkDeleteQuestionsFromBank(ids: string[]) {
  const supabase = await createClient()
  const { error } = await (supabase.from('question_bank') as any).delete().in('id', ids)
  if (error) return { success: false, error: error.message }
  return { success: true }
}


// Bulk Import questions to Bank
export async function bulkImportQuestionsToBank(
  subjectId: string,
  rows: {
    question: string
    option_a: string
    option_b: string
    option_c: string
    option_d: string
    correct_answer: string
    difficulty?: string
    tags?: string
  }[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const inserts = rows.map((row) => {
    let diff: 'easy' | 'medium' | 'hard' = 'medium'
    if (row.difficulty === 'easy' || row.difficulty === 'hard') {
      diff = row.difficulty
    }

    const tagsArr = row.tags ? row.tags.split(',').map(t => t.trim()) : []
    const cleanAnswer = row.correct_answer?.trim().toUpperCase() as 'A' | 'B' | 'C' | 'D'

    return {
      subject_id: subjectId,
      question_title: row.question,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_answer: ['A', 'B', 'C', 'D'].includes(cleanAnswer) ? cleanAnswer : 'A',
      difficulty: diff,
      tags: tagsArr,
      created_by: user?.id
    }
  })

  const { error } = await (supabase.from('question_bank') as any).insert(inserts)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// 4. EXAM QUESTIONS LINKING
export async function linkQuestionFromBank(examId: string, bankQuestionId: string, marks: number, timeLimit: number) {
  const supabase = await createClient()

  // Fetch from question bank
  const { data: bankQ, error: fetchErr } = await supabase
    .from('question_bank')
    .select('*')
    .eq('id', bankQuestionId)
    .single() as any

  if (fetchErr || !bankQ) return { success: false, error: 'Question not found in bank' }

  // Insert into exam specific questions table
  const { error: insertErr } = await (supabase.from('questions') as any).insert({
    exam_id: examId,
    question_bank_id: bankQ.id,
    question_title: bankQ.question_title,
    option_a: bankQ.option_a,
    option_b: bankQ.option_b,
    option_c: bankQ.option_c,
    option_d: bankQ.option_d,
    correct_answer: bankQ.correct_answer,
    marks: marks,
    time_limit: timeLimit
  })

  if (insertErr) return { success: false, error: insertErr.message }
  return { success: true }
}

// Auto Generate exam questions from Question Bank
export async function autoGenerateExamQuestions(
  examId: string,
  subjectId: string,
  settings: {
    easyCount: number
    mediumCount: number
    hardCount: number
    marksPerQuestion: number
    timeLimitPerQuestion: number
  }
) {
  const supabase = await createClient()

  // Fetch questions of each difficulty
  const fetchDifficulty = async (difficulty: 'easy' | 'medium' | 'hard', limit: number) => {
    if (limit <= 0) return []
    const { data } = await (supabase
      .from('question_bank') as any)
      .select('*')
      .eq('subject_id', subjectId)
      .eq('difficulty', difficulty)
    
    if (!data) return []
    
    // Shuffle client-side to get random questions
    return data.sort(() => 0.5 - Math.random()).slice(0, limit)
  }

  const easyQs = await fetchDifficulty('easy', settings.easyCount)
  const medQs = await fetchDifficulty('medium', settings.mediumCount)
  const hardQs = await fetchDifficulty('hard', settings.hardCount)

  const allSelectedQs = [...easyQs, ...medQs, ...hardQs]

  if (allSelectedQs.length === 0) {
    return { success: false, error: 'No questions found in bank for this subject & criteria.' }
  }

  // Insert all into the questions table
  const inserts = allSelectedQs.map((q) => ({
    exam_id: examId,
    question_bank_id: q.id,
    question_title: q.question_title,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    marks: settings.marksPerQuestion,
    time_limit: settings.timeLimitPerQuestion
  }))

  const { error } = await (supabase.from('questions') as any).insert(inserts)
  if (error) return { success: false, error: error.message }

  // Update exam total marks automatically
  const totalExamMarks = inserts.reduce((acc: number, q: any) => acc + q.marks, 0)
  await (supabase.from('exams') as any).update({ total_marks: totalExamMarks }).eq('id', examId)

  return { success: true, count: inserts.length }
}

// Add Single Question Directly to Exam (draft phase)
export async function addExamQuestionDirectly(
  examId: string,
  question: {
    questionTitle: string
    optionA: string
    optionB: string
    optionC: string
    optionD: string
    correctAnswer: 'A' | 'B' | 'C' | 'D'
    marks: number
    timeLimit: number
  }
) {
  const supabase = await createClient()

  // Insert question
  const { error } = await (supabase.from('questions') as any).insert({
    exam_id: examId,
    question_title: question.questionTitle,
    option_a: question.optionA,
    option_b: question.optionB,
    option_c: question.optionC,
    option_d: question.optionD,
    correct_answer: question.correctAnswer,
    marks: question.marks,
    time_limit: question.timeLimit
  }) // Typecast for simplicity or write fields explicitly

  if (error) return { success: false, error: error.message }

  // Recalculate and update exam total marks
  const { data: qs } = await supabase.from('questions').select('marks').eq('exam_id', examId) as any
  if (qs) {
    const totalMarks = (qs as any[]).reduce((acc: number, q: any) => acc + q.marks, 0)
    await (supabase.from('exams') as any).update({ total_marks: totalMarks }).eq('id', examId)
  }

  return { success: true }
}

// Bulk create questions in bank & link to exam in one go
export async function bulkAddQuestionsToExamAndBank(
  examId: string,
  subjectId: string,
  questions: {
    question: string
    option_a: string
    option_b: string
    option_c: string
    option_d: string
    correct_answer: string
    difficulty?: string
    tags?: string
  }[],
  marksPerQuestion: number,
  timeLimitPerQuestion: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // 1. Insert into question_bank
  const bankInserts = questions.map((row) => {
    let diff: 'easy' | 'medium' | 'hard' = 'medium'
    if (row.difficulty === 'easy' || row.difficulty === 'hard') {
      diff = row.difficulty
    }
    const tagsArr = row.tags ? row.tags.split(',').map(t => t.trim()) : []
    const cleanAnswer = row.correct_answer?.trim().toUpperCase() as 'A' | 'B' | 'C' | 'D'

    return {
      subject_id: subjectId,
      question_title: row.question,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_answer: ['A', 'B', 'C', 'D'].includes(cleanAnswer) ? cleanAnswer : 'A',
      difficulty: diff,
      tags: tagsArr,
      created_by: user.id
    }
  })

  const { data: bankData, error: bankErr } = await (supabase.from('question_bank') as any)
    .insert(bankInserts)
    .select()

  if (bankErr) {
    console.error('Error inserting into question_bank')
    return { success: false, error: 'Failed to create question bank entries.' }
  }

  // 2. Insert into exam questions
  const examInserts = bankData.map((q: any) => ({
    exam_id: examId,
    question_bank_id: q.id,
    question_title: q.question_title,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    marks: marksPerQuestion,
    time_limit: timeLimitPerQuestion
  }))

  const { error: examErr } = await (supabase.from('questions') as any).insert(examInserts)
  if (examErr) {
    console.error('Error inserting into exam questions')
    return { success: false, error: 'Failed to link questions to exam.' }
  }

  // 3. Recalculate and update exam total marks
  const totalMarks = examInserts.reduce((acc: number, q: any) => acc + q.marks, 0)
  await (supabase.from('exams') as any).update({ total_marks: totalMarks }).eq('id', examId)

  return { success: true }
}

// Bulk link existing bank questions to exam in one go
export async function bulkLinkQuestionsFromBank(
  examId: string,
  bankQuestionIds: string[],
  marksPerQuestion: number,
  timeLimitPerQuestion: number
) {
  const supabase = await createClient()

  // Fetch all selected bank questions
  const { data: bankQs, error: fetchErr } = await supabase
    .from('question_bank')
    .select('*')
    .in('id', bankQuestionIds)

  if (fetchErr || !bankQs) {
    return { success: false, error: 'Failed to fetch questions from bank' }
  }

  const examInserts = bankQs.map((q: any) => ({
    exam_id: examId,
    question_bank_id: q.id,
    question_title: q.question_title,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    marks: marksPerQuestion,
    time_limit: timeLimitPerQuestion
  }))

  const { error: insertErr } = await (supabase.from('questions') as any).insert(examInserts)
  if (insertErr) {
    return { success: false, error: insertErr.message }
  }

  // Recalculate and update exam total marks
  const { data: qs } = await supabase.from('questions').select('marks').eq('exam_id', examId) as any
  if (qs) {
    const totalMarks = (qs as any[]).reduce((acc: number, q: any) => acc + q.marks, 0)
    await (supabase.from('exams') as any).update({ total_marks: totalMarks }).eq('id', examId)
  }

  return { success: true }
}

