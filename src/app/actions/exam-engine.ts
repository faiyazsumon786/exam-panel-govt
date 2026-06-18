'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 1. START EXAM ATTEMPT
export async function startExamAttempt(examId: string) {
  const supabase = await createClient()

  // Get current user (student)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Check student status
  const { data: profile } = await supabase.from('users').select('status').eq('id', user.id).single() as any
  if (profile?.status !== 'approved') {
    return { success: false, error: 'Your account is pending activation by administrator.' }
  }

  // Fetch exam settings (regular client enforces RLS check for enrollment & published status)
  const { data: exam, error: examErr } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single() as any

  if (examErr || !exam) {
    return { success: false, error: 'Exam not found or you are not enrolled.' }
  }

  // Fetch questions list using admin client to bypass the RLS constraint before attempt is created
  const adminDb = createAdminClient()
  const { data: questionsList, error: qErr } = await adminDb
    .from('questions')
    .select('id')
    .eq('exam_id', examId)

  if (qErr || !questionsList || questionsList.length === 0) {
    return { success: false, error: 'This exam has no questions configured.' }
  }

  // Check existing attempts
  const { data: existingAttempts, error: attemptsErr } = await supabase
    .from('exam_attempts')
    .select('status, attempt_number')
    .eq('exam_id', examId)
    .eq('student_id', user.id) as any

  const attemptsCount = existingAttempts?.length || 0

  // Check if they have already submitted
  const hasCompleted = (existingAttempts as any[])?.some((a: any) => ['submitted', 'auto_submitted'].includes(a.status))
  if (hasCompleted && !exam.allow_retake) {
    return { success: false, error: 'You have already completed this exam and retakes are disabled.' }
  }

  if (attemptsCount >= exam.max_attempts && !exam.allow_retake) {
    return { success: false, error: 'You have exceeded the maximum allowed attempts for this exam.' }
  }

  const attemptNumber = attemptsCount + 1

  // Set up randomized order of questions if enabled
  let questionOrder = questionsList.map((q: any) => q.id)
  if (exam.randomize_questions) {
    questionOrder = shuffleArray(questionOrder)
  }

  // Set up randomized option order for each question if enabled
  const optionOrders: { [key: string]: string[] } = {}
  questionsList.forEach((q: any) => {
    optionOrders[q.id] = exam.randomize_options 
      ? shuffleArray(['A', 'B', 'C', 'D']) 
      : ['A', 'B', 'C', 'D']
  })

  // Set up duration in seconds
  const timeRemaining = exam.exam_duration_minutes ? exam.exam_duration_minutes * 60 : null

  // Insert attempt
  const { data: attempt, error: insertErr } = await (supabase
    .from('exam_attempts') as any)
    .insert({
      exam_id: examId,
      student_id: user.id,
      status: 'started',
      warnings_count: 0,
      attempt_number: attemptNumber,
      question_order: questionOrder,
      option_orders: optionOrders,
      current_question_index: 0,
      time_remaining_seconds: timeRemaining
    })
    .select()
    .single()

  if (insertErr) {
    return { success: false, error: insertErr.message }
  }

  // Log activity
  await (supabase.from('activity_logs') as any).insert({
    user_id: user.id,
    action: 'exam_start',
    details: `Started attempt ${attemptNumber} for exam: ${exam.title}`
  })

  return { success: true, attempt }
}

// 2. AUTO SAVE ANSWER & PROGRESS
export async function saveAnswerAndProgress(
  attemptId: string,
  questionId: string,
  selectedOption: 'A' | 'B' | 'C' | 'D' | null,
  nextIndex: number,
  timeRemaining: number | null
) {
  const supabase = await createClient()

  // Find question correct answer & marks to evaluate correctness
  const { data: q } = await supabase
    .from('questions')
    .select('correct_answer, marks, exam_id')
    .eq('id', questionId)
    .single() as any

  // Find exam to see if negative marking is enabled
  let examData = null
  if (q) {
    const { data: ex } = await supabase
      .from('exams')
      .select('negative_marking, negative_mark_value')
      .eq('id', q.exam_id)
      .single() as any
    examData = ex
  }

  if (q) {
    const isCorrect = selectedOption !== null ? q.correct_answer === selectedOption : null
    
    // Calculate marks obtained
    let marksObtained = 0
    if (isCorrect === true) {
      marksObtained = q.marks
    } else if (isCorrect === false) {
      if (examData?.negative_marking) {
        marksObtained = -Number(examData.negative_mark_value)
      }
    }

    // Save or update answer (ON CONFLICT handles updates)
    const { error: answerErr } = await (supabase
      .from('exam_answers') as any)
      .upsert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption || undefined,
        is_correct: isCorrect,
        marks_obtained: marksObtained
      }, { onConflict: 'attempt_id,question_id' })

    if (answerErr) {
      console.error('Error saving answer')
    }
  }

  // Update progress in attempt
  const { error: progressErr } = await (supabase
    .from('exam_attempts') as any)
    .update({
      current_question_index: nextIndex,
      time_remaining_seconds: timeRemaining
    })
    .eq('id', attemptId)

  if (progressErr) {
    return { success: false, error: progressErr.message }
  }

  return { success: true }
}

