export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          email: string
          role: 'admin' | 'mentor' | 'student'
          status: 'pending' | 'approved' | 'rejected'
          profile_picture: string | null
          profile_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          email: string
          role?: 'admin' | 'mentor' | 'student'
          status?: 'pending' | 'approved' | 'rejected'
          profile_picture?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          email?: string
          role?: 'admin' | 'mentor' | 'student'
          status?: 'pending' | 'approved' | 'rejected'
          profile_picture?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      mentor_subjects: {
        Row: {
          mentor_id: string
          subject_id: string
        }
        Insert: {
          mentor_id: string
          subject_id: string
        }
        Update: {
          mentor_id?: string
          subject_id?: string
        }
      }
      student_subjects: {
        Row: {
          student_id: string
          subject_id: string
        }
        Insert: {
          student_id: string
          subject_id: string
        }
        Update: {
          student_id?: string
          subject_id?: string
        }
      }
      question_bank: {
        Row: {
          id: string
          subject_id: string
          question_title: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          correct_answer: 'A' | 'B' | 'C' | 'D'
          difficulty: 'easy' | 'medium' | 'hard'
          tags: string[]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          question_title: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          correct_answer: 'A' | 'B' | 'C' | 'D'
          difficulty?: 'easy' | 'medium' | 'hard'
          tags?: string[]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          question_title?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          correct_answer?: 'A' | 'B' | 'C' | 'D'
          difficulty?: 'easy' | 'medium' | 'hard'
          tags?: string[]
          created_by?: string | null
          created_at?: string
        }
      }
      exams: {
        Row: {
          id: string
          title: string
          subject_id: string
          description: string | null
          start_date: string
          end_date: string
          total_marks: number
          passing_marks: number
          status: 'draft' | 'published' | 'completed'
          allow_backtracking: boolean
          randomize_questions: boolean
          randomize_options: boolean
          max_attempts: number
          allow_retake: boolean
          warning_limit: number
          auto_submit_after_limit: boolean
          exam_duration_minutes: number | null
          show_result_after_submit: boolean
          show_correct_answers: boolean
          negative_marking: boolean
          negative_mark_value: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          subject_id: string
          description?: string | null
          start_date: string
          end_date: string
          total_marks?: number
          passing_marks?: number
          status?: 'draft' | 'published' | 'completed'
          allow_backtracking?: boolean
          randomize_questions?: boolean
          randomize_options?: boolean
          max_attempts?: number
          allow_retake?: boolean
          warning_limit?: number
          auto_submit_after_limit?: boolean
          exam_duration_minutes?: number | null
          show_result_after_submit?: boolean
          show_correct_answers?: boolean
          negative_marking?: boolean
          negative_mark_value?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          subject_id?: string
          description?: string | null
          start_date?: string
          end_date?: string
          total_marks?: number
          passing_marks?: number
          status?: 'draft' | 'published' | 'completed'
          allow_backtracking?: boolean
          randomize_questions?: boolean
          randomize_options?: boolean
          max_attempts?: number
          allow_retake?: boolean
          warning_limit?: number
          auto_submit_after_limit?: boolean
          exam_duration_minutes?: number | null
          show_result_after_submit?: boolean
          show_correct_answers?: boolean
          negative_marking?: boolean
          negative_mark_value?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          exam_id: string
          question_bank_id: string | null
          question_title: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          correct_answer: 'A' | 'B' | 'C' | 'D'
          marks: number
          time_limit: number
          created_at: string
        }
        Insert: {
          id?: string
          exam_id: string
          question_bank_id?: string | null
          question_title: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          correct_answer: 'A' | 'B' | 'C' | 'D'
          marks?: number
          time_limit?: number
          created_at?: string
        }
        Update: {
          id?: string
          exam_id?: string
          question_bank_id?: string | null
          question_title?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          correct_answer?: 'A' | 'B' | 'C' | 'D'
          marks?: number
          time_limit?: number
          created_at?: string
        }
      }
      exam_attempts: {
        Row: {
          id: string
          exam_id: string
          student_id: string
          started_at: string
          completed_at: string | null
          status: 'started' | 'submitted' | 'abandoned' | 'auto_submitted'
          warnings_count: number
          attempt_number: number
          question_order: string[]
          option_orders: Json
          current_question_index: number
          time_remaining_seconds: number | null
        }
        Insert: {
          id?: string
          exam_id: string
          student_id: string
          started_at?: string
          completed_at?: string | null
          status?: 'started' | 'submitted' | 'abandoned' | 'auto_submitted'
          warnings_count?: number
          attempt_number?: number
          question_order?: string[]
          option_orders?: Json
          current_question_index?: number
          time_remaining_seconds?: number | null
        }
        Update: {
          id?: string
          exam_id?: string
          student_id?: string
          started_at?: string
          completed_at?: string | null
          status?: 'started' | 'submitted' | 'abandoned' | 'auto_submitted'
          warnings_count?: number
          attempt_number?: number
          question_order?: string[]
          option_orders?: Json
          current_question_index?: number
          time_remaining_seconds?: number | null
        }
      }
      exam_answers: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          selected_option: 'A' | 'B' | 'C' | 'D' | null
          is_correct: boolean | null
          marks_obtained: number
          answered_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          question_id: string
          selected_option?: 'A' | 'B' | 'C' | 'D' | null
          is_correct?: boolean | null
          marks_obtained?: number
          answered_at?: string
        }
        Update: {
          id?: string
          attempt_id?: string
          question_id?: string
          selected_option?: 'A' | 'B' | 'C' | 'D' | null
          is_correct?: boolean | null
          marks_obtained?: number
          answered_at?: string
        }
      }
      results: {
        Row: {
          id: string
          attempt_id: string
          exam_id: string
          student_id: string
          total_questions: number
          correct_answers: number
          wrong_answers: number
          skipped_questions: number
          total_marks: number
          obtained_marks: number
          percentage: number
          is_passed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          exam_id: string
          student_id: string
          total_questions: number
          correct_answers: number
          wrong_answers: number
          skipped_questions: number
          total_marks: number
          obtained_marks: number
          percentage: number
          is_passed: boolean
          created_at?: string
        }
        Update: {
          id?: string
          attempt_id?: string
          exam_id?: string
          student_id?: string
          total_questions?: number
          correct_answers?: number
          wrong_answers?: number
          skipped_questions?: number
          total_marks?: number
          obtained_marks?: number
          percentage?: number
          is_passed?: boolean
          created_at?: string
        }
      }
      rankings: {
        Row: {
          id: string
          student_id: string
          subject_id: string | null
          rank: number
          total_marks_obtained: number
          average_percent: number
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          subject_id?: string | null
          rank: number
          total_marks_obtained: number
          average_percent: number
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          subject_id?: string | null
          rank?: number
          total_marks_obtained?: number
          average_percent?: number
          updated_at?: string
        }
      }
      cheating_logs: {
        Row: {
          id: string
          attempt_id: string
          student_id: string
          event_type: string
          details: string | null
          logged_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          student_id: string
          event_type: string
          details?: string | null
          logged_at?: string
        }
        Update: {
          id?: string
          attempt_id?: string
          student_id?: string
          event_type?: string
          details?: string | null
          logged_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          message: string
          type: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          message?: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          description: string
          publish_date: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          publish_date?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          publish_date?: string
          created_by?: string | null
          created_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          details: string | null
          ip_address: string | null
          logged_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          details?: string | null
          ip_address?: string | null
          logged_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          details?: string | null
          ip_address?: string | null
          logged_at?: string
        }
      }
    }
  }
}
