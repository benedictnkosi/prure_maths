export interface SubTopic {
    name: string;
    questionCount: number;
}

export interface MathTopic {
    mainTopic: string;
    questionCount: number;
    subtopics: SubTopic[];
}

export interface MathTopicsResponse {
    status: string;
    topics: MathTopic[];
} 