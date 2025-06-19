export interface Grade {
  id: number;
  number: number;
  active: number;
}

export interface Subject {
  id: string;
  name: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
}

export interface APISubject {
  id: number;
  name: string;
  active: boolean;
  question_count: number;
  result_count: number;
  correct_count: number;
}

export interface LearnerSubject {
  subject: {
    id: number;
    highergrade: boolean;
    overideterm: boolean;
    last_updated: string;
    percentage: number;
    subject: Subject;
    learner: {
      id: number;
      uid: string;
      name: string;
      overide_term: boolean;
      grade: Grade;
    };
  };
  total_questions: number;
  answered_questions: number;
}

export interface SubjectsResponse {
  status: string;
  subjects: {
    id: number;
    name: string;
    active: boolean;
    grade: {
      id: number;
      number: number;
      active: number;
    };
    totalQuestions: number;
  }[];
}

export interface Paper {
  id: number;
  name: string;
}

export interface SubjectWithPapers {
  name: string;
  papers: Paper[];
}

export interface GradeSubjects {
  grade: number;
  subjects: SubjectWithPapers[];
}

export interface MySubjectsResponse {
  status: string;
  subjects: APISubject[];
}

export interface CheckAnswerResponse {
  status: string;
  correct: boolean;
  explanation: string | null;
  correctAnswer: string;
  points: number;
  message: string;
  lastThreeCorrect: boolean;
  subject: string;
  streakUpdated: boolean;
  streak: number;
}

export interface Todo {
  id: number;
  title: string;
  status: 'pending' | 'completed';
  created_at: string;
  due_date: string;
  subject_name?: string;
}

export interface RandomAIQuestion {
  status: string;
  question: {
    id: number;
    question: string;
    ai_explanation: string;
    subject: {
      id: number;
      name: string;
    };
  };
} 