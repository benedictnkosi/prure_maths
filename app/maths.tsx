import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Text, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalSearchParams } from 'expo-router';
import { HOST_URL } from '@/config/api';
import Toast from 'react-native-toast-message';
import { KaTeX } from '@/app/components/quiz/KaTeXMaths';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuizAdditionalImage } from '@/app/components/quiz/QuizAdditionalImage';
import { getLearner } from '@/services/api';
import { PerformanceSummary } from '@/app/components/quiz/PerformanceSummary';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Paywall } from './components/Paywall';
import { QuizEmptyState } from '@/app/components/quiz/QuizEmptyState';
import { Audio } from 'expo-av';
import { ZoomModal } from '@/app/components/quiz/quiz-modals';
import limitImg from '../assets/images/dimpo/limit.png';

interface LearnerInfo {
    name: string;
    grade: string;
    curriculum?: string;
    terms?: string;
    photoURL?: string;
    imagePath?: string;
    avatar?: string;
    subscription?: string;
    school_name?: string;
    role?: string;
}

interface TopicsResponse {
    status: string;
    topics: string[];
}

interface QuestionIdsResponse {
    status: string;
    question_ids: number[];
}

interface Step {
    hint: string;
    type: string;
    teach: string;
    answer: string;
    prompt: string;
    options: string[];
    step_number: number;
    final_expression: string;
    expression?: string;
}

interface Steps {
    id: string;
    grade: number;
    steps: Step[];
    topic: string;
    question: string;
}

interface QuestionResponse {
    id: number;
    question: string;
    type: string;
    context: string;
    answer: string;
    options: {
        option1: string;
        option2: string;
        option3: string;
        option4: string;
    };
    ai_explanation: string;
    topic: string;
    steps?: Steps;
    image_path?: string;
    question_image_path?: string;
}

// Emoji map for topics
const TOPIC_EMOJIS = [
    { emoji: '➕', label: 'Addition' },
    { emoji: '➖', label: 'Subtraction' },
    { emoji: '✖️', label: 'Multiplication' },
    { emoji: '➗', label: 'Division' },
    { emoji: '🟰', label: 'Equals' },
    { emoji: '🔢', label: 'Numbers' },
    { emoji: '📐', label: 'Triangle Ruler' },
    { emoji: '📏', label: 'Straight Ruler' },
    { emoji: '🧮', label: 'Abacus' },
    { emoji: '📊', label: 'Bar Chart' },
    { emoji: '📈', label: 'Line Chart Up' },
    { emoji: '📉', label: 'Line Chart Down' },
    { emoji: '🧠', label: 'Thinking/Logic' },
    { emoji: '🔍', label: 'Search/Find' },
    { emoji: '🎯', label: 'Target/Accuracy' },
    { emoji: '📝', label: 'Notes/Working Out' },
    { emoji: '🗒️', label: 'Notepad' },
    { emoji: '💡', label: 'Idea/Concept' },
    { emoji: '🕒', label: 'Time/Clock' },
    { emoji: '🧊', label: 'Cube (Geometry)' },
];

function getTopicEmoji(topic: string) {
    const found = TOPIC_EMOJIS.find(e => topic.toLowerCase().includes(e.label.toLowerCase()));
    return found ? found.emoji : '📚';
}

// Helper to shuffle options and track correct answer index
function shuffleOptionsWithAnswer(options: string[], answer: string) {
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const correctIndex = arr.findIndex(opt => opt.trim() === answer.trim());
    return { shuffled: arr, correctIndex };
}

function LocalHeader({ learnerInfo }: { learnerInfo: any }) {
    const insets = useSafeAreaInsets();
    return (
        <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,

            paddingBottom: 12,
            backgroundColor: 'transparent',
        }}>
            <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>
                    <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: '#8B5CF6' }}>📚 Dimpo Maths App </ThemedText>
                    <ThemedText style={{ fontSize: 18 }}>✨</ThemedText>
                </ThemedText>
                <ThemedText style={{ fontSize: 14, color: '#64748B', marginTop: 2 }}>Explore the Joy of Learning! 🎓</ThemedText>
            </View>
            <TouchableOpacity
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{
                    backgroundColor: '#F3F4F6',
                    borderRadius: 20,
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.10,
                    shadowRadius: 6,
                    elevation: 2,
                }}
            >
                <Ionicons name="close" size={28} color={'#1E293B'} />
            </TouchableOpacity>
        </View>
    );
}