// 3. LOG CHEATING EVENT & AUTO SUBMIT
export async function logCheatingEvent(
  attemptId: string,
  eventType: string,
  details: string
) {
  const supabase = await createClient()

  // Get current user (student)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Insert cheating log
  await (supabase.from('cheating_logs') as any).insert({
    attempt_id: attemptId,
    student_id: user.id,
    event_type: eventType,
    details
  })

  // Increment warning counter in attempt
  const { data: attempt, error: getErr } = await supabase
    .from('exam_attempts')
    .select('warnings_count, exam_id')
    .eq('id', attemptId)
    .single() as any

  if (getErr || !attempt) return { success: false, error: 'Attempt not found' }

  const nextWarningCount = attempt.warnings_count + 1

  const { error: updateErr } = await (supabase
    .from('exam_attempts') as any)
    .update({ warnings_count: nextWarningCount })
    .eq('id', attemptId)

  if (updateErr) return { success: false, error: updateErr.message }

  // Fetch exam warning limits
  const { data: exam } = await supabase
    .from('exams')
    .select('warning_limit, auto_submit_after_limit')
    .eq('id', attempt.exam_id)
    .single() as any

  // If warnings exceeded limit, auto-submit the exam!
  if (exam && exam.auto_submit_after_limit && nextWarningCount >= exam.warning_limit) {
    const res = await submitExamAttempt(attemptId, true)
    return { 
      success: true, 
      warningsCount: nextWarningCount, 
      autoSubmitted: true, 
      resultId: res.result?.id 
    }
  }

  // Trigger realtime notification alert for Admin/Mentors
  const adminDb = createAdminClient()
  await (adminDb.from('notifications') as any).insert({
    title: 'Cheating Attempt Logged',
    message: `${user.email} triggered alert: ${eventType.toUpperCase()} (Warning ${nextWarningCount}/${exam?.warning_limit || 3})`,
    type: 'cheating_alert'
  })

  return { success: true, warningsCount: nextWarningCount, autoSubmitted: false }
}