export default function MathsScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { user } = useAuth();
    const params = useLocalSearchParams();
    const { subjectName, learnerUid, grade, topic, subtopic, questionId, learningMode } = params;
    const scrollViewRef = React.useRef<ScrollView>(null);
    const progressRef = React.useRef<View>(null);
    const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
    const [isZoomModalVisible, setIsZoomModalVisible] = useState(false);
    const [imageRotation, setImageRotation] = useState(0);
    const [correctSound, setCorrectSound] = useState<Audio.Sound | null>(null);
    const [incorrectSound, setIncorrectSound] = useState<Audio.Sound | null>(null);

    const [topics, setTopics] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedQuestion, setSelectedQuestion] = useState<QuestionResponse | null>(null);
    const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'topics' | 'steps'>('topics');
    const [selectedTopic, setSelectedTopic] = useState<string | null>(topic as string | null);
    const [questionIds, setQuestionIds] = useState<number[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
    const [progressBarPosition, setProgressBarPosition] = useState(0);
    const [learnerInfo, setLearnerInfo] = useState<LearnerInfo | null>(null);
    const [selectedLearningMode, setSelectedLearningMode] = useState<string>(learningMode as string || 'quiz');
    const [scoreStats, setScoreStats] = useState({
        total_answers: 0,
        correct_answers: 0,
        incorrect_answers: 0,
        correct_percentage: 0,
        incorrect_percentage: 0,
    });
    const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
    const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number>(-1);
    const [remainingMathsPractice, setRemainingMathsPractice] = useState<number | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [hasShownPaywall, setHasShownPaywall] = useState(false);
    const [showEmptyState, setShowEmptyState] = useState(false);
    const awardedPointsRef = React.useRef<{ [key: string]: boolean }>({});
    const [justAwardedPoints, setJustAwardedPoints] = useState(false);
    const [justAwardedStreakPoints, setJustAwardedStreakPoints] = useState(false);
    const awardedStreakRef = React.useRef<{ [key: string]: boolean }>({});
    const [perfectQuestionsCount, setPerfectQuestionsCount] = useState(0);
    const [justAwardedSessionPoints, setJustAwardedSessionPoints] = useState(false);
    const awardedSessionRef = React.useRef<boolean>(false);
    const [completedQuestionIds, setCompletedQuestionIds] = useState<number[]>([]);
    const [showAllQuestions, setShowAllQuestions] = useState(false);
    const [showCompletedQuestions, setShowCompletedQuestions] = useState(false); // false = new, true = completed

    const styles = getStyles(isDark, colors);

    // Memoize sortedSteps to avoid infinite update loop
    const sortedSteps = useMemo(() => {
        return selectedQuestion?.steps?.steps
            ? [...selectedQuestion.steps.steps].sort((a, b) => a.step_number - b.step_number)
            : [];
    }, [selectedQuestion?.steps?.steps]);

    // Fetch completed question ids when learnerUid changes
    useEffect(() => {
        async function fetchCompletedQuestionIds() {
            if (!learnerUid) return;
            try {
                const response = await fetch(`${HOST_URL}/api/learner/maths-practice-question-ids?uid=${learnerUid}`);
                const data = await response.json();
                console.log('[FETCH COMPLETED QUESTION IDS] Data:', data);
                if (data.status === 'OK' && data.data && Array.isArray(data.data.maths_practice_question_ids)) {
                    setCompletedQuestionIds(data.data.maths_practice_question_ids);
                } else {
                    setCompletedQuestionIds([]);
                }
            } catch (error) {
                setCompletedQuestionIds([]);
            }
        }
        fetchCompletedQuestionIds();
    }, [learnerUid]);

    // Filtered question ids based on toggle
    const filteredQuestionIds = useMemo(() => {
        if (showCompletedQuestions) return questionIds.filter(id => completedQuestionIds.includes(id));
        return questionIds.filter(id => !completedQuestionIds.includes(id));
    }, [questionIds, completedQuestionIds, showCompletedQuestions]);

    // When toggling showCompletedQuestions, reset index and load first question
    useEffect(() => {
        if (viewMode === 'steps' && filteredQuestionIds.length > 0) {
            setCurrentQuestionIndex(0);
            fetchQuestionDetails(filteredQuestionIds[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCompletedQuestions]);

    useEffect(() => {
        if (learnerUid) {
            if (questionId) {
                // If questionId is provided, load that question directly
                setQuestionIds([Number(questionId)]); // Set the questionIds array with the single question
                setCurrentQuestionIndex(0);
                fetchQuestionDetails(Number(questionId));
                setViewMode('steps');
            } else if (topic) {
                // If topic is provided, directly fetch questions for that topic
                fetchQuestionsForTopic(topic as string);
                setViewMode('steps');
            } else {
                // Otherwise fetch all topics
                fetchMathTopics();
            }
        }
    }, [learnerUid, topic, questionId]);

    useEffect(() => {
        async function fetchLearnerInfo() {
            if (!user?.uid) return;
            try {
                const learner = await getLearner(user.uid);
                const name = learner.name || '';
                // Extract grade number from the nested grade object
                const gradeNumber = learner.grade?.number?.toString() || '';

                setLearnerInfo({
                    name,
                    grade: gradeNumber,
                    curriculum: learner.curriculum || '',
                    terms: learner.terms || '',
                    imagePath: user.photoURL || "",
                    avatar: learner.avatar || "",
                    subscription: (learner as any).subscription || 'free', // Type assertion to handle API response
                    school_name: learner.school_name || '',
                    role: learner.role || '',
                });

            } catch (error) {
                console.log('Failed to fetch learner info:', error);
            }
        }
        fetchLearnerInfo();
    }, [user?.uid]);

    const fetchMathTopics = async () => {
        try {
            setIsLoading(true);
            let $url = `${HOST_URL}/api/maths/topics-with-steps?uid=${learnerUid}&subject_name=${subjectName}`
            const response = await fetch(
                $url
            );
            const data: TopicsResponse = await response.json();

            if (data.status === 'OK') {
                setTopics(data.topics.filter(topic => !topic.includes('NO MATCH')));
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to load math topics',
                });
            }
        } catch (error) {
            console.error('Error fetching math topics:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load math topics',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchQuestionsForTopic = async (topicParam: string) => {
        try {
            setIsLoadingQuestion(true);
            // Use subtopic if available, otherwise use main topic, and ensure it's a string
            let topicToUse: string;
            if (subtopic) {
                topicToUse = Array.isArray(subtopic) ? subtopic[0] : subtopic;
            } else {
                topicToUse = Array.isArray(topic) ? topic[0] : (topic as string);
            }
            console.log('[FETCH QUESTIONS] Main Topic:', topic);
            console.log('[FETCH QUESTIONS] Subtopic (if any):', subtopic);
            console.log('[FETCH QUESTIONS] Passed topic parameter:', topicParam);
            console.log('[FETCH QUESTIONS] Topic being used in API call:', topicToUse);
            let $url = `${HOST_URL}/api/maths/questions-with-steps-by-topic?topic=${encodeURIComponent(topicToUse)}&grade=${grade}&subject_name=${encodeURIComponent(subjectName as string)}&uid=${learnerUid}`;
            console.log('[FETCH QUESTIONS] URL:', $url);
            const response = await fetch(
                $url,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            const data: QuestionIdsResponse = await response.json();
            console.log('[FETCH QUESTIONS] Response JSON:', data);

            if (data.status === 'OK' && data.question_ids.length > 0) {
                setQuestionIds(data.question_ids);
                setCurrentQuestionIndex(0);
                await fetchQuestionDetails(data.question_ids[0]);
            } else {
                console.log('[FETCH QUESTIONS] No questions found for topic:', topicToUse, 'Response:', data);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'No questions found for this topic',
                });
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load questions',
            });
        } finally {
            setIsLoadingQuestion(false);
        }
    };

    const fetchQuestionDetails = async (questionId: number) => {
        try {
            const response = await fetch(
                `${HOST_URL}/public/learn/question/byname?paper_name=P1&question_id=${questionId}&subject_name=${encodeURIComponent(subjectName as string)}&uid=${learnerUid}&subscriptionCheck=true`
            );
            const data: QuestionResponse = await response.json();

            //some cleaning of latex. replace =\frac with =\\frac

            data.steps?.steps.forEach(step => {
                step.answer = step.answer.replace(/\=\frac/g, '=\\frac');
            });

            console.log('[FETCH QUESTION DETAILS] context:', data.context);
            console.log('[FETCH QUESTION DETAILS] question:', data.question);
            setSelectedQuestion(data);
            fetchDailyUsage();
        } catch (error) {
            console.error('Error fetching question details:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load question details',
            });
        }
    };

    const loadNextQuestion = async () => {
        if (currentQuestionIndex < questionIds.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            await fetchQuestionDetails(questionIds[nextIndex]);
            setCurrentStepIndex(0);
            setSelectedOptionIndex(null);
            setShowHint(false);
            setCorrectAnswersCount(0);
            // Scroll to top after loading next question
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        } else {
            Toast.show({
                type: 'info',
                text1: 'No More Questions',
                text2: 'You have completed all questions in this topic',
            });
        }
    };



    let isRowLayout = false;
    if (selectedQuestion?.steps?.steps[currentStepIndex]?.answer) {
        if (isLatex(selectedQuestion?.steps?.steps[currentStepIndex]?.answer as string)) {
            isRowLayout = false;
        } else {
            isRowLayout = selectedQuestion?.steps?.steps[currentStepIndex]?.options?.every(opt => opt.length < 4);
        }
    }

    // Shuffle options and set correct answer index when step changes
    useEffect(() => {
        if (sortedSteps[currentStepIndex]?.options) {
            const { shuffled, correctIndex } = shuffleOptionsWithAnswer(
                sortedSteps[currentStepIndex].options,
                sortedSteps[currentStepIndex].answer
            );
            setShuffledOptions(shuffled);
            setCorrectAnswerIndex(correctIndex);
            
            // Log the correct answer when step loads
            console.log('[STEP LOAD] Step', currentStepIndex + 1, 'of', sortedSteps.length);
            console.log('[STEP LOAD] Correct answer:', sortedSteps[currentStepIndex].answer);
            console.log('[STEP LOAD] All options:', sortedSteps[currentStepIndex].options);
            console.log('[STEP LOAD] Correct option index:', correctIndex);
        } else {
            setShuffledOptions([]);
            setCorrectAnswerIndex(-1);
        }
    }, [currentStepIndex, sortedSteps]);

    // Helper to check if text contains LaTeX
    function isLatex(text: string): boolean {
        if (!text) return false;

        // Count unique alphabets
        const uniqueAlphabets = new Set(text.match(/[a-z]/g) || []);

        //count unique numbers
        const uniqueNumbers = new Set(text.match(/\d/g) || []);

        //count number of spaces
        const spaceCount = (text.match(/\s/g) || []).length;
        if (spaceCount === 0) {
            console.log('[IS LATEX] No spaces found in text:', text);
            return true;
        }

        if (uniqueNumbers.size >= uniqueAlphabets.size) {
            console.log('[IS LATEX] Unique numbers > unique alphabets:', text);
            return true;
        }

        // Check for common LaTeX delimiters
        const latexPatterns = [
            /\$[^$]+\$/,           // Inline math: $...$
            /\\\([^)]+\\\)/,       // Inline math: \(...\)
            /\\\[[^\]]+\\\]/,      // Display math: \[...\]
            /\\begin\{[^}]+\}/,    // LaTeX environments
            /\\[a-zA-Z]+/,         // LaTeX commands
            /\\frac\{[^}]+\}\{[^}]+\}/, // Fractions
            /\\sqrt\{[^}]+\}/,     // Square roots
            /\\sum/,               // Sum symbol
            /\\int/,               // Integral symbol
            /\\lim/,               // Limit symbol
            /\\infty/,             // Infinity symbol
            /\\alpha|\\beta|\\gamma|\\delta|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\omega/, // Greek letters
        ];

        return latexPatterns.some(pattern => pattern.test(text));
    }

    // Add helper function
    let isOpeningDollarSign = false
    let isClosingDollarSignNextLine = false
    function renderMixedContent(text: string, isDark: boolean, colors: any, isOption = false) {
        if (!text) return null;

        //is latex and does not contain multiple $ count number of $
        const dollarCount = (text.match(/\$/g) || []).length;
        if (isLatex(text) && dollarCount < 2) {
            //does not start with $
            if (!text.startsWith('$')) {
                text = `$${text}`
            }
            //does not end with $
            if (!text.endsWith('$')) {
                text = `${text}$`
            }
        }
        // Replace LaTeX \ldots with ...
        text = text.replace(/\\ldots/g, '...');

        if (text.includes('$') && text.trim().length < 3 && !isOpeningDollarSign && !isClosingDollarSignNextLine) {
            isOpeningDollarSign = true
            return ''
        }

        if (isOpeningDollarSign) {
            isOpeningDollarSign = false
            isClosingDollarSignNextLine = true
            text = `$${text}$`
        }

        if (text.includes('$') && text.trim().length < 3 && isClosingDollarSignNextLine) {
            isClosingDollarSignNextLine = false
            return ''
        }

    

        if (text.includes(':') && text.trim().length < 3) {
            return ''
        }

        if (text.includes('$')) {
            //replace \\$ with $
            text = text.replace(/\\\$/g, '$')
            //remove ** from the text
            text = text.replace(/\*\*/g, '')

            // Clean up LaTeX commands
            text = text.replace(/\\newlineeq/g, '=')  // Replace \\newlineeq with =
            text = text.replace(/\\newline/g, '\\\\')    // Replace \\newline with LaTeX new line

            // First split by LaTeX delimiters
            const parts = text.split(/(\$[^$]+\$)/g);

            return (
                <View style={styles.mixedContentContainer}>
                    {parts.map((part, index) => {
                        let isBuildingLatex = false;
                        if (part.startsWith('$') && part.endsWith('$')) {
                            console.log('[RENDER MIXED CONTENT] Part:', part);
                            // is next part starting with or?
                            if (parts[index + 1] && parts[index + 1].startsWith('or')) {
                                isBuildingLatex = true;
                            }
                            isBuildingLatex = true;
                            //remove new line
                            part = part.replace(/\n/g, '');
                            //replace \\sqrt with \sqrt
                            part = part.replace(/\\\\sqrt/g, '\\sqrt');
                            part = part.replace(/\\\\dfrac/g, '\\dfrac'); 
                            part = part.replace(/\\\\int/g, '\\int');
                            part = part.replace(/\\\\lim/g, '\\lim');
                            part = part.replace(/\\\\infty/g, '\\infty');
                            part = part.replace(/\\\\alpha/g, '\\alpha');
                            part = part.replace(/\\\\beta/g, '\\beta');
                            part = part.replace(/\\\\gamma/g, '\\gamma');
                            part = part.replace(/\\\\delta/g, '\\delta');
                            part = part.replace(/\\\\theta/g, '\\theta');
                            part = part.replace(/\\\\lambda/g, '\\lambda');
                            part = part.replace(/\\\\mu/g, '\\mu');
                            part = part.replace(/\\\\pi/g, '\\pi');
                            part = part.replace(/\\\\sigma/g, '\\sigma');
                            part = part.replace(/\\\\omega/g, '\\omega');
                             //replace \\frac with \frac
                            console.log('[RENDER MIXED CONTENT] new Part:', part);

                            const backslashCount = (part.match(/\\\\/g) || []).length;
                            const height = backslashCount > 0 ? `${60 * backslashCount}px` : undefined;
                                
                            let returnText = part.slice(1, -1);
                            if (parts[index + 1] && parts[index + 1].trim().startsWith('or')) {
                                const newPart = part.slice(0, -1) + '\\text{';
                                const lastPart = parts[index + 2].slice(1);
                                returnText = newPart + parts[index + 1] + "}" + lastPart
                                console.log('[RENDER MIXED CONTENT] or found', returnText);
                            }else{
                                console.log('[RENDER MIXED CONTENT] no or found', parts[index + 1]);
                            }
                            // Strip leading and trailing $ if present
                            if (returnText.startsWith('$') && returnText.endsWith('$')) {
                                returnText = returnText.slice(1, -1);
                            }
                            console.log('KaTeX input:', returnText);

                            if (parts[index - 1] && parts[index - 1].trim().startsWith('or')) {
                                return '';
                            }

                            // LaTeX content
                            return (
                                <View key={index} style={styles.latexContainer}>
                                    <KaTeX
                                        latex={returnText} // replace *** with ""
                                        height={height}
                                    />
                                </View>
                            );
                        } else {
                            if (part.trim().startsWith('or')) {
                                console.log('starts with or', part.trim());
                                return '';
                            }

                            //if part start with a , then remove the first character
                            if (part.trim().startsWith(',') || part.trim().startsWith('.')) {
                                part = part.slice(1);
                            }

                            //if part start with a , then remove the first character
                            
                            // Always use fontSize 14 for question, context, and hint
                            return (
                                <ThemedText key={index} style={[styles.contentText, { color: colors.text, fontSize: 14, lineHeight: 22 }]}> 
                                    {part.replace(/\*\*/g, '')}
                                </ThemedText>
                            );
                        }
                    })}
                </View>
            );
        }
        // First split by new line
        const parts = text.split('#$%');

        return (
            <View style={styles.mixedContentContainer}>
                {parts.map((part, index) => {
                    console.log('[RENDER MIXED CONTENT] Part:', part);
                    // Handle regular text with markdown
                    if (part.trim()) {
                        // Add extra spacing before lines starting with ***
                        const needsExtraSpacing = part.trim().startsWith('***');
                        // Always use fontSize 14 for question, context, and hint
                        // Handle regular text with bold formatting
                        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
                        return (
                            <View key={index} style={[
                                styles.textContainer,
                                needsExtraSpacing && { marginTop: 2 },
                            ]}>
                                {boldParts.map((boldPart, boldIndex) => {
                                    // For regular text (not LaTeX, not markdown), apply centered and italic if isOption
                                    if (isOption) {
                                        return (
                                            <ThemedText
                                                key={index}
                                                style={{ textAlign: 'center', fontStyle: 'italic', color: colors.text, fontSize: 14, width: '100%', lineHeight: 22 }}
                                            >
                                                {part}
                                            </ThemedText>
                                        );
                                    }
                                    return boldPart ? (
                                        <ThemedText
                                            key={`${index}-${boldIndex}`}
                                            style={[styles.contentText, { color: colors.text, fontSize: 14, lineHeight: 22 }]}
                                        >
                                            {boldPart.replace(/^\*\*\*/, '')}
                                        </ThemedText>
                                    ) : null;
                                })}
                            </View>
                        );
                    }
                    return null;
                })}
            </View>
        );
    }

    // Add fetchDailyUsage function
    const fetchDailyUsage = async () => {
        if (!user?.uid) return;
        try {
            const response = await fetch(`${HOST_URL}/api/learner/daily-usage?uid=${user.uid}`);
            const data = await response.json();
            if (data.status === "OK") {
                setRemainingMathsPractice(data.data.maths_practice);

                // Handle maths practice limits
                console.log('data.data.maths_practice', data.data.maths_practice);
                if (learnerInfo?.subscription === 'free' && data.data.maths_practice <= 0 && !hasShownPaywall) {
                    setTimeout(() => {
                        setShowPaywall(true);
                        setHasShownPaywall(true);
                    }, 3000);
                }
            }
        } catch (error) {
            // Handle error silently
        }
    };

    // Add useEffect for showing empty state
    useEffect(() => {
        if (remainingMathsPractice === 0 && !showPaywall && hasShownPaywall) {
            setShowEmptyState(true);
        } else {
            setShowEmptyState(false);
        }
    }, [remainingMathsPractice, showPaywall, hasShownPaywall]);

    // Load sounds when component mounts
    useEffect(() => {
        let isMounted = true;

        async function loadSounds() {
            try {
                // Configure audio mode first
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                });

                // Load sounds
                const correctSoundObject = new Audio.Sound();
                const incorrectSoundObject = new Audio.Sound();

                await correctSoundObject.loadAsync(require('../assets/audio/correct_answer.mp3'));
                await incorrectSoundObject.loadAsync(require('../assets/audio/bad_answer.mp3'));

                if (isMounted) {
                    setCorrectSound(correctSoundObject);
                    setIncorrectSound(incorrectSoundObject);
                }
            } catch (error) {
                console.error('Error loading sounds:', error);
            }
        }

        loadSounds();

        // Cleanup sounds when component unmounts
        return () => {
            isMounted = false;
            if (correctSound) {
                correctSound.unloadAsync();
            }
            if (incorrectSound) {
                incorrectSound.unloadAsync();
            }
        };
    }, []);

    // Function to play sound with error handling
    const playSound = async (sound: Audio.Sound | null) => {
        try {
            if (sound) {
                await sound.setPositionAsync(0);
                await sound.playAsync();
            }
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    useEffect(() => {
        if (
            currentStepIndex === sortedSteps.length - 1 &&
            selectedOptionIndex !== null &&
            sortedSteps.length > 0 &&
            correctAnswersCount === sortedSteps.length &&
            user?.uid &&
            selectedQuestion?.id &&
            !awardedPointsRef.current[selectedQuestion.id]
        ) {
            awardedPointsRef.current[selectedQuestion.id] = true;
            fetch(`${HOST_URL}/api/maths/update-maths-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, points: 30 })
            })
                .then(res => res.json())
                .then(data => {
                    setJustAwardedPoints(true);
                    setPerfectQuestionsCount(count => count + 1);
                    Toast.show({
                        type: 'success',
                        text1: 'Points Awarded!',
                        text2: 'You earned 30 points for getting all steps correct! 🎉',
                    });
                })
                .catch(() => {
                    Toast.show({
                        type: 'error',
                        text1: 'Points Error',
                        text2: 'Could not award points. Please check your connection.',
                    });
                });
        }
    }, [currentStepIndex, selectedOptionIndex, sortedSteps.length, correctAnswersCount, user?.uid, selectedQuestion?.id]);

    // Award 10 points for completing a question (regardless of performance)
    useEffect(() => {
        if (
            currentStepIndex === sortedSteps.length - 1 &&
            selectedOptionIndex !== null &&
            sortedSteps.length > 0 &&
            user?.uid &&
            selectedQuestion?.id &&
            !awardedPointsRef.current[`${selectedQuestion.id}_completion`]
        ) {
            awardedPointsRef.current[`${selectedQuestion.id}_completion`] = true;
            fetch(`${HOST_URL}/api/maths/update-maths-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, points: 10 })
            })
                .then(res => res.json())
                .then(data => {
                    Toast.show({
                        type: 'success',
                        text1: 'Question Completed!',
                        text2: 'You earned 10 points for completing this question! 📚',
                    });
                })
                .catch(() => {
                    Toast.show({
                        type: 'error',
                        text1: 'Points Error',
                        text2: 'Could not award completion points. Please check your connection.',
                    });
                });
        }
    }, [currentStepIndex, selectedOptionIndex, sortedSteps.length, user?.uid, selectedQuestion?.id]);

    useEffect(() => {
        if (
            sortedSteps.length >= 5 &&
            correctAnswersCount >= 5 &&
            user?.uid &&
            selectedQuestion?.id &&
            !awardedStreakRef.current[selectedQuestion.id] &&
            // Only award if the last 5 steps were all correct (i.e., no mistakes in the last 5 steps)
            currentStepIndex >= 4 &&
            selectedOptionIndex !== null
        ) {
            // Check if the last 5 steps were all answered correctly in a row
            // We'll need to track correct answers per step
            // For now, assume correctAnswersCount increments only on correct answers, so if the user gets 5 in a row, it matches
            awardedStreakRef.current[selectedQuestion.id] = true;
            fetch(`${HOST_URL}/api/maths/update-maths-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, points: 20 })
            })
                .then(res => res.json())
                .then(data => {
                    setJustAwardedStreakPoints(true);
                    Toast.show({
                        type: 'success',
                        text1: 'Streak Bonus!',
                        text2: 'You earned 20 points for 5 correct steps in a row! 🔥',
                    });
                })
                .catch(() => {
                    Toast.show({
                        type: 'error',
                        text1: 'Points Error',
                        text2: 'Could not award streak points. Please check your connection.',
                    });
                });
        }
    }, [correctAnswersCount, currentStepIndex, sortedSteps.length, user?.uid, selectedQuestion?.id, selectedOptionIndex]);

    useEffect(() => {
        if (perfectQuestionsCount === 3 && !awardedSessionRef.current && user?.uid) {
            awardedSessionRef.current = true;
            fetch(`${HOST_URL}/api/maths/update-maths-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, points: 25 })
            })
                .then(res => res.json())
                .then(data => {
                    setJustAwardedSessionPoints(true);
                    Toast.show({
                        type: 'success',
                        text1: 'Session Bonus!',
                        text2: 'You earned 25 points for completing 3 perfect questions in a session! 🏅',
                    });
                })
                .catch(() => {
                    Toast.show({
                        type: 'error',
                        text1: 'Points Error',
                        text2: 'Could not award session points. Please check your connection.',
                    });
                });
        }
    }, [perfectQuestionsCount, user?.uid]);

    return (
        <LinearGradient
            colors={isDark ? ['#1E1E1E', '#121212'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9']}
            style={[styles.gradient, { paddingTop: insets.top }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
        >
            {showPaywall && (
                <Paywall
                    onSuccess={() => {
                        setShowPaywall(false);
                        fetchDailyUsage();
                    }}
                    onClose={() => {
                        setShowPaywall(false);
                        if (remainingMathsPractice === 0) {
                            setShowEmptyState(true);
                        }
                    }}
                />
            )}
            {showEmptyState ? (
                <QuizEmptyState
                    onGoToProfile={() => router.push('/profile')}
                    onRestart={() => {
                        setShowEmptyState(false);
                        fetchDailyUsage();
                    }}
                    onGoBack={() => router.back()}
                    isQuizLimitReached={true}
                    mode="practice"
                />
            ) : (
                <>
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.container}
                        contentContainerStyle={styles.contentContainer}
                    >
                        <LocalHeader learnerInfo={learnerInfo} />
                       
                        
                        <View style={[styles.content, {
                            backgroundColor: isDark ? colors.card : '#FFFFFF',
                            borderColor: colors.border,
                            shadowColor: isDark ? '#000' : '#888',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.10,
                            shadowRadius: 12,
                            elevation: 4,
                        }]}>
                            {viewMode === 'topics' && (
                                <View style={styles.topicsGridContainer}>
                                    <ThemedText style={styles.topicsHeader}>🧠 What Do You Want to Practice Today?</ThemedText>
                                    {topics.length === 0 ? (
                                        <View style={styles.emptyStateContainer}>
                                            <Image
                                                source={limitImg}
                                                style={styles.emptyStateImage}
                                                resizeMode="contain"
                                            />
                                            <ThemedText style={styles.emptyStateTitle}>😅 Looks like the bookshelf is empty!</ThemedText>
                                            <ThemedText style={styles.emptyStateText}>
                                                We couldn't find any topics to practice. Please try again later or contact support if this persists.
                                            </ThemedText>
                                        </View>
                                    ) : (
                                        <View style={styles.topicsGrid}>
                                            {topics.map((topic, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={styles.topicCard}
                                                    onPress={async () => {
                                                        setSelectedTopic(topic);
                                                        setScoreStats({
                                                            total_answers: 0,
                                                            correct_answers: 0,
                                                            incorrect_answers: 0,
                                                            correct_percentage: 0,
                                                            incorrect_percentage: 0,
                                                        });
                                                        await fetchQuestionsForTopic(topic);
                                                        setViewMode('steps');
                                                        setCurrentStepIndex(0);
                                                        setSelectedOptionIndex(null);
                                                        setShowHint(false);
                                                    }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Select topic ${topic}`}
                                                >
                                                    <ThemedText style={styles.topicCardText}>
                                                        <Text>{getTopicEmoji(topic)} </Text>{topic}
                                                    </ThemedText>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}


                            {viewMode === 'steps' && !topic && !questionId && (
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginLeft: 8, marginBottom: 24 }}
                                    onPress={() => {
                                        setViewMode('topics');
                                        setSelectedTopic(null);
                                        setSelectedOptionIndex(null);
                                        setCurrentStepIndex(0);
                                        setShowHint(false);
                                        fetchMathTopics();
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Back to Topics"
                                >
                                    <Text style={{ fontSize: 18, marginRight: 4 }}>⬅️</Text>
                                    <ThemedText style={{ fontSize: 16, color: colors.textSecondary }}>Back to Topics</ThemedText>
                                </TouchableOpacity>
                            )}

                            {viewMode === 'steps' && !isLoadingQuestion && questionIds.length === 0 && (
                                <View style={styles.emptyStateContainer}>
                                    <Text style={{ fontSize: 64, marginBottom: 24 }}>🔍</Text>
                                    <ThemedText style={styles.emptyStateTitle}>No Questions Found</ThemedText>
                                    <ThemedText style={styles.emptyStateText}>
                                        We couldn't find any questions for the topic "{subtopic ? subtopic : topic}". Please try another topic or contact support if you believe this is an error.
                                    </ThemedText>
                                    <TouchableOpacity
                                        style={[styles.modernButton, { marginTop: 24, width: '100%' }]}
                                        onPress={() => router.back()}
                                        accessibilityRole="button"
                                        accessibilityLabel="Go back"
                                    >
                                        <ThemedText style={styles.modernButtonText}>Go Back</ThemedText>
                                    </TouchableOpacity>
                                </View>
                            )}


                            {viewMode === 'steps' && (
                                <>

{viewMode === 'steps' && (
                                        <PerformanceSummary
                                            stats={scoreStats}
                                            onRestart={() => setScoreStats({
                                                total_answers: 0,
                                                correct_answers: 0,
                                                incorrect_answers: 0,
                                                correct_percentage: 0,
                                                incorrect_percentage: 0,
                                            })}
                                        />
                                    )}

                                    {selectedTopic && (
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '100%',
                                            marginBottom: 8,
                                            paddingHorizontal: 12,
                                            backgroundColor: isDark ? '#23272F' : '#F3F4F6',
                                            borderRadius: 16,
                                            paddingVertical: 8,
                                            marginTop: 4,
                                        }}>
                                            <Text style={{ fontSize: 16, marginRight: 6 }}>📚</Text>
                                            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                                                {subtopic ? subtopic : selectedTopic}
                                            </ThemedText>
                                        </View>
                                    )}

                                    

                                    {/* Show remaining questions indicator in steps view */}
                                    {learnerInfo?.subscription === 'free' && remainingMathsPractice !== null && (
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: remainingMathsPractice <= 3 ? (isDark ? '#7F1D1D' : '#FEF2F2') : (isDark ? '#1E293B' : '#F0FDF4'),
                                            borderRadius: 12,
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            marginHorizontal: 16,
                                            marginBottom: 12,
                                            borderWidth: 1,
                                            borderColor: remainingMathsPractice <= 3 ? (isDark ? '#DC2626' : '#FECACA') : (isDark ? '#334155' : '#BBF7D0'),
                                        }}>
                                            <Text style={{ fontSize: 14, marginRight: 6 }}>
                                                {remainingMathsPractice <= 3 ? '⚠️' : '📚'}
                                            </Text>
                                            <ThemedText style={{ 
                                                fontSize: 14, 
                                                fontWeight: '600',
                                                color: remainingMathsPractice <= 3 ? (isDark ? '#FCA5A5' : '#DC2626') : (isDark ? '#A7F3D0' : '#15803D')
                                            }}>
                                                {remainingMathsPractice} remaining today
                                            </ThemedText>
                                        </View>
                                    )}

                                    

                                    {viewMode === 'steps' && (
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 8, width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: isDark ? '#23272F' : '#E5E7EB', borderWidth: 1, borderColor: isDark ? '#334155' : '#CBD5E1' }}>
                                            <TouchableOpacity
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: !showCompletedQuestions ? (isDark ? '#6366F1' : '#4F46E5') : 'transparent',
                                                    paddingVertical: 12,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                                onPress={() => setShowCompletedQuestions(false)}
                                                accessibilityRole="button"
                                                accessibilityLabel="Show new questions"
                                            >
                                                <ThemedText style={{ color: !showCompletedQuestions ? '#fff' : (isDark ? '#A7F3D0' : '#1E293B'), fontWeight: '600', fontSize: 16 }}>New</ThemedText>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: showCompletedQuestions ? (isDark ? '#6366F1' : '#4F46E5') : 'transparent',
                                                    paddingVertical: 12,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                                onPress={() => setShowCompletedQuestions(true)}
                                                accessibilityRole="button"
                                                accessibilityLabel="Show completed questions"
                                            >
                                                <ThemedText style={{ color: showCompletedQuestions ? '#fff' : (isDark ? '#A7F3D0' : '#1E293B'), fontWeight: '600', fontSize: 16 }}>Completed</ThemedText>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    
                                    {/* Add Question Navigation Arrows and Progress Indicator */}
                                    <View style={{ alignItems: 'center', marginBottom: 4 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 4 }}>
                                            <TouchableOpacity
                                                onPress={async () => {
                                                    if (currentQuestionIndex > 0) {
                                                        const prevIndex = currentQuestionIndex - 1;
                                                        setCurrentQuestionIndex(prevIndex);
                                                        await fetchQuestionDetails(filteredQuestionIds[prevIndex]);
                                                        setCurrentStepIndex(0);
                                                        setSelectedOptionIndex(null);
                                                        setShowHint(false);
                                                        setCorrectAnswersCount(0);
                                                        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                                                    }
                                                }}
                                                disabled={currentQuestionIndex === 0}
                                                style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1, padding: 8 }}
                                                accessibilityRole="button"
                                                accessibilityLabel="Previous Question"
                                            >
                                                <Ionicons name="arrow-back-circle" size={32} color={isDark ? '#6366F1' : '#4F46E5'} />
                                            </TouchableOpacity>
                                            {/* Next Question Icon */}
                                            <TouchableOpacity
                                                onPress={async () => {
                                                    if (currentQuestionIndex < filteredQuestionIds.length - 1) {
                                                        setCurrentStepIndex(0);
                                                        setSelectedOptionIndex(null);
                                                        setShowHint(false);
                                                        const nextIndex = currentQuestionIndex + 1;
                                                        setCurrentQuestionIndex(nextIndex);
                                                        await fetchQuestionDetails(filteredQuestionIds[nextIndex]);
                                                    }
                                                }}
                                                disabled={currentQuestionIndex === filteredQuestionIds.length - 1}
                                                style={{ opacity: currentQuestionIndex === filteredQuestionIds.length - 1 ? 0.5 : 1, padding: 8 }}
                                                accessibilityRole="button"
                                                accessibilityLabel="Next Question"
                                            >
                                                <Ionicons name="arrow-forward-circle" size={32} color={isDark ? '#6366F1' : '#4F46E5'} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.questionProgressWrapper}>
                                            <View style={styles.questionProgressContainer}>
                                                <View style={styles.questionProgressBar}>
                                                    <View
                                                        style={[
                                                            styles.questionProgressFill,
                                                            {
                                                                width: `${((currentQuestionIndex + 1) / filteredQuestionIds.length) * 100}%`,
                                                                backgroundColor: '#22C55E' // Green
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                                <ThemedText style={styles.questionProgressText}>
                                                    Question {currentQuestionIndex + 1} of {filteredQuestionIds.length}
                                                </ThemedText>
                                            </View>
                                        </View>
                                    </View>
                                </>
                            )}

                            {viewMode === 'steps' && selectedQuestion && !isLoadingQuestion && filteredQuestionIds.length > 0 && (
                                <View style={styles.stepsViewContainer}>

                                    <View style={[styles.stepsCard, { paddingTop: 8, paddingBottom: 96 }]}>

                                        {selectedQuestion?.context && (
                                            <View style={{ marginTop: 8 }}>
                                                {selectedQuestion.context.split('\n').map((line, index) => (
                                                    <View key={index}>
                                                        {renderMixedContent(line, isDark, colors)}
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {selectedQuestion?.image_path && selectedQuestion.image_path !== 'NULL' && (
                                            <View style={{ alignItems: 'center', marginVertical: 8 }}>
                                                <QuizAdditionalImage
                                                    imagePath={selectedQuestion.image_path}
                                                    onZoom={(url) => {
                                                        setZoomImageUrl(url);
                                                        setIsZoomModalVisible(true);
                                                    }}
                                                />
                                            </View>
                                        )}



                                        {selectedQuestion?.question && (
                                            <View style={{ marginTop: 8, marginBottom: 24 }}>
                                                {selectedQuestion.question.split('\n').map((line, index) => (
                                                    <View key={index}>
                                                        {renderMixedContent(line, isDark, colors)}
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {selectedQuestion?.question_image_path && selectedQuestion.question_image_path !== 'NULL' && (
                                            <View style={{ alignItems: 'center', marginVertical: 8 }}>
                                                <QuizAdditionalImage
                                                    imagePath={selectedQuestion.question_image_path}
                                                    onZoom={(url) => {
                                                        setZoomImageUrl(url);
                                                        setIsZoomModalVisible(true);
                                                    }}
                                                />
                                            </View>
                                        )}

                                        {/* Add Progress Indicator */}
                                        {selectedQuestion.steps && sortedSteps.length > 0 && (
                                            <View style={styles.progressContainer}>
                                                <View style={{ marginBottom: 16, alignItems: 'center' }}>
                                                    <ThemedText style={[styles.progressText, { fontSize: 18, marginBottom: 8 }]}>
                                                        🎯 Let's solve this step by step! 🚀
                                                    </ThemedText>
                                                    <ThemedText style={[styles.progressText, { fontSize: 16, color: colors.textSecondary }]}>
                                                        Follow along and learn the solution process 📝
                                                    </ThemedText>
                                                </View>
                                                <View style={styles.progressBar}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            {
                                                                width: `${((currentStepIndex + 1) / sortedSteps.length) * 100}%`,
                                                                backgroundColor: isDark ? '#6366F1' : '#4F46E5'
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                                <ThemedText style={[styles.progressText, { textAlign: 'center', fontSize: 24, fontWeight: 'bold', marginVertical: 8 }]}>
                                                    Step {currentStepIndex + 1} of {sortedSteps.length}
                                                </ThemedText>
                                            </View>
                                        )}

                                        {selectedQuestion.steps && sortedSteps.length > 0 && (
                                            <View ref={progressRef} key={currentStepIndex} style={[styles.stepsContainer, {
                                                backgroundColor: isDark ? colors.card : '#FFFFFF',
                                                borderColor: colors.border,
                                            }]}>
                                                <View style={{ marginBottom: 8 }}>

                                                    {sortedSteps[currentStepIndex]?.prompt && (
                                                        <View style={{ marginTop: 8 }}>
                                                            {sortedSteps[currentStepIndex].prompt.split('\n').map((line, index) => (
                                                                <View key={index}>
                                                                    {renderMixedContent(line, isDark, colors)}
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                                
                                                <TouchableOpacity
                                                    style={{ marginBottom: 8, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8, backgroundColor: isDark ? '#334155' : '#E0E7EF' }}
                                                    onPress={() => setShowHint(v => !v)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={showHint ? 'Hide hint' : 'Show hint'}
                                                >
                                                    <ThemedText style={{ color: isDark ? '#A7F3D0' : '#2563EB', fontWeight: '600' }}>
                                                        {showHint ? 'Hide Hint' : 'Show Hint'}
                                                    </ThemedText>
                                                </TouchableOpacity>
                                                {showHint && (
                                                    <View style={{ marginTop: 8, marginBottom: 8 }}>
                                                        {sortedSteps[currentStepIndex]?.hint.split('\n').map((line, index) => (
                                                            <View key={index}>
                                                                {renderMixedContent(line, isDark, colors)}
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}

                                                <View style={[
                                                    styles.stepsOptionsContainer,
                                                    isRowLayout && styles.stepsOptionsRow
                                                ]}>
                                                    {shuffledOptions.map((option, index) => {
                                                        // Set empty options to "0"
                                                        if (option === '' || option === null || option === undefined) {
                                                            option = "0";
                                                        }

                                                        const isCorrectAnswer = index === correctAnswerIndex;
                                                        const isSelected = selectedOptionIndex === index;
                                                        const isUserWrong = isSelected && !isCorrectAnswer;

                                                        let optionStyle = [styles.stepOptionButton, isRowLayout && styles.stepOptionButtonRow];
                                                        let dynamicOptionColors = {};
                                                        let icon = null;
                                                        let textColor = colors.text;

                                                        if (selectedOptionIndex !== null) {
                                                            if (isCorrectAnswer) {
                                                                dynamicOptionColors = { borderColor: '#22C55E' }; // green
                                                                textColor = '#15803D';
                                                            } else if (isUserWrong) {
                                                                dynamicOptionColors = { borderColor: '#DC2626' }; // red
                                                                textColor = '#B91C1C';
                                                            } else {
                                                                // Unselected and not correct
                                                                dynamicOptionColors = { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: '#E5E7EB', opacity: 0.5 };
                                                                textColor = colors.textSecondary;
                                                            }
                                                        } else if (!isSelected) {
                                                            dynamicOptionColors = { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: '#E5E7EB' };
                                                        }

                                                        return (
                                                            <TouchableOpacity
                                                                key={index}
                                                                style={[StyleSheet.flatten(optionStyle), dynamicOptionColors]}
                                                                onPress={() => {
                                                                    setSelectedOptionIndex(index);
                                                                    const isCorrect = index === correctAnswerIndex;

                                                                    // Log the correct answer for this step
                                                                    console.log('[STEP ANSWER] Step', currentStepIndex + 1, 'of', sortedSteps.length);
                                                                    console.log('[STEP ANSWER] User selected:', option);
                                                                    console.log('[STEP ANSWER] Correct answer:', sortedSteps[currentStepIndex].answer);
                                                                    console.log('[STEP ANSWER] Is correct:', isCorrect);

                                                                    // Play appropriate sound
                                                                    if (isCorrect) {
                                                                        playSound(correctSound);
                                                                    } else {
                                                                        playSound(incorrectSound);
                                                                    }

                                                                    setScoreStats(prev => {
                                                                        const correct = prev.correct_answers + (isCorrect ? 1 : 0);
                                                                        const incorrect = prev.incorrect_answers + (!isCorrect ? 1 : 0);
                                                                        const total = correct + incorrect;
                                                                        return {
                                                                            total_answers: total,
                                                                            correct_answers: correct,
                                                                            incorrect_answers: incorrect,
                                                                            correct_percentage: total ? Math.round((correct / total) * 100) : 0,
                                                                            incorrect_percentage: total ? Math.round((incorrect / total) * 100) : 0,
                                                                        };
                                                                    });
                                                                    if (isCorrect) setCorrectAnswersCount(count => count + 1);

                                                                    // If this is the last step, update daily usage
                                                                    if (currentStepIndex === sortedSteps.length - 1) {
                                                                        fetch(`${HOST_URL}/api/learner/daily-usage/maths-practice?uid=${user?.uid}&question_id=${filteredQuestionIds[currentQuestionIndex]}`, {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Content-Type': 'application/json'
                                                                            }
                                                                        })
                                                                            .then(response => response.json())
                                                                            .then(data => {
                                                                                if (data.status === "OK") {
                                                                                    console.log('[DEBUG] Maths practice updated:', data.message);
                                                                                    // Refresh daily usage to get updated count

                                                                                }
                                                                            })
                                                                            .catch(error => {
                                                                                console.error('Error updating daily usage:', error);
                                                                            });
                                                                    }
                                                                }}
                                                                disabled={selectedOptionIndex !== null}
                                                            >
                                                                <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {icon && <ThemedText style={{ fontSize: 20, marginRight: 8 }}>{icon}</ThemedText>}
                                                                    <View style={{ flex: 1 }}>
                                                                        {option.split('\n').map((line, lineIndex) => (
                                                                            <View key={lineIndex}>
                                                                                {renderMixedContent(line, isDark, { ...colors, text: textColor }, true)}
                                                                            </View>
                                                                        ))}
                                                                    </View>
                                                                </View>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        )}

                                        {selectedOptionIndex !== null && sortedSteps[currentStepIndex] && (
                                            <View style={{ marginTop: 16, marginBottom: 16 }}>
                                                {selectedOptionIndex !== null && (
                                                    selectedOptionIndex === correctAnswerIndex ? (
                                                        <ThemedText style={{ fontSize: 20, marginBottom: 8, textAlign: 'center' }} accessibilityRole="alert"> ✅ That's correct!</ThemedText>
                                                    ) : (
                                                        <ThemedText style={{ fontSize: 20, marginBottom: 8, textAlign: 'center' }} accessibilityRole="alert">❌ That's not correct!</ThemedText>
                                                    )
                                                )}
                                                {sortedSteps[currentStepIndex].teach && (
                                                    <View style={{ marginTop: 8, marginHorizontal: 16 }}>
                                                        {sortedSteps[currentStepIndex].teach.split('\n').map((line, index) => (
                                                            <View key={index}>
                                                                {renderMixedContent(line, isDark, colors)}
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                                {currentStepIndex === sortedSteps.length - 1 && selectedOptionIndex !== null && (
                                                    <View style={{ marginTop: 24, padding: 16, backgroundColor: isDark ? '#1E293B' : '#F0FDF4', borderRadius: 12, alignItems: 'center' }}>
                                                        <ThemedText style={{ fontSize: 24, marginBottom: 8, textAlign: 'center' }}>🎓 🎉 🎯</ThemedText>
                                                        <ThemedText style={{ fontSize: 18, textAlign: 'center', color: isDark ? '#A7F3D0' : '#15803D', fontWeight: '600' }}>
                                                            You've completed this question! Great job!
                                                        </ThemedText>
                                                        <ThemedText style={{ fontSize: 14, textAlign: 'center', color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
                                                            Ready for the next challenge?
                                                        </ThemedText>
                                                        {justAwardedPoints && (
                                                            <ThemedText style={{ fontSize: 16, color: '#22C55E', marginTop: 8, textAlign: 'center' }}>
                                                                +30 points for perfect steps! 🌟
                                                            </ThemedText>
                                                        )}
                                                        {justAwardedStreakPoints && (
                                                            <ThemedText style={{ fontSize: 16, color: '#F59E42', marginTop: 8, textAlign: 'center' }}>
                                                                +20 points for 5-step streak! 🔥
                                                            </ThemedText>
                                                        )}
                                                        {justAwardedSessionPoints && (
                                                            <ThemedText style={{ fontSize: 16, color: '#2563EB', marginTop: 8, textAlign: 'center' }}>
                                                                +25 points for 3 perfect questions this session! 🏅
                                                            </ThemedText>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        {currentStepIndex < sortedSteps.length - 1 && (
                                            <View style={[styles.nextStepIndicator, { flexDirection: 'row', justifyContent: 'center', gap: 16 }]}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setCurrentStepIndex(prevIndex => {
                                                            const prev = Math.max(prevIndex - 1, 0);
                                                            return prev;
                                                        });
                                                        setSelectedOptionIndex(null);
                                                        setShowHint(false);
                                                    }}
                                                    style={[styles.nextStepTouchable, {
                                                        backgroundColor: isDark ? colors.surface : '#F8FAFC',
                                                        padding: 12,
                                                        borderRadius: 8,
                                                        marginBottom: 16,
                                                        zIndex: 1000,
                                                        opacity: currentStepIndex === 0 ? 0.5 : 1,
                                                    }]}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Go to previous step"
                                                    disabled={currentStepIndex === 0}
                                                >
                                                    <ThemedText style={[styles.nextStepText, {
                                                        color: isDark ? '#6366F1' : '#4F46E5',
                                                        fontSize: 16,
                                                        fontWeight: '600',
                                                    }]}>⬅️ Prev Step</ThemedText>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        console.log('[DEBUG] Next step button pressed');
                                                        setCurrentStepIndex(prevIndex => {
                                                            console.log('[DEBUG] Setting step index from', prevIndex, 'to', prevIndex + 1);
                                                            const nextIndex = prevIndex + 1;
                                                            return nextIndex;
                                                        });
                                                        setSelectedOptionIndex(null);
                                                        setShowHint(false);
                                                        console.log('[DEBUG] About to scroll...');
                                                        // Scroll to progress text after state updates
                                                        setTimeout(() => {
                                                            console.log('[DEBUG] Inside setTimeout');
                                                            if (progressRef.current) {
                                                                console.log('[DEBUG] progressRef exists');
                                                                progressRef.current.measure((x, y, width, height, pageX, pageY) => {
                                                                    console.log('[DEBUG] Measure callback - pageY:', pageY, 'y:', y);
                                                                    const scrollView = scrollViewRef.current;
                                                                    if (scrollView) {
                                                                        console.log('[DEBUG] ScrollView exists, scrolling to y:', y - 120);
                                                                        scrollView.scrollTo({
                                                                            y: y - 120,
                                                                            animated: true
                                                                        });
                                                                    } else {
                                                                        console.log('[DEBUG] ScrollView is null');
                                                                    }
                                                                });
                                                            } else {
                                                                console.log('[DEBUG] progressRef is null');
                                                            }
                                                        }, 100);
                                                    }}
                                                    style={[styles.nextStepTouchable, {
                                                        backgroundColor: isDark ? colors.surface : '#F8FAFC',
                                                        padding: 12,
                                                        borderRadius: 8,
                                                        marginBottom: 16,
                                                        zIndex: 1000,
                                                        opacity: selectedOptionIndex === null || currentStepIndex === sortedSteps.length - 1 ? 0.5 : 1,
                                                    }]}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Go to next step"
                                                    disabled={selectedOptionIndex === null || currentStepIndex === sortedSteps.length - 1}
                                                >
                                                    <ThemedText style={[styles.nextStepText, {
                                                        color: isDark ? '#6366F1' : '#4F46E5',
                                                        fontSize: 16,
                                                        fontWeight: '600',
                                                    }]}>Next Step ➡️</ThemedText>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                    <SafeAreaView style={styles.stickyButtonBar} edges={['bottom']}>

                                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                                            {currentQuestionIndex < filteredQuestionIds.length - 1 && (
                                                <TouchableOpacity
                                                    style={styles.modernButton}
                                                    onPress={() => {
                                                        setCurrentStepIndex(0);
                                                        setSelectedOptionIndex(null);
                                                        setShowHint(false);
                                                        loadNextQuestion();
                                                    }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Next Question"
                                                >
                                                    <ThemedText style={styles.modernButtonText}>Next Question</ThemedText>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </SafeAreaView>
                                </View>
                            )}


                        </View>
                    </ScrollView>
                </>
            )}
            <ZoomModal
                isVisible={isZoomModalVisible}
                onClose={() => setIsZoomModalVisible(false)}
                zoomImageUrl={zoomImageUrl}
                imageRotation={imageRotation}
                setImageRotation={setImageRotation}
            />
        </LinearGradient>
    );
}

function getStyles(isDark: boolean, colors: any) {
    return StyleSheet.create({
        gradient: {
            flex: 1,
        },
        container: {
            flex: 1,
        },
        contentContainer: {
            flexGrow: 1,
            paddingHorizontal: 4,
            paddingBottom: 20,
        },
        content: {
            borderRadius: 20,
            padding: 4,
            marginTop: 28,
            borderWidth: 1,
            backgroundColor: '#FFF',
        },
        title: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 10,
            letterSpacing: 0.2,
            paddingHorizontal: 8,
        },
        subtitle: {
            fontSize: 14,
            marginBottom: 8,
            lineHeight: 26,
            fontWeight: '500',
            letterSpacing: 0.1,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        topicsGridContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 8,
            backgroundColor: isDark ? '#18181B' : '#F3F4F6',
        },
        topicsHeader: {
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 5,
            color: isDark ? '#A7F3D0' : '#1E293B',
            marginTop: 8,
        },
        topicsGrid: {
            width: '100%',
            maxWidth: 480,
            alignSelf: 'center',
        },
        topicCard: {
            width: '100%',
            backgroundColor: isDark ? '#27272A' : '#FFFFFF',
            borderRadius: 18,
            paddingVertical: 28,
            paddingHorizontal: 16,
            marginVertical: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.10,
            shadowRadius: 12,
            elevation: 4,
            alignItems: 'flex-start',
            minHeight: 80,
        },
        topicCardText: {
            fontSize: 16,
            color: isDark ? '#A7F3D0' : '#1E293B',
            textAlign: 'left',
        },
        stepsViewContainer: {
            flex: 1,
            backgroundColor: isDark ? '#18181B' : '#F3F4F6',
            borderRadius: 24,
            padding: 0,
            margin: 0,
            alignItems: 'center',
            justifyContent: 'flex-start',
        },
        stepsHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingHorizontal: 8,
            paddingTop: 8,
            marginBottom: 0,
            width: '100%',
            maxWidth: 420,
            alignSelf: 'center',
        },
        stepsCard: {
            backgroundColor: isDark ? '#23272F' : '#fff',
            borderRadius: 24,
            padding: 8,
            marginHorizontal: 0,
            marginBottom: 16,
            marginTop: 0,
            maxWidth: 420,
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        questionTextModern: {
            color: isDark ? '#F3F4F6' : '#1E293B',
            fontSize: 14,
            marginBottom: 8,
        },
        stepsTitle: {
            fontSize: 14,
            marginBottom: 12,
        },
        stepsHint: {
            fontSize: 14,
            fontStyle: 'italic',
            marginBottom: 8,
        },
        stepsTeach: {
            fontSize: 14,
            marginBottom: 16,
            lineHeight: 24,
        },
        stepsOptionsContainer: {
            gap: 12,
            marginBottom: 16,
        },
        stepsOptionsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 8,
        },
        stepOptionButton: {
            padding: 16,
            borderRadius: 8,
            borderWidth: 2,
            minHeight: 60,
            justifyContent: 'center',
            width: '100%',
            marginBottom: 8,
        },
        stepOptionButtonRow: {
            width: '28%',
            marginBottom: 8,
        },
        stepOptionText: {
            fontSize: 24
        },
        closeButton: {
            backgroundColor: isDark ? '#27272A' : '#E5E7EB',
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.10,
            shadowRadius: 6,
            elevation: 2,
        },
        closeButtonText: {
            fontSize: 22,
            color: isDark ? '#A7F3D0' : '#1E293B',
            fontWeight: '700',
        },
        stepsContainer: {
            marginTop: 8,
            padding: 20,
            borderRadius: 12,
            borderWidth: 1,
            backgroundColor: isDark ? colors.card : '#FFFFFF',
            borderColor: colors.border,
        },
        modernButton: {
            flex: 1,
            minHeight: 56,
            marginHorizontal: 8,
            borderRadius: 16,
            backgroundColor: isDark ? '#6366F1' : '#4F46E5',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 8,
            elevation: 3,
        },
        modernButtonDisabled: {
            backgroundColor: isDark ? '#334155' : '#CBD5E1',
        },
        modernButtonText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: 20,
            letterSpacing: 0.2,
        },
        backButton: {
            flex: 1,
            minHeight: 56,
            marginHorizontal: 8,
            borderRadius: 16,
            backgroundColor: isDark ? '#334155' : '#E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
        },
        backButtonText: {
            color: isDark ? '#A7F3D0' : '#1E293B',
            fontWeight: '700',
            fontSize: 20,
            letterSpacing: 0.2,
        },
        stickyButtonBar: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: 24,
            paddingHorizontal: 16,
            backgroundColor: 'transparent',
            zIndex: 100,
            alignItems: 'center',
        },
        nextStepIndicator: {
            alignItems: 'center',
            marginTop: 24,
            marginBottom: 16,
        },
        nextStepText: {
            fontSize: 16,
            fontWeight: '600',
            color: isDark ? '#6366F1' : '#4F46E5',
            marginBottom: 8,
        },
        arrow: {
            alignItems: 'center',
        },
        arrowBody: {
            width: 2,
            height: 24,
        },
        arrowHead: {
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderTopWidth: 12,
            borderStyle: 'solid',
            backgroundColor: 'transparent',
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
        },
        nextStepTouchable: {
            padding: 8,
            borderRadius: 8,
            marginBottom: 16,
        },
        progressContainer: {
            marginVertical: 16,
            width: '100%',
            alignItems: 'center',
        },
        progressBar: {
            width: '100%',
            height: 8,
            backgroundColor: isDark ? '#334155' : '#E5E7EB',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 8,
        },
        progressFill: {
            height: '100%',
            borderRadius: 4,
        },
        progressText: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#A7F3D0' : '#1E293B',
        },
        questionProgressContainer: {
            width: '100%',
            alignItems: 'center',
            marginBottom: 16,
            paddingHorizontal: 16,
            marginTop: 8,
        },
        questionProgressBar: {
            width: '100%',
            height: 6,
            backgroundColor: isDark ? '#334155' : '#E5E7EB',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 8,
        },
        questionProgressFill: {
            height: '100%',
            borderRadius: 3,
        },
        questionProgressText: {
            fontSize: 12,
            fontWeight: '500',
            color: isDark ? '#94A3B8' : '#64748B',
        },
        questionProgressWrapper: {
            width: '100%',
        },
        mixedContentContainer: {
            flex: 1,
            width: '100%',
        },
        latexContainer: {
            width: '100%',
            marginVertical: 4,
            color: '#000000',
            overflow: 'hidden',
        },
        h1Text: {
            fontSize: 20,
            fontWeight: 'bold',
            marginBottom: 10,
        },
        h2Text: {
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 8,
        },
        h3Text: {
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 6,
        },
        h4Text: {
            fontSize: 14,
            fontWeight: 'bold',
            marginBottom: 4,
        },
        contentText: {
            fontSize: 14,
        },
        bulletListContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        bulletPointContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        bulletPoint: {
            fontSize: 14,
            fontWeight: 'bold',
        },
        bulletPointText: {
            fontSize: 14,
        },
        bulletTextWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        bulletTextContent: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
        },
        textContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
        },
        boldText: {
            fontWeight: 'bold',
        },
        emptyStateContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            width: '100%',
            maxWidth: 480,
            alignSelf: 'center',
        },
        emptyStateImage: {
            width: 200,
            height: 200,
            marginBottom: 24,
        },
        emptyStateTitle: {
            fontSize: 24,
            fontWeight: '700',
            color: isDark ? '#A7F3D0' : '#1E293B',
            marginBottom: 12,
            textAlign: 'center',
        },
        emptyStateText: {
            fontSize: 16,
            color: isDark ? '#94A3B8' : '#64748B',
            textAlign: 'center',
            lineHeight: 24,
        },
    });
} 