// 4. SUBMIT EXAM ATTEMPT & EVALUATE SCORE
export async function submitExamAttempt(attemptId: string, isAutoSubmit = false) {
  const supabase = await createClient()

  // Fetch attempt details
  const { data: attempt, error: attemptErr } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .single() as any

  if (attemptErr || !attempt) return { success: false, error: 'Attempt not found' }

  if (['submitted', 'auto_submitted'].includes(attempt.status)) {
    // Already submitted
    const { data: existingResult } = await supabase.from('results').select('*').eq('attempt_id', attemptId).single() as any
    return { success: true, result: existingResult }
  }

  const studentId = attempt.student_id
  const examId = attempt.exam_id

  // Fetch exam details and its questions using admin client
  const adminDb = createAdminClient()
  const { data: exam } = await adminDb.from('exams').select('*').eq('id', examId).single() as any
  const { data: questions } = await adminDb.from('questions').select('*').eq('exam_id', examId) as any

  if (!exam || !questions || questions.length === 0) {
    return { success: false, error: 'Exam questions not resolved.' }
  }

  // Fetch student answers saved so far
  const { data: savedAnswers } = await adminDb.from('exam_answers').select('*').eq('attempt_id', attemptId) as any

  const answersMap = new Map()
  savedAnswers?.forEach((ans: any) => {
    answersMap.set(ans.question_id, ans)
  })

  let correctCount = 0
  let wrongCount = 0
  let skippedCount = 0
  let totalMarksObtained = 0

  // Grade the exam
  questions.forEach((q: any) => {
    const ans = answersMap.get(q.id)
    if (!ans || ans.selected_option === null || ans.selected_option === undefined) {
      skippedCount++
    } else {
      if (ans.is_correct) {
        correctCount++
        totalMarksObtained += q.marks
      } else {
        wrongCount++
        if (exam.negative_marking) {
          totalMarksObtained -= Number(exam.negative_mark_value)
        }
      }
    }
  })

  // Total possible exam marks
  const totalExamMarks = exam.total_marks || questions.reduce((acc: number, q: any) => acc + q.marks, 0)
  
  // Guard against negative totals
  if (totalMarksObtained < 0) totalMarksObtained = 0

  // Calculate percentage
  const percentage = totalExamMarks > 0 
    ? Number(((totalMarksObtained / totalExamMarks) * 100).toFixed(2)) 
    : 0

  const isPassed = totalMarksObtained >= exam.passing_marks

  // Create transactional entries using admin client (bypasses RLS limits for system operations)
  // 1. Update attempt status
  const { error: updateAttemptErr } = await (adminDb
    .from('exam_attempts') as any)
    .update({ 
      status: isAutoSubmit ? 'auto_submitted' : 'submitted',
      completed_at: new Date().toISOString()
    })
    .eq('id', attemptId)

  if (updateAttemptErr) {
    return { success: false, error: updateAttemptErr.message }
  }

  // 2. Insert result
  const { data: result, error: resultErr } = await (adminDb
    .from('results') as any)
    .insert({
      attempt_id: attemptId,
      exam_id: examId,
      student_id: studentId,
      total_questions: questions.length,
      correct_answers: correctCount,
      wrong_answers: wrongCount,
      skipped_questions: skippedCount,
      total_marks: totalExamMarks,
      obtained_marks: totalMarksObtained,
      percentage,
      is_passed: isPassed
    })
    .select()
    .single() as any

  if (resultErr) {
    return { success: false, error: resultErr.message }
  }

  // 3. Log activity
  await (adminDb.from('activity_logs') as any).insert({
    user_id: studentId,
    action: 'exam_submit',
    details: `${isAutoSubmit ? 'Auto-submitted' : 'Submitted'} exam: ${exam.title}. Score: ${totalMarksObtained}/${totalExamMarks} (${percentage}%)`
  })

  // 4. Create notification for student
  await (adminDb.from('notifications') as any).insert({
    user_id: studentId,
    title: 'Exam Score Released',
    message: `Your results for exam "${exam.title}" are ready. Score: ${totalMarksObtained}/${totalExamMarks}. Percentage: ${percentage}% (${isPassed ? 'PASS' : 'FAIL'})`,
    type: 'new_result'
  })

  return { success: true, result }
}

// 5. FETCH RESULT DETAILS BY ID (Bypasses Student RLS on questions table)
export async function getResultDetails(resultId: string) {
  const adminDb = createAdminClient()
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Fetch result using adminDb
  const { data: result, error: resultErr } = await adminDb
    .from('results')
    .select(`
      *,
      users:student_id (full_name, email),
      exams:exam_id (
        title, 
        passing_marks, 
        total_marks,
        subject_id,
        subjects (name)
      ),
      exam_attempts:attempt_id (warnings_count, status)
    `)
    .eq('id', resultId)
    .single() as any

  if (resultErr || !result) {
    return { success: false, error: 'Result record not found' }
  }

  // Verify ownership or staff access
  const isOwner = result.student_id === user.id
  const { data: profile } = await adminDb.from('users').select('role').eq('id', user.id).single() as any
  const isStaff = ['admin', 'mentor'].includes(profile?.role)

  if (!isOwner && !isStaff) {
    return { success: false, error: 'Unauthorized access to this result.' }
  }

  // Fetch questions using adminDb
  const { data: questions, error: qErr } = await adminDb
    .from('questions')
    .select('*')
    .eq('exam_id', result.exam_id)
    .order('created_at', { ascending: true }) as any

  if (qErr) {
    return { success: false, error: 'Error fetching exam questions' }
  }

  // Fetch answers
  const { data: answers, error: aErr } = await adminDb
    .from('exam_answers')
    .select('*')
    .eq('attempt_id', result.attempt_id) as any

  if (aErr) {
    return { success: false, error: 'Error fetching answers' }
  }

  return {
    success: true,
    result,
    questions: questions || [],
    answers: answers || []
  }
}
