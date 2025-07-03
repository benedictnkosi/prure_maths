import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, View, Linking, Dimensions, Platform, Animated, Share, useColorScheme, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Modal from 'react-native-modal';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import * as StoreReview from 'expo-store-review';
import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { checkAnswer, removeResults, getSubjectStats, setQuestionStatus, Badge } from '../services/api';
import { API_BASE_URL, HOST_URL } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BadgeCelebrationModal } from '@/components/BadgeCelebrationModal';
import { StreakModal, ReportModal, ExplanationModal, ZoomModal, RestartModal, ThankYouModal } from '@/app/components/quiz/quiz-modals';
import { FeedbackContainer } from '@/app/components/quiz/FeedbackContainer';
import { PerformanceSummary } from '@/app/components/quiz/PerformanceSummary';
import { QuizContextContainer } from './components/quiz/QuizContextContainer';
import { QuizAdditionalImage } from './components/quiz/QuizAdditionalImage';
import { QuizQuestionText } from './components/quiz/QuizQuestionText';
import { QuizOptionsContainer } from './components/quiz/QuizOptionsContainer';
import { QuizEmptyState } from './components/quiz/QuizEmptyState';
import { QuizFooter } from './components/quiz/QuizFooter';
import { KaTeX } from './components/quiz/KaTeX';
import { RandomAIQuestion } from '../types/api';
import { Colors } from '@/constants/Colors';
import { TopicProgressBar } from './components/quiz/TopicProgressBar';
import { FirstAnswerPointsModal } from './components/quiz/FirstAnswerPointsModal';
import { Paywall } from './components/Paywall';
import { getLearner } from '../services/api';
import { analytics } from '../services/analytics';

interface Question {
    id: number;
    question: string;
    type: string;
    context: string;
    answer: string;
    answer_image: string | null;
    image_path: string | null;
    other_context_images: string[] | null;
    options: {
        option1: string;
        option2: string;
        option3: string;
        option4: string;
    };
    question_image_path: string | null;
    year: string;
    term: string;
    explanation: string;
    curriculum?: string;
    ai_explanation?: string | null;
    subject: {
        id: number;
        name: string;
    }
    related_question_ids: number[];
    answer_sheet?: string;
    lecture_recording?: string;
    lecture_name?: string;
    lecture_image?: string;
    topic?: string;
}


interface QuestionResponse extends Question {
    status: string;
    message?: string;
}

// Helper function to clean the answer string
function cleanAnswer(answer: string): string {
    return answer.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Add helper variables
let isOpeningDollarSign = false;
let isClosingDollarSignNextLine = false;

// Add Table component before renderMixedContent
const Table = ({ html, isDark, colors }: { html: string; isDark: boolean; colors: any }) => {
    // Parse the HTML table
    const rows = html.match(/<tr>.*?<\/tr>/gs) || [];
    const tableData = rows.map(row => {
        const cells = row.match(/<(?:th|td)>(.*?)<\/(?:th|td)>/gs) || [];
        return cells.map(cell => {
            const content = cell.replace(/<(?:th|td)>(.*?)<\/(?:th|td)>/, '$1');
            const isHeader = cell.startsWith('<th>');
            return { content, isHeader };
        });
    });

    return (
        <View style={[styles.tableContainer, { borderColor: isDark ? colors.border : '#E5E7EB' }]}>
            {tableData.map((row, rowIndex) => (
                <View key={rowIndex} style={[styles.tableRow, { borderBottomColor: isDark ? colors.border : '#E5E7EB' }]}>
                    {row.map((cell, cellIndex) => (
                        <View key={cellIndex} style={[styles.tableCell, { borderRightColor: isDark ? colors.border : '#E5E7EB' }]}>
                            <ThemedText style={[
                                styles.tableCellText,
                                cell.isHeader && styles.tableHeaderText,
                                { color: colors.text }
                            ]}>
                                {cell.content}
                            </ThemedText>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
};

function renderMixedContent(text: string, isDark: boolean, colors: any) {
    if (!text) return null;

    // Check if the text contains a table
    if (text.includes('<table>')) {
        return <Table html={text} isDark={isDark} colors={colors} />;
    }

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
        //replace \$ with $
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
                    if (part.startsWith('$') && part.endsWith('$')) {
                        // LaTeX content
                        return (
                            <View key={index} style={[styles.latexContainer, {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF'
                            }]}>
                                <KaTeX
                                    latex={part.slice(1, -1)} // replace *** with ""
                                />
                            </View>
                        );
                    } else {
                        const fontSize = part.length > 500 ? 12 : 18;

                        if (part.trim().endsWith(':')) {
                            part = part.trim().slice(0, -1);
                        }
                        // Handle headers first
                        if (part.startsWith('# ')) {
                            //replace ** with ""
                            part = part.replace(/\*\*/g, '')
                            return (
                                <ThemedText key={index} style={[styles.h1Text, { color: colors.text, fontSize }]}>
                                    {part.substring(2).trim()}
                                </ThemedText>
                            );
                        }
                        if (part.startsWith('## ')) {
                            //replace ** with ""
                            part = part.replace(/\*\*/g, '')
                            return (
                                <ThemedText key={index} style={[styles.h2Text, { color: colors.text, fontSize }]}>
                                    {part.substring(3).trim()}
                                </ThemedText>
                            );
                        }
                        if (part.startsWith('### ')) {
                            //replace ** with ""
                            part = part.replace(/\*\*/g, '')
                            return (
                                <ThemedText key={index} style={[styles.h3Text, { color: colors.text, fontSize }]}>
                                    {part.substring(4).trim()}
                                </ThemedText>
                            );
                        }

                        if (part.startsWith('#### ')) {
                            //replace ** with ""
                            part = part.replace(/\*\*/g, '')
                            return (
                                <ThemedText key={index} style={[styles.h4Text, { color: colors.text, fontSize }]}>
                                    {part.substring(4).trim()}
                                </ThemedText>
                            );
                        }

                        return (
                            <ThemedText key={index} style={[styles.contentText, { color: colors.text }]}>
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
                // Handle regular text with markdown
                if (part.trim()) {
                    // Add extra spacing before lines starting with ***
                    const needsExtraSpacing = part.trim().startsWith('***');
                    const fontSize = part.length > 500 ? 12 : 12;
                    if (part.trim().endsWith(':')) {
                        part = part.trim().slice(0, -1);
                    }
                    // Handle headers first
                    if (part.startsWith('# ')) {
                        //replace ** with ""
                        part = part.replace(/\*\*/g, '')
                        return (
                            <ThemedText key={index} style={[styles.h1Text, { color: colors.text, fontSize }]}>
                                {part.substring(2).trim()}
                            </ThemedText>
                        );
                    }
                    if (part.startsWith('## ')) {
                        //replace ** with ""
                        part = part.replace(/\*\*/g, '')
                        return (
                            <ThemedText key={index} style={[styles.h2Text, { color: colors.text, fontSize }]}>
                                {part.substring(3).trim()}
                            </ThemedText>
                        );
                    }
                    if (part.startsWith('### ')) {
                        //replace ** with ""
                        part = part.replace(/\*\*/g, '')
                        return (
                            <ThemedText key={index} style={[styles.h3Text, { color: colors.text, fontSize }]}>
                                {part.substring(4).trim()}
                            </ThemedText>
                        );
                    }

                    if (part.startsWith('#### ')) {
                        //replace ** with ""
                        part = part.replace(/\*\*/g, '')
                        return (
                            <ThemedText key={index} style={[styles.h4Text, { color: colors.text, fontSize }]}>
                                {part.substring(4).trim()}
                            </ThemedText>
                        );
                    }

                    // Split into lines first to handle bullet points
                    const lines = part.split('\n').filter(line => line.trim());
                    const hasBulletPoints = lines.some(line => line.trim().startsWith('-'));

                    if (hasBulletPoints) {
                        return (
                            <View key={index} style={[
                                styles.bulletListContainer,
                                needsExtraSpacing && { marginTop: 24 }
                            ]}>
                                {lines.map((line, lineIndex) => {
                                    const trimmedLine = line.trim();
                                    if (trimmedLine.startsWith('-')) {
                                        const bulletContent = trimmedLine.substring(1).trim();
                                        // Handle bold text within bullet points
                                        const bulletBoldParts = bulletContent.split(/(\*\*[^*]+\*\*)/g);

                                        return (
                                            <View key={`${index}-${lineIndex}`} style={styles.bulletPointContainer}>
                                                <ThemedText style={[styles.bulletPoint, { color: colors.text }]}>•</ThemedText>
                                                <View style={styles.bulletTextWrapper}>
                                                    <View style={styles.bulletTextContent}>
                                                        {bulletBoldParts.map((bpart, bindex) => {
                                                            const trimmedPart = bpart.trim();
                                                            if (bpart.startsWith('**') && bpart.endsWith('**')) {
                                                                const boldContent = bpart.slice(2, -2).trim();
                                                                return (
                                                                    <ThemedText
                                                                        key={`bullet-bold-${bindex}`}
                                                                        style={[styles.bulletPointText, styles.boldText, { color: colors.text, fontSize }]}
                                                                    >
                                                                        {bpart.slice(2, -2).trim()}
                                                                    </ThemedText>
                                                                );
                                                            }
                                                            return bpart ? (
                                                                <ThemedText
                                                                    key={`bullet-text-${bindex}`}
                                                                    style={[styles.bulletPointText, { color: colors.text, fontSize }]}
                                                                >
                                                                    {bpart.trim()}
                                                                </ThemedText>
                                                            ) : null;
                                                        })}
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    }
                                    // For non-bullet point lines, still handle bold text
                                    const boldParts = trimmedLine.split(/(\*\*[^*]+\*\*)/g);
                                    return (
                                        <View key={`${index}-${lineIndex}`} style={[
                                            styles.textContainer,
                                            needsExtraSpacing && { marginTop: 24 }
                                        ]}>
                                            {boldParts.map((boldPart, boldIndex) => {
                                                if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                                                    return (
                                                        <ThemedText
                                                            key={`${index}-${boldIndex}`}
                                                            style={[styles.boldText, { color: colors.text, fontSize }]}
                                                        >
                                                            {boldPart.slice(2, -2)}
                                                        </ThemedText>
                                                    );
                                                }
                                                return boldPart ? (
                                                    <ThemedText
                                                        key={`${index}-${boldIndex}`}
                                                        style={[styles.contentText, { color: colors.text, fontSize }]}
                                                    >
                                                        {boldPart.replace(/^\*\*\*/, '')}
                                                    </ThemedText>
                                                ) : null;
                                            })}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    }

                    // Handle regular text with bold formatting
                    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
                    return (
                        <View key={index} style={[
                            styles.textContainer,
                            needsExtraSpacing && { marginTop: 2 }
                        ]}>
                            {boldParts.map((boldPart, boldIndex) => {
                                if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                                    return (
                                        <ThemedText
                                            key={`${index}-${boldIndex}`}
                                            style={[styles.boldText, { color: colors.text, fontSize }]}
                                        >
                                            {boldPart.slice(2, -2)}
                                        </ThemedText>
                                    );
                                }
                                return boldPart ? (
                                    <ThemedText
                                        key={`${index}-${boldIndex}`}
                                        style={[styles.contentText, { color: colors.text, fontSize }]}
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

// Add this array at the top level
const SUCCESS_MESSAGES = [
    '🎉 Great Job!',
    '🎯 You Nailed It!',
    '🚀 Superstar Move!',
    '🔥 You\'re on Fire!',
    '🧠 Big Brain Energy!',
    '🎖️ Champion Level Unlocked!',
    '⚡ Lightning Fast Thinking!',
    '🌟 Brilliant Answer!',
    '🏆 Winner Vibes!',
    '📚 Smart Cookie Alert!'
];

// Add this helper function
function getRandomSuccessMessage(): string {
    const randomIndex = Math.floor(Math.random() * SUCCESS_MESSAGES.length);
    return SUCCESS_MESSAGES[randomIndex];
}

// Add with the SUCCESS_MESSAGES array
const WRONG_ANSWER_MESSAGES = [
    '🤔 Hmm... Let\'s Learn!',
    '🎯 Oops! Let\'s Nail This!',
    '🚧 Not Quite! Try Again!',
    '🔄 Almost There! Keep Going!',
    '🧐 Think Again, You Got This!',
    '💡 Keep Trying! You Can Do It!',
    '🔍 Keep Searching! You\'re Close!'
];

function getRandomLoadingMessage(): string {
    const messages = [
        "Teaching the AI not to eat crayons… 🖍️🤖 Please hold!",
        "Convincing the AI it's smarter than a goldfish… 🐟💡",
        "Loading… The robots are arguing over who's in charge 🤖🤖⚔️",
        "Polishing ones and zeros until they sparkle ✨0️⃣1️⃣✨",
        "Hold on… the AI just went for a coffee ☕🤖 (typical!)",
        "Almost ready… just untangling the robot's shoelaces 🤖👟",
        "Your smart lesson is brewing… we hope the AI didn't forget the sugar 🍯🧠"
    ]
    return messages[Math.floor(Math.random() * messages.length)]
}

// Add helper function
function getRandomWrongMessage(): string {
    const randomIndex = Math.floor(Math.random() * WRONG_ANSWER_MESSAGES.length);
    return WRONG_ANSWER_MESSAGES[randomIndex];
}

// Add this array for favorite card colors
const FAVORITE_CARD_COLORS = [
    '#FF9FF3', // Pink
    '#FF9A8B', // Coral
    '#A0E57C', // Green
    '#FFF07C', // Yellow
    '#A0DDFF', // Light Blue
];

// Helper function to get a color for a card based on index
function getFavoriteCardColor(index: number): string {
    return FAVORITE_CARD_COLORS[index % FAVORITE_CARD_COLORS.length];
}

const NO_QUESTIONS_ILLUSTRATION = require('@/assets/images/illustrations/stressed.png');


const ImageLoadingPlaceholder = () => {
    const { isDark, colors } = useTheme();
    return (
        <View style={[styles.imagePlaceholderContainer, {
            backgroundColor: isDark ? colors.surface : '#F8FAFC'
        }]}>
            <View
                style={styles.loaderContainer}
            >
                <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : colors.primary} />

            </View>
        </View>
    );
};

const AiLoadingPlaceholder = () => {
    const { isDark, colors } = useTheme();
    return (
        <View style={[styles.imagePlaceholderContainer, {
            backgroundColor: isDark ? colors.surface : '#F8FAFC'
        }]}>
            <View
                style={styles.loaderContainer}
            >
                <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : colors.primary} />

            </View>
            <View
                style={styles.loaderContainer}
            >
                <ThemedText style={[styles.loadingText, { color: isDark ? colors.text : '#6B7280' }]}>
                    {getRandomLoadingMessage()}
                </ThemedText>

            </View>
        </View>
    );
};

// Update the FavoriteQuestion interface
interface FavoriteQuestion {
    id: string;
    createdAt: {
        date: string;
        timezone_type: number;
        timezone: string;
    };
    questionId: number;
    question: string;
    aiExplanation: string | null;
    subjectId: number;
    context: string;
    favoriteCount: number; // Add this property
}

interface PopularQuestion {
    questionId: number;
    question: string;
    aiExplanation: string | null;
    subjectId: number;
    context: string;
    favoriteCount: number;
}

// Add this component after the AnimatedFire component
const PointsAnimation = ({ points, isVisible }: { points: number; isVisible: boolean }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const { isDark } = useTheme();

    useEffect(() => {
        if (isVisible) {
            // Reset animations
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.3);

            // Start animations
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 4,
                    useNativeDriver: true,
                })
            ]).start();

            // Fade out after 2.5 seconds
            const timer = setTimeout(() => {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start();
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!isVisible) return null;

    // Always use star emoji for points
    const emoji = '⭐';

    return (
        <Animated.View
            style={[
                styles.pointsContainer,
                {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }],
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)'
                }
            ]}
        >
            <ThemedText style={styles.pointsText}>{emoji} {points}px</ThemedText>
        </Animated.View>
    );
};

// First, define the QuestionCard props interface
interface QuestionCardProps {
    question: Question | null;
    selectedAnswer: string | null;
    showFeedback: boolean;
    isAnswerLoading: boolean;
    selectedMode: 'quiz' | 'lessons' | 'practice';
    handleAnswer: (answer: string, options?: { sheet_cell: string }) => Promise<void>;
    cleanAnswer: (answer: string) => string;
    feedbackMessage: string;
    correctAnswer: string;
    isDark: boolean;
    colors: any;
    fetchAIExplanation: (questionId: number) => Promise<void>;
    isLoadingExplanation: boolean;
    learnerRole: string | string[];
    handleApproveQuestion: () => Promise<void>;
    isApproving: boolean;
    setZoomImageUrl: (url: string | null) => void;
    setIsZoomModalVisible: (visible: boolean) => void;
    renderMixedContent: (text: string, isDark: boolean, colors: any) => React.ReactNode;
    reportIssue: () => void;
    relatedQuestions: Question[];
    currentQuestionIndex: number;
    handleNextRelatedQuestion: () => void;
    handleListenToLecture: () => Promise<void>;
    isLoadingLecture: boolean;
    recordingFileName?: string;
    subjectName: string;
    setShowFeedback: (show: boolean) => void;
    isCorrect: boolean;
    learnerUid: string | null;
    grade: string;
}

// Then define the QuestionCard component
const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    selectedAnswer,
    showFeedback,
    isAnswerLoading,
    selectedMode,
    handleAnswer,
    cleanAnswer,
    feedbackMessage,
    correctAnswer,
    isDark,
    colors,
    fetchAIExplanation,
    isLoadingExplanation,
    learnerRole,
    handleApproveQuestion,
    isApproving,
    setZoomImageUrl,
    setIsZoomModalVisible,
    renderMixedContent,
    reportIssue,
    relatedQuestions,
    currentQuestionIndex,
    handleNextRelatedQuestion,
    handleListenToLecture,
    isLoadingLecture,
    recordingFileName,
    subjectName,
    setShowFeedback,
    isCorrect,
    learnerUid,
    grade
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isLoadingLecture) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [isLoadingLecture]);

    const handleShareQuestion = async () => {
        if (!question) return;

        try {
            const shareContent = {
                message: `Check out this ${selectedMode === 'lessons' ? 'lesson' : 'question'} from ExamQuiz:\n\n${subjectName}\n\nDownload ExamQuiz to test your knowledge!\n\nView this ${selectedMode === 'lessons' ? 'lesson' : 'question'} directly: https://examquiz.co.za/quiz?id=${question.id}&subjectName=${encodeURIComponent(subjectName)}`,
                title: `Share ${selectedMode === 'lessons' ? 'Lesson' : 'Question'}`,
            };

            await Share.share(shareContent);
        } catch (error) {
            console.error('Error sharing:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Failed to share ${selectedMode === 'lessons' ? 'lesson' : 'question'}`,
            });
        }
    };

    if (!question) return null;

    return (
        <ThemedView
            style={[styles.sectionCard, {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: colors.border
            }]}
            testID="question-card"
        >

            <View style={styles.questionHeader}>
                {(question.context || question.image_path) && (
                    <ThemedText
                        style={styles.questionMeta}
                        testID="context-label"
                    >
                        Context
                    </ThemedText>
                )}
            </View>

            {question.context && (
                <QuizContextContainer
                    context={question.context}
                    renderMixedContent={renderMixedContent}
                />
            )}

            {(question.image_path || question.question_image_path && question.image_path !== null && question.image_path !== 'NULL' && question.question_image_path !== null && question.question_image_path !== 'NULL') && (
                <ThemedText style={[styles.imageCaption, { color: colors.textSecondary }]}>
                    {Platform.OS === 'ios' ? 'Click image to enlarge / fix loading' : 'Click image to enlarge'}
                </ThemedText>
            )}

            {(question.image_path && question.image_path !== null && question.image_path !== 'NULL') && (
                <QuizAdditionalImage
                    imagePath={question.image_path}
                    onZoom={(url) => {
                        setZoomImageUrl(url);
                        setIsZoomModalVisible(true);
                    }}
                />
            )}

            {question.other_context_images && question.other_context_images.length > 0 && (
                <>
                    {question.other_context_images.map((imagePath, index) => (
                        <QuizAdditionalImage
                            key={`context-image-${index}`}
                            imagePath={imagePath}
                            onZoom={(url) => {
                                setZoomImageUrl(url);
                                setIsZoomModalVisible(true);
                            }}
                        />
                    ))}
                </>
            )}

            {(question.question || question.question_image_path) && (
                <ThemedText style={styles.questionMeta} testID='question-meta'>
                    Question
                </ThemedText>
            )}

            {(question.question_image_path && question.question_image_path !== null && question.question_image_path !== 'NULL') && (
                <QuizAdditionalImage
                    imagePath={question.question_image_path}
                    onZoom={(url) => {
                        setZoomImageUrl(url);
                        setIsZoomModalVisible(true);
                    }}
                />
            )}



            {question.question && (
                <View style={styles.questionContainer} testID='question-text'>
                    <QuizQuestionText
                        question={question.question}
                        renderMixedContent={renderMixedContent}
                    />
                </View>
            )}

            {selectedMode === 'quiz' && (
                <>
                    <View>
                        <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>
                            Tap to select your answer
                        </ThemedText>
                    </View>

                    <QuizOptionsContainer
                        options={question.options}
                        selectedAnswer={selectedAnswer}
                        showFeedback={showFeedback}
                        isAnswerLoading={isAnswerLoading}
                        currentQuestion={question}
                        onAnswer={handleAnswer}
                        cleanAnswer={cleanAnswer}
                    />
                </>
            )}

            {relatedQuestions.length > 1 && (
                <TouchableOpacity
                    style={[styles.relatedNavButton, {
                        backgroundColor: isDark ? colors.primary : '#7C3AED',
                        opacity: currentQuestionIndex === relatedQuestions.length - 1 && relatedQuestions.length > 1 ? 0.7 : 1,
                        marginVertical: 16,
                        marginHorizontal: 16,
                    }]}
                    onPress={handleNextRelatedQuestion}
                    disabled={currentQuestionIndex === relatedQuestions.length - 1}
                    testID="next-related-question-button"
                >
                    <View style={styles.relatedNavContent}>
                        <Ionicons
                            name="arrow-forward"
                            size={20}
                            color={currentQuestionIndex === relatedQuestions.length - 1 ? 'rgba(255, 255, 255, 0.5)' : '#FFFFFF'}
                        />
                        <ThemedText style={[styles.footerButtonText, currentQuestionIndex === relatedQuestions.length - 1 && { opacity: 0.5 }]}>
                            {currentQuestionIndex === relatedQuestions.length - 1
                                ? '🎯 Last Question'
                                : `🎯 Next Question (${currentQuestionIndex + 1}/${relatedQuestions.length})`}
                        </ThemedText>
                    </View>
                </TouchableOpacity>
            )}

            {selectedMode === 'quiz' && (
                <TouchableOpacity
                    style={[styles.reportButton, {
                        marginTop: 16,
                        marginHorizontal: 16,
                        backgroundColor: isDark ? colors.surface : '#FEE2E2'
                    }]}
                    onPress={reportIssue}
                    testID="report-issue-button"
                >
                    <ThemedText style={[styles.reportButtonText, { color: isDark ? '#FF3B30' : '#DC2626' }]}>
                        🛑 Report an Issue with this Question
                    </ThemedText>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[styles.shareButton, {
                    marginTop: 8,
                    marginHorizontal: 16,
                    backgroundColor: isDark ? colors.surface : '#F3F4F6',
                    borderColor: isDark ? colors.border : '#E5E7EB'
                }]}
                onPress={handleShareQuestion}
                testID="share-question-button"
            >
                <Ionicons
                    name="share-outline"
                    size={20}
                    color={isDark ? colors.text : '#4B5563'}
                />
                <ThemedText style={[styles.shareButtonText, { color: isDark ? colors.text : '#4B5563' }]}>
                    Share this {selectedMode === 'lessons' ? 'lesson' : 'question'}
                </ThemedText>
            </TouchableOpacity>

            {recordingFileName !== '' && selectedMode === 'lessons' && (
                <TouchableOpacity
                    style={[styles.lectureButton, {
                        backgroundColor: isDark ? '#059669' : '#10B981'
                    }]}
                    onPress={handleListenToLecture}
                    disabled={isLoadingLecture}
                    testID="lecture-button"
                >
                    <ThemedText style={styles.lectureButtonText}>
                        {isLoadingLecture ? (
                            <View
                                style={styles.loaderContainer}
                                testID="lecture-loading"
                            >
                                <ThemedText style={styles.lectureButtonText}>
                                    Loading lecture
                                    <Animated.Text style={[styles.loadingDots, { opacity: fadeAnim }]}>
                                        ...
                                    </Animated.Text>
                                </ThemedText>
                                <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : colors.primary} />
                            </View>
                        ) : (
                            '🎧 Listen to a Lecture'
                        )}
                    </ThemedText>
                </TouchableOpacity>
            )}

            {selectedMode === 'lessons' && (
                <>
                    {(question.ai_explanation && question.ai_explanation !== null && question.ai_explanation !== 'NULL') && (
                        <ThemedView
                            style={[styles.aiExplanationContainer, {
                                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                                borderColor: isDark ? '#4ADE80' : '#22C55E'
                            }]}
                            testID="correct-answer-container"
                        >
                            {question.ai_explanation?.split('\n').map((line, index) => {
                                const trimmedLine = line.trim();
                                if (trimmedLine.startsWith('-') && !trimmedLine.includes('- $')) {
                                    const content = trimmedLine.substring(1).trim();
                                    const indentLevel = line.indexOf('-') / 2;

                                    return (
                                        <View
                                            key={index}
                                            style={[
                                                styles.bulletPointRow,
                                                { marginLeft: indentLevel * 20 }
                                            ]}
                                        >
                                            <ThemedText style={[styles.bulletPoint, {
                                                color: isDark ? Colors.dark.text : Colors.light.text,
                                                marginTop: 4
                                            }]}>
                                                {indentLevel > 0 ? '•' : '👉'}
                                            </ThemedText>
                                            <View style={styles.bulletTextWrapper}>
                                                {renderMixedContent(content, isDark, colors)}
                                            </View>
                                        </View>
                                    );
                                }
                                if (trimmedLine.startsWith('-') && trimmedLine.includes('- $')) {
                                    line = trimmedLine.substring(1).trim();
                                }
                                return (
                                    <View key={index}>
                                        {renderMixedContent(line, isDark, colors)}
                                    </View>
                                );
                            })}
                        </ThemedView>
                    )}

                    <TouchableOpacity
                        style={[styles.reportButton, {
                            marginTop: 16,
                            marginHorizontal: 16,
                            backgroundColor: isDark ? colors.surface : '#FEE2E2'
                        }]}
                        onPress={reportIssue}
                        testID="report-issue-button"
                    >
                        <ThemedText style={[styles.reportButtonText, { color: isDark ? '#FF3B30' : '#DC2626' }]}>
                            🛑 Report an Issue with this Lesson
                        </ThemedText>
                    </TouchableOpacity>
                </>
            )}

            {showFeedback && selectedMode === 'quiz' && (
                <FeedbackContainer
                    feedbackMessage={feedbackMessage}
                    correctAnswer={correctAnswer}
                    isDark={isDark}
                    colors={colors}
                    cleanAnswer={cleanAnswer}
                    currentQuestion={question}
                    fetchAIExplanation={fetchAIExplanation}
                    isLoadingExplanation={isLoadingExplanation}
                    learnerRole={learnerRole}
                    handleApproveQuestion={handleApproveQuestion}
                    isApproving={isApproving}
                    setZoomImageUrl={setZoomImageUrl}
                    setIsZoomModalVisible={setIsZoomModalVisible}
                    renderMixedContent={renderMixedContent}
                    handleListenToLecture={handleListenToLecture}
                    isLoadingLecture={isLoadingLecture}
                    isLectureAvailable={recordingFileName !== ''}
                    subjectName={subjectName}
                    learnerUid={learnerUid ?? undefined}
                    grade={grade}
                />
            )}
        </ThemedView>
    );
};

// Add new interface for exam date response
interface ExamDateResponse {
    status: string;
    data: {
        subject_name: string;
        grade: number;
        exam_date: string;
    };
}

interface LectureRecordingResponse {
    status: string;
    message?: string;
    data: {
        id: string;
        recordingFileName: string;
        lecture_name: string;
        main_topic: string;
        image: string | null;
    };
}

async function resetTopicProgress(topic: string, user: any, subjectName: string, setStats: any, fetchTopicProgress: any) {
    if (!user?.uid || !topic) return;
    try {
        const response = await fetch(
            `${HOST_URL}/public/learn/topic/reset-progress?uid=${user.uid}&topic=${encodeURIComponent(topic)}&subject_name=${encodeURIComponent(subjectName)}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        if (response.ok) {
            setStats({
                total_answers: 0,
                correct_answers: 0,
                incorrect_answers: 0,
                correct_percentage: 0,
                incorrect_percentage: 0
            });
            await fetchTopicProgress(topic);
            Toast.show({
                type: 'success',
                text1: 'Progress Reset',
                text2: 'Topic progress has been reset',
                position: 'bottom'
            });
        }
    } catch (error) {
        Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to reset progress',
            position: 'bottom'
        });
    }
}

export default function QuizScreen() {
    const { user } = useAuth();
    const { colors, isDark } = useTheme();
    const params = useLocalSearchParams();
    const subjectName = params.subjectName as string;
    const learnerRole = params.learnerRole as string;
    const defaultTab = params.defaultTab as string;
    const topic = params.topic as string;
    const questionId = params.id as string;
    const lectureId = params.lectureId as string;
    const learningMode = params.learningMode as string;
    const [grade, setGrade] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [parentQuestion, setParentQuestion] = useState<Question | null>(null);
    const [childQuestionIds, setChildQuestionIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [noMoreQuestions, setNoMoreQuestions] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const scrollViewRef = React.useRef<ScrollView>(null);
    const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        total_answers: number;
        correct_answers: number;
        incorrect_answers: number;
        correct_percentage: number;
        incorrect_percentage: number;
    } | null>(null);
    const [isReportModalVisible, setIsReportModalVisible] = useState(false);
    const [isThankYouModalVisible, setIsThankYouModalVisible] = useState(false);
    const [reportComment, setReportComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const correctSound = useRef<Audio.Sound>();
    const incorrectSound = useRef<Audio.Sound>();
    const [isExplanationModalVisible, setIsExplanationModalVisible] = useState(false);
    const [aiExplanation, setAiExplanation] = useState<string>('');
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
    const [isAnswerLoading, setIsAnswerLoading] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string>('');
    const [isZoomModalVisible, setIsZoomModalVisible] = useState(false);
    const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
    const [imageRotation, setImageRotation] = useState(0);
    const [isRestartModalVisible, setIsRestartModalVisible] = useState(false);
    const [hasShownRating, setHasShownRating] = useState(false);
    const [duration, setDuration] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [favoriteQuestions, setFavoriteQuestions] = useState<FavoriteQuestion[]>([]);
    const [popularQuestions, setPopularQuestions] = useState<PopularQuestion[]>([]);
    const [isFavoritesLoading, setIsFavoritesLoading] = useState(false);
    const [isFavoriting, setIsFavoriting] = useState(false);
    const [isCurrentQuestionFavorited, setIsCurrentQuestionFavorited] = useState(false);
    const [isFromFavorites, setIsFromFavorites] = useState(false);
    const [isFirstAnswer, setIsFirstAnswer] = useState(false);
    const [showFirstAnswerModal, setShowFirstAnswerModal] = useState(false);
    // Add new state for streak modal
    const [showStreakModal, setShowStreakModal] = useState(false);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [correctAnswer, setCorrectAnswer] = useState<string>('');
    const [recordingFileName, setRecordingFileName] = useState<string>('');
    const [selectedMode, setSelectedMode] = useState<'quiz' | 'lessons' | 'practice'>(learningMode as 'quiz' | 'lessons' | 'practice' || 'quiz');
    const [isQuestionLoading, setIsQuestionLoading] = useState(false);
    const [showBadgeModal, setShowBadgeModal] = useState(false);
    const [newBadge, setNewBadge] = useState<Badge | null>(null);
    const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [relatedQuestions, setRelatedQuestions] = useState<Question[]>([]);
    const [showRelatedQuestions, setShowRelatedQuestions] = useState(false);
    const [totalRelatedQuestions, setTotalRelatedQuestions] = useState(0);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [remainingQuizzes, setRemainingQuizzes] = useState<number | null>(null);
    const [topicProgress, setTopicProgress] = useState<{
        total_questions: number;
        viewed_questions: number;
        progress_percentage: number;
    } | null>(null);
    // Add new state for exam dates
    const [examDates, setExamDates] = useState<{
        p1: string | null;
        p2: string | null;
    }>({ p1: null, p2: null });
    const [isLoadingExamDates, setIsLoadingExamDates] = useState(false);
    const [randomLesson, setRandomLesson] = useState<RandomAIQuestion | null>(null);
    const [isLectureModalVisible, setIsLectureModalVisible] = useState(false);
    const [isLoadingLecture, setIsLoadingLecture] = useState(false);
    const [lectureData, setLectureData] = useState<{
        id: string;
        recordingFileName: string;
        lecture_name: string;
        image: string | null;
        main_topic: string;
    } | null>(null);
    const [remainingLessons, setRemainingLessons] = useState<number>(0);
    const [quizLimitReached, setQuizLimitReached] = useState(false);
    const [offerings, setOfferings] = useState<any>(null);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);
    const [showPaywall, setShowPaywall] = useState(false);
    const [learnerInfo, setLearnerInfo] = useState<{
        subscription: string;
        terms: string;
    } | null>(null);

    // Add useEffect to handle topic parameter on mount
    useEffect(() => {
        if (topic) {
            handleTopicSelect(topic);
        }
    }, [topic]);

    // Add useEffect to call loadQuestion on component mount
    useEffect(() => {
        if (user?.uid && subjectName && !questionId && !topic) {
            // Only load question if we have user, subject name, and no specific question ID or topic
            // Default to P1 if no paper is selected
            const paperToLoad = selectedPaper || 'P1';
            loadQuestion(paperToLoad);
        }
    }, [user?.uid, subjectName, selectedPaper, questionId, topic]);

    // Add useEffect to get grade from AsyncStorage
    useEffect(() => {
        const getGrade = async () => {
            try {
                const storedGrade = await AsyncStorage.getItem('learnerGrade');
                setGrade(storedGrade);
            } catch (error) {
                console.error('Error getting grade from AsyncStorage:', error);
            }
        };
        getGrade();
    }, []);

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({
                animated: true
            });
        }, 500);
    };

    const startTimer = () => {
        // Clear any existing timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        // Reset duration and start new timer
        setDuration(0);
        timerRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };


    useEffect(() => {
        async function loadSounds() {
            try {
                const { sound: correct } = await Audio.Sound.createAsync(
                    require('@/assets/audio/correct_answer.mp3')
                );
                const { sound: incorrect } = await Audio.Sound.createAsync(
                    require('@/assets/audio/bad_answer.mp3')
                );
                correctSound.current = correct;
                incorrectSound.current = incorrect;
            } catch (error) {
                console.log('Error loading sounds:', error);
            }
        }
        loadSounds();

        return () => {
            if (correctSound.current) {
                correctSound.current.unloadAsync();
            }
            if (incorrectSound.current) {
                incorrectSound.current.unloadAsync();
            }
        };
    }, []);

    const playSound = async (isCorrect: boolean) => {
        try {
            // Check if sound is enabled in AsyncStorage
            const soundEnabled = await AsyncStorage.getItem('soundEnabled');

            // Only play sound if it's enabled (null means default which is true)
            if (soundEnabled === null || soundEnabled === 'true') {
                const soundToPlay = isCorrect ? correctSound.current : incorrectSound.current;
                if (soundToPlay) {
                    await soundToPlay.replayAsync();
                }
            }
        } catch (error) {
            console.log('Error playing sound:', error);
        }
    };

    // Add a function to safely close all modals
    const closeAllModals = useCallback(() => {
        setIsReportModalVisible(false);
        setIsThankYouModalVisible(false);
        setIsExplanationModalVisible(false);
        setIsZoomModalVisible(false);
        setIsRestartModalVisible(false);
        setShowBadgeModal(false);
        setShowStreakModal(false);
    }, []);

    const reportIssue = () => {
        closeAllModals();
        setIsReportModalVisible(true);
    };

    const handleSubmitReport = async () => {
        if (!reportComment.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a comment',
                position: 'bottom'
            });
            return;
        }

        try {
            setIsSubmitting(true);
            await setQuestionStatus({
                question_id: currentQuestion?.id || 0,
                status: 'rejected',
                email: user?.email || '',
                uid: user?.uid || '',
                comment: reportComment
            });

            // First close the report modal
            setIsReportModalVisible(false);
            //wait 3 seconds to show thank you modal 
            setTimeout(() => {

                // Use a small timeout to ensure the modal is fully dismissed
                setTimeout(() => {
                    setIsThankYouModalVisible(true);
                }, 3000);
            }, 3000);

            setReportComment('');

        } catch (error) {
            console.error('Error reporting issue:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to report issue',
                position: 'bottom'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Modify loadQuestion function
    const loadQuestion = async (paper: string, topic?: string) => {
        if (!user?.uid) {
            console.warn('User not authenticated');
            return;
        }

        if (!paper) {
            console.warn('Paper parameter is required');
            return;
        }

        // Reset all states before loading new question
        setCurrentQuestion(null);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsCorrect(null);
        setIsFromFavorites(false);
        stopTimer();
        setRecordingFileName('');
        setLectureData(null);
        setQuizLimitReached(false);

        try {
            setIsQuestionLoading(true);
            const endpoint = selectedMode === 'lessons' ? 'random' : 'byname';
            const encodedSubjectName = `${subjectName}`;

            // Get the current topic value directly from state
            const currentTopic = topic || selectedTopic;
            console.log('Loading question with topic:', currentTopic);
            console.log('Loading question with paper:', paper);
            console.log('Loading question with questionId:', questionId);
            console.log('Loading question with topic:', topic);
            console.log('Loading question with selectedTopic:', selectedTopic);
            console.log('Loading question with selectedMode:', selectedMode);
            console.log('Loading question with subjectName:', subjectName);
            console.log('Loading question with user.uid:', user.uid);
            console.log('Loading question with endpoint:', endpoint);

            // Build URL with topic if selected
            const url = new URL(`${API_BASE_URL}/question/${endpoint}`);
            url.searchParams.append('subject_name', encodedSubjectName);
            url.searchParams.append('paper_name', paper);
            url.searchParams.append('uid', user.uid);
            url.searchParams.append('question_id', (questionId || 0).toString());
            url.searchParams.append('subscriptionCheck', 'true');
            url.searchParams.append('version', '1');

            // Add topic parameter if currentTopic is set
            if (currentTopic) {
                url.searchParams.append('topic', currentTopic);
            }

            console.log('URL:', url.toString());

            const response = await fetch(url.toString());

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (response.status === 403) {
                setQuizLimitReached(true);
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                throw new Error(`Failed to fetch random question: ${response.status} ${response.statusText}`);
            }

            // If in lessons mode, fetch daily usage first
            if (selectedMode === 'lessons') {
                try {
                    fetchDailyUsage();
                } catch (error) {
                    setQuizLimitReached(true);
                    console.error('Error fetching daily usage:', error);
                }
            }

            // Only fetch stats from API for regular quiz (not topic quiz)
            if (!currentTopic) {
                console.log('Fetching regular quiz stats');
                const newStats = await getSubjectStats(user.uid, subjectName + " " + paper);
                setStats(newStats.data.stats);
            }

            const data: QuestionResponse = await response.json();
            if (data.status && data.status === "NOK" && data.message !== "No more questions available") {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: data.message,
                });
                return;
            }
            if (data.status === "NOK" && data.message === "No more questions available") {
                console.log('No more questions available');
                setNoMoreQuestions(true);
                setCurrentQuestion(null);
            } else {
                setCurrentQuestion(data);
                // Fetch lecture data if in lessons mode
                if (selectedMode === 'lessons' && data.id) {
                    try {
                        const lectureRes = await fetch(`${HOST_URL}/api/topics/recording/question/${data.id}`);
                        if (lectureRes.ok) {
                            const lectureJson = await lectureRes.json();
                            if (lectureJson.status === 'success') {
                                setRecordingFileName(lectureJson.data.recordingFileName);
                                setLectureData(lectureJson.data);
                            } else {
                                setRecordingFileName('');
                                setLectureData(null);
                            }
                        } else {
                            setRecordingFileName('');
                            setLectureData(null);
                        }
                    } catch (err) {
                        setRecordingFileName('');
                        setLectureData(null);
                    }
                } else {
                    setRecordingFileName('');
                    setLectureData(null);
                }

                //log answer
                console.log('answer', data.answer);
                //log question id
                console.log('question id', data.id);
                // Shuffle options
                const options = data.options;
                const entries = Object.entries(options);
                const shuffledEntries = entries.sort(() => Math.random() - 0.5);
                data.options = {
                    option1: shuffledEntries[0][1],
                    option2: shuffledEntries[1][1],
                    option3: shuffledEntries[2][1],
                    option4: shuffledEntries[3][1]
                };

                data.ai_explanation = data.ai_explanation ? data.ai_explanation
                    .replace(/\\n/g, '\\newline')
                    .replace(/\\\(/g, '$')
                    .replace(/\\\),/g, '$')
                    .replace(/\[/g, '$')
                    .replace(/\]/g, '$')
                    .replace(/\\\)\./g, '$')
                    .replace(/\\\)/g, '$')
                    .replace(/\\\\/g, '\\')
                    .replace(/\\text\{([^}]+)\}/g, '\\text{$1}')
                    .replace(/\[/g, '$')
                    .replace(/\]/g, '$')
                    .replace(/\\[[\]]/g, '$')
                    .replace(/\\newline/g, '=')
                    .replace(/\*\*: /g, '** ')
                    .replace(/\$\: /g, '$')
                    .replace(/\*\*\*/g, '**')
                    .replace(/\$\s*\n\s*([^$]+)\s*\n\s*\$/g, '$ $1 $')
                    : '';

                // If this question has related questions, load them
                if (data.related_question_ids && data.related_question_ids.length > 0) {
                    console.log('data.related_question_ids', data.related_question_ids)
                    const relatedQuestionsPromises = data.related_question_ids.map(async (id: number) => {
                        const relatedUrl = new URL(`${API_BASE_URL}/question/${endpoint}`);
                        relatedUrl.searchParams.append('subject_name', encodedSubjectName);
                        relatedUrl.searchParams.append('paper_name', paper);
                        relatedUrl.searchParams.append('uid', user.uid);
                        relatedUrl.searchParams.append('question_id', id.toString());
                        if (selectedTopic) {
                            relatedUrl.searchParams.append('topic', selectedTopic);
                        }
                        const response = await fetch(relatedUrl.toString());
                        if (!response.ok) return null;
                        const questionData = await response.json();
                        return questionData;
                    });

                    const relatedQuestionsData = await Promise.all(relatedQuestionsPromises);
                    const validRelatedQuestions = relatedQuestionsData.filter(Boolean);
                    setRelatedQuestions(validRelatedQuestions);
                    setCurrentQuestionIndex(0);
                    setShowRelatedQuestions(true);
                    setTotalRelatedQuestions(validRelatedQuestions.length);
                } else {
                    setRelatedQuestions([]);
                    setCurrentQuestionIndex(0);
                    setShowRelatedQuestions(false);
                    setTotalRelatedQuestions(0);
                }

                // Check if this question is in favorites and set the star accordingly
                const isFavorited = favoriteQuestions.some(fav => fav.questionId === data.id);
                setIsCurrentQuestionFavorited(isFavorited);

                setNoMoreQuestions(false);
                startTimer(); // Start timer when new question is loaded
            }
        } catch (error) {
            console.error('Error loading question:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load question',
                position: 'bottom'
            });
        } finally {
            setIsQuestionLoading(false);
            setIsLoading(false);
        }
    };

    const handleAnswer = async (answer: string, options?: { sheet_cell: string }) => {
        if (!user?.uid || !currentQuestion) return;

        // Use AsyncStorage to track if the first attempt for this question has been logged
        if (selectedAnswer === null) {
            const analyticsKey = `quiz_attempt_logged`;
            try {
                const alreadyLogged = await AsyncStorage.getItem(analyticsKey);
                if (!alreadyLogged) {
                    await analytics.track('Maths Quiz Attempt', {
                        userId: user?.uid,
                        questionId: currentQuestion.id,
                        selectedOption: answer,
                        correctAnswer: currentQuestion.answer,
                        isCorrect: answer === currentQuestion.answer,
                    });
                    await AsyncStorage.setItem(analyticsKey, 'true');
                }
            } catch (e) {
                // fail silently
            }
        }

        // Set flag to indicate answers were submitted
        await AsyncStorage.setItem('hasNewAnswers', 'true');

        try {
            stopTimer();
            setIsAnswerLoading(true);
            setSelectedAnswer(answer)

            const response = await checkAnswer(
                user.uid,
                currentQuestion.id,
                answer,
                duration
            );

            // Increment questions answered counter
            setQuestionsAnswered(prev => prev + 1);

            // Always award 1 point for correct answers
            const points = response.correct ? 1 : 0;

            setShowFeedback(true);
            setIsCorrect(response.correct);
            setFeedbackMessage(response.correct ? getRandomSuccessMessage() : getRandomWrongMessage());
            setCorrectAnswer(response.correctAnswer);
            fetchDailyUsage(); // Fetch updated daily usage after an answer

            // Show first answer bonus modal for first-time correct answers
            if (isFirstAnswer) {
                setTimeout(() => {
                    setShowFirstAnswerModal(true);
                    setIsFirstAnswer(false);
                }, 3000);
            }

            if (response.streakUpdated && response.correct) {
                setCurrentStreak(response.streak);
                setShowStreakModal(true);
                // Only prompt for rating after significant streak milestones (e.g., 5, 10, 25, 50)
                if (response.streak % 5 === 0) {
                    setTimeout(() => {
                        handleRating();
                    }, 2000);
                }
            } else if (response.streakUpdated) {
                setCurrentStreak(response.streak);
                setShowStreakModal(true);
            }

            // Update stats based on quiz type
            if (selectedTopic) {
                console.log('Updating topic quiz stats');
                // Update local stats for topic quiz
                setStats(prevStats => {
                    if (!prevStats) {
                        return {
                            total_answers: 1,
                            correct_answers: response.correct ? 1 : 0,
                            incorrect_answers: response.correct ? 0 : 1,
                            correct_percentage: response.correct ? 100 : 0,
                            incorrect_percentage: response.correct ? 0 : 100
                        };
                    }
                    const newTotal = prevStats.total_answers + 1;
                    const newCorrect = response.correct ? prevStats.correct_answers + 1 : prevStats.correct_answers;
                    const newIncorrect = !response.correct ? prevStats.incorrect_answers + 1 : prevStats.incorrect_answers;
                    return {
                        total_answers: newTotal,
                        correct_answers: newCorrect,
                        incorrect_answers: newIncorrect,
                        correct_percentage: (newCorrect / newTotal) * 100,
                        incorrect_percentage: (newIncorrect / newTotal) * 100
                    };
                });

                // Update topic progress after answering
                try {
                    const progressResponse = await fetch(
                        `${HOST_URL}/public/learn/topic/progress?uid=${user.uid}&topic=${encodeURIComponent(selectedTopic)}&subject_name=${encodeURIComponent(subjectName)}`
                    );
                    const progressData = await progressResponse.json();
                    if (progressData.status === "OK") {
                        setTopicProgress(progressData);
                    }
                } catch (error) {
                    console.error('Error updating topic progress:', error);
                }
            } else {
                console.log('Updating regular quiz stats');
                // Update stats from API for regular quiz
                const newStats = await getSubjectStats(user.uid, subjectName + " " + selectedPaper);
                setStats(newStats.data.stats);
            }

            // Play sound using the new playSound function
            await playSound(response.correct);


            // Remove the rating prompt after correct answer
            if (response.correct) {
                try {
                    const hasRated = await SecureStore.getItemAsync('has_reviewed_app');
                    const nextPromptDateStr = await SecureStore.getItemAsync('next_rating_prompt_date');

                    if (!hasRated && !hasShownRating) {
                        if (nextPromptDateStr) {
                            const nextPromptDate = new Date(nextPromptDateStr);
                            const now = new Date();

                            // Only show if we've passed the next prompt date
                            if (now >= nextPromptDate) {
                                // Removed rating prompt after correct answer
                            }
                        } else {
                            // Removed first time rating prompt
                        }
                    }
                } catch (error) {
                    console.error('Error checking rating status:', error);
                }
            }

            requestAnimationFrame(() => {
                scrollToBottom();
            });

            // Check for new badges after 5 seconds
            if (response.correct) {
                setTimeout(checkForNewBadges, 5000);
            }

        } catch (error) {
            console.error('Error submitting answer:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to submit answer',
                position: 'bottom'
            });
        } finally {
            setIsAnswerLoading(false);
        }
    };

    const handleNext = () => {
        if (!selectedPaper) return;


        if (selectedTopic) {
            // For topic quizzes, load next question and update progress
            loadQuestion(selectedPaper, selectedTopic).then(() => {
                // Update topic progress after loading new question
                fetchTopicProgress(selectedTopic);
            });
        } else {
            // For regular quizzes, just load next question
            loadQuestion(selectedPaper);
        }
    };

    const handleTopicSelect = async (topic?: string) => {
        console.log('Topic selected:', topic);

        if (selectedMode === 'practice') {
            // For practice mode, navigate to maths page with the topic
            router.push({
                pathname: '/maths',
                params: {
                    topic,
                    subjectName: subjectName,
                    learnerUid: user?.uid,
                    grade
                }
            });
            return;
        }

        // Initialize local stats for topic quiz with zeros
        setStats({
            total_answers: 0,
            correct_answers: 0,
            incorrect_answers: 0,
            correct_percentage: 0,
            incorrect_percentage: 0
        });

        // Set paper and reset UI state
        setSelectedPaper('P1');
        setSelectedAnswer(null);
        setShowFeedback(false);

        // Set the topic first
        setSelectedTopic(topic || null);

        // Reset topic progress if topic is selected
        if (topic && user?.uid) {
            try {
                await resetTopicProgress(topic, user, subjectName, setStats, fetchTopicProgress);
            } catch (error) {
                console.error('Error resetting topic progress:', error);
            }
        }

        // Add a small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now load the question with the topic
        if (topic) {
            console.log('Loading question with topic:', topic);
            loadQuestion('P1', topic);
        }
    };

    const handleNextRelatedQuestion = () => {
        if (relatedQuestions.length === 0) return;

        const nextIndex = (currentQuestionIndex + 1) % relatedQuestions.length;
        setCurrentQuestionIndex(nextIndex);
        setCurrentQuestion(relatedQuestions[nextIndex]);

        // Reset UI state for new question
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsCorrect(null);
        setFeedbackMessage('');
        startTimer();
    };

    const handleRestart = async () => {
        if (!user?.uid || !subjectName) return;

        try {
            setIsLoading(true);

            await removeResults(user.uid, subjectName + " " + selectedPaper);

            setCurrentQuestion(null);
            setSelectedAnswer(null);
            setShowFeedback(false);
            setIsCorrect(null);
            setNoMoreQuestions(false);
            setIsRestartModalVisible(false);

            await loadQuestion(selectedPaper || '');
            Toast.show({
                type: 'success',
                text1: 'Progress Reset',
                position: 'bottom'
            });
        } catch (error) {
            console.error('Error restarting quiz:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to restart quiz',
                position: 'bottom'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAIExplanation = async (questionId: number) => {
        setIsLoadingExplanation(true);
        try {

            const response = await fetch(
                `${API_BASE_URL}/question/ai-explanation?question_id=${questionId}`
            );
            const data = await response.json();
            if (data.status === "OK") {
                let explanation = data.explanation
                    .replace(/\\n/g, '\\newline')
                    .replace(/\\\(/g, '$')
                    .replace(/\\\),/g, '$')
                    .replace(/\[/g, '$')
                    .replace(/\]/g, '$')
                    .replace(/\\\)\./g, '$')
                    .replace(/\\\)/g, '$')
                    .replace(/\\\\/g, '\\')
                    .replace(/\\text\{([^}]+)\}/g, '\\text{$1}')
                    .replace(/\[/g, '$')
                    .replace(/\]/g, '$')
                    .replace(/\\[[\]]/g, '$')
                    .replace(/\\newline/g, '=')
                    .replace(/\*\*: /g, '** ')
                    .replace(/\$\: /g, '$')
                    .replace(/\*\*\*/g, '**')
                    .replace(/\$\s*\n\s*([^$]+)\s*\n\s*\$/g, '$ $1 $');

                setAiExplanation(explanation);
                closeAllModals();
                setIsExplanationModalVisible(true);
            }
        } catch (error) {
            console.error('Error fetching AI explanation:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Could not load AI explanation',
            });
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const handleApproveQuestion = async () => {
        //learner role is not admin or reviewer
        if (!currentQuestion?.id || !user?.uid || !user?.email || (learnerRole !== 'admin' && learnerRole !== 'reviewer')) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'You do not have permission to approve questions.',
                position: 'bottom'
            });
            return;
        }

        setIsApproving(true);
        try {
            await setQuestionStatus({
                question_id: currentQuestion.id,
                status: 'approved',
                email: user.email,
                uid: user.uid,
                comment: 'Question approved by admin'
            });
            Toast.show({
                type: 'success',
                text1: 'Question Approved',
                text2: 'The question has been approved successfully.',
                position: 'bottom'
            });
            await loadQuestion(selectedPaper || '');
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to approve question.',
                position: 'bottom'
            });
        } finally {
            setIsApproving(false);
        }
    };

    const handleFavoriteQuestion = async () => {
        if (!user?.uid || !currentQuestion) return;


        // Optimistically update UI
        setIsCurrentQuestionFavorited(true);
        setIsFavoriting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/question/favorite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    question_id: currentQuestion.id
                })
            });

            const data = await response.json();
            if (!response.ok) {
                if (data.message && data.message.includes('You can only favorite up to')) {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'You can only favorite up to 20 questions per paper',
                        position: 'bottom'
                    });
                }
                // Revert optimistic update if request fails
                setIsCurrentQuestionFavorited(false);
            }

            if (data.status === "OK") {
                Toast.show({
                    type: 'success',
                    text1: '⭐ Question Favorited!',
                    text2: 'Added to your favorites list',
                    position: 'bottom'
                });
                // Update favorites list
                await fetchFavoriteQuestions();
                //set selected tab as favorites
            } else {
                // Revert optimistic update if request fails
                setIsCurrentQuestionFavorited(false);
            }
        } catch (error) {
            // Revert optimistic update if request fails
            setIsCurrentQuestionFavorited(false);
            console.error('Error favoriting question:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to favorite question',
                position: 'bottom'
            });
        } finally {
            setIsFavoriting(false);
        }
    };

    const handleUnfavoriteQuestion = async () => {
        if (!user?.uid || !currentQuestion) return;

        // Optimistically update UI
        setIsCurrentQuestionFavorited(false);
        setIsFavoriting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/question/favorite`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    question_id: currentQuestion.id
                })
            });

            if (!response.ok) {
                // Revert optimistic update if request fails
                setIsCurrentQuestionFavorited(true);
                throw new Error('Failed to unfavorite question');
            }

            const data = await response.json();
            if (data.status === "OK") {
                Toast.show({
                    type: 'success',
                    text1: '⭐ Question Unfavorited',
                    text2: 'Removed from your favorites list',
                    position: 'bottom'
                });
                // Update favorites list
                await fetchFavoriteQuestions();
            } else {
                // Revert optimistic update if request fails
                setIsCurrentQuestionFavorited(true);
            }
        } catch (error) {
            // Revert optimistic update if request fails
            setIsCurrentQuestionFavorited(true);
            console.error('Error unfavoriting question:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to unfavorite question',
                position: 'bottom'
            });
        } finally {
            setIsFavoriting(false);
        }
    };

    // Check if the current question is in favorites
    const checkIfQuestionIsFavorited = useCallback(() => {
        if (!currentQuestion) return;
        const isFavorited = favoriteQuestions.some(fav => fav.questionId === currentQuestion.id);
        if (isFavorited !== isCurrentQuestionFavorited) {
            setIsCurrentQuestionFavorited(isFavorited);
        }
    }, [currentQuestion, favoriteQuestions, isCurrentQuestionFavorited]);

    // Add effect to check favorite status when question or favorites change
    useEffect(() => {
        checkIfQuestionIsFavorited();
    }, [currentQuestion, favoriteQuestions, checkIfQuestionIsFavorited]);

    const SubjectHeader = () => (
        <LinearGradient
            colors={isDark ? ['#4F46E5', '#4338CA'] : ['#10B981', '#047857']}
            style={styles.subjectHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
        >
            <View style={styles.headerContent}>

                <View style={styles.titleContainer}>
                    <ThemedText style={[styles.subjectTitle, { color: '#FFFFFF' }]}>{topic}</ThemedText>
                    <View style={styles.badgeContainer}>
                        {(currentQuestion || parentQuestion) && (
                            <>

                                {(currentQuestion || parentQuestion) && (
                                    <>

                                        <TouchableOpacity
                                            onPress={isCurrentQuestionFavorited ? handleUnfavoriteQuestion : handleFavoriteQuestion}
                                            disabled={isFavoriting}
                                            style={[styles.favoriteButton, {
                                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                                                marginRight: 8
                                            }]}
                                        >
                                            {isFavoriting ? (
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            ) : (
                                                <Ionicons
                                                    name={isCurrentQuestionFavorited ? "star" : "star-outline"}
                                                    size={14}
                                                    color={isCurrentQuestionFavorited ? '#FFD700' : (isDark ? '#FFFFFF' : '#000000')}
                                                />
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setIsNoteModalVisible(true)}
                                            style={[styles.favoriteButton, {
                                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                                                marginRight: 8
                                            }]}
                                        >
                                            <ThemedText style={{ fontSize: 18 }}>📝</ThemedText>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </View>

        </LinearGradient>
    );



    // Add this function to handle rating
    const handleRating = async () => {
        try {
            // Check if we should show the rating prompt
            const nextPromptDateStr = await SecureStore.getItemAsync('next_rating_prompt_date');
            if (nextPromptDateStr) {
                const nextPromptDate = new Date(nextPromptDateStr);
                const now = new Date();
                if (now < nextPromptDate) {
                    // Don't show the prompt yet
                    return;
                }
            }

            // First check if the StoreReview API is available
            const isAvailable = await StoreReview.isAvailableAsync();

            if (isAvailable) {
                // Try to use the native StoreReview API first
                await StoreReview.requestReview();
                // Store that user has reviewed regardless of the outcome
                // since we can't detect if they actually reviewed
                await SecureStore.setItemAsync('has_reviewed_app', 'true');
            } else {
                // Fallback to store URLs if native review not available
                const storeUrl = await StoreReview.storeUrl();
                if (storeUrl) {
                    await Linking.openURL(storeUrl);
                } else {
                    // Manual fallback URLs if storeUrl() returns null
                    if (Platform.OS === 'android') {
                        await Linking.openURL('market://details?id=za.co.examquizafrica');
                    } else {
                        await Linking.openURL('https://apps.apple.com/app/6742684696?action=write-review');
                    }
                }
            }

            // Set next prompt date to tomorrow
            const nextPromptDate = new Date();
            nextPromptDate.setDate(nextPromptDate.getDate() + 1);
            await SecureStore.setItemAsync('next_rating_prompt_date', nextPromptDate.toISOString());
        } catch (error) {
            console.error('Error requesting review:', error);
            // Fallback to web URLs if all else fails
            try {
                if (Platform.OS === 'android') {
                    await Linking.openURL('https://play.google.com/store/apps/details?id=za.co.examquizafrica');
                } else {
                    await Linking.openURL('https://apps.apple.com/app/6742684696?action=write-review');
                }
            } catch (fallbackError) {
                console.error('Error opening store URL:', fallbackError);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Could not open app store. Please try again later.',
                    position: 'bottom'
                });
            }
        }
    };

    // Add this function to handle postponing the rating
    const handlePostponeRating = async () => {
        // Set a future date to ask for review again (in 24 hours)
        const nextPromptDate = new Date();
        nextPromptDate.setDate(nextPromptDate.getDate() + 1);
        await SecureStore.setItemAsync('next_rating_prompt_date', nextPromptDate.toISOString());
    };

    const fetchFavoriteQuestions = async () => {
        if (!user?.uid) return;

        try {
            setIsFavoritesLoading(true);
            const response = await fetch(
                `${API_BASE_URL}/question/favorite?uid=${user.uid}&subject_name=${subjectName}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch favorites');
            }

            const data = await response.json();
            if (data.status === "OK") {
                // The response data is in data.data array
                setFavoriteQuestions(data.data || []);
                setPopularQuestions(data.popular || []);
            }
        } catch (error) {
            console.error('Error fetching favorites:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load favorite questions',
                position: 'bottom'
            });
        } finally {
            setIsFavoritesLoading(false);
        }
    };

    // Call fetchFavoriteQuestions when component mounts and when user changes
    useEffect(() => {
        fetchFavoriteQuestions();
    }, [user?.uid]);

    const loadFavoriteQuestion = async (questionId: number) => {
        setIsFromFavorites(true);
        loadSpecificQuestion(questionId);

    }

    const loadSpecificQuestion = async (questionId: number) => {
        console.log('loadSpecificQuestion called with:', { questionId, subjectName, user: user?.uid });
        if (!user?.uid || !subjectName) {
            console.log("No user or subject name");
            return;
        };
        try {
            setSelectedMode('quiz');
            setIsLoading(true);

            const url = `${API_BASE_URL}/question/byname?subject_name=${subjectName}&paper_name=P1&uid=${user.uid}&question_id=${questionId}?subscriptionCheck=true`;
            console.log('Fetching question from URL:', url);

            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to fetch question:', response.status, response.statusText);
                throw new Error('Failed to fetch question');
            }
            const data: QuestionResponse = await response.json();
            console.log('Question response:', data);
            setCurrentQuestion(data);

            // Set the selectedPaper to ensure the question is displayed, split and get the last part
            setSelectedPaper(data.subject.name.split(" ").pop() || 'P1');

            // Check if this question is in favorites and set the star accordingly
            const isFavorited = favoriteQuestions.some(fav => fav.questionId === questionId);
            setIsCurrentQuestionFavorited(isFavorited);

            setNoMoreQuestions(false);

            // Reset the UI state for a new question
            setSelectedAnswer(null);
            setShowFeedback(false);
            setIsCorrect(null);
            setFeedbackMessage('');
        } catch (error) {
            console.error('Error loading favorite question:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load saved question',
                position: 'bottom'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Add useEffect to handle questionId parameter on mount
    useEffect(() => {
        console.log('useEffect triggered with questionId:', questionId);
        if (questionId) {
            const numericId = parseInt(questionId, 10);
            if (!isNaN(numericId)) {
                console.log('Loading specific question with ID:', numericId);
                loadSpecificQuestion(numericId);
            } else {
                console.error('Invalid question ID:', questionId);
            }
        }
    }, [questionId]);

    const checkForNewBadges = async () => {
        if (!user?.uid) return;

        try {
            const response = await fetch(`${HOST_URL}/api/badges/check/${user.uid}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            if (!response.ok) throw new Error('Failed to check badges');

            const data = await response.json();
            if (data.status === 'OK' && data.new_badges && data.new_badges.length > 0) {
                // Show the first new badge
                setNewBadge(data.new_badges[0]);
                setShowBadgeModal(true);
            }
        } catch (error) {
            console.error('Error checking for new badges:', error);
        }
    };

    const handleSubmitNote = async () => {
        if (!user?.uid || !currentQuestion || !noteText.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a note',
                position: 'bottom'
            });
            return;
        }

        setIsSubmittingNote(true);


        try {

            const response = await fetch(`${API_BASE_URL}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: user.uid,
                    subject_name: subjectName,
                    text: noteText.trim()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }

            const data = await response.json();
            if (data.status === "OK") {
                Toast.show({
                    type: 'success',
                    text1: '📝 Note Saved!',
                    text2: 'Your note has been saved successfully',
                    position: 'bottom',
                    visibilityTime: 2000
                });
                // Wait a brief moment before closing the modal
                await new Promise(resolve => setTimeout(resolve, 500));
                setNoteText('');
                setIsNoteModalVisible(false);
            } else {
                throw new Error('Failed to save note');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to save note',
                position: 'bottom'
            });
        } finally {
            setIsSubmittingNote(false);
        }
    };

    // Add function to fetch exam dates
    const fetchExamDates = async () => {

        if (!user?.uid || !subjectName || grade !== '12') {

            return;
        }

        try {
            setIsLoadingExamDates(true);
            const encodedSubjectName = encodeURIComponent(`${subjectName}`);

            // Fetch both P1 and P2 dates
            const [p1Response, p2Response] = await Promise.all([
                fetch(`${HOST_URL}/api/learner-subjects/exam-date/12/${encodedSubjectName}%20P1`),
                fetch(`${HOST_URL}/api/learner-subjects/exam-date/12/${encodedSubjectName}%20P2`)
            ]);

            const p1Data: ExamDateResponse = await p1Response.json();
            const p2Data: ExamDateResponse = await p2Response.json();

            setExamDates({
                p1: p1Data.status === 'OK' ? p1Data.data.exam_date : null,
                p2: p2Data.status === 'OK' ? p2Data.data.exam_date : null
            });
        } catch (error) {
            console.error('Error fetching exam dates:', error);
        } finally {
            setIsLoadingExamDates(false);
        }
    };

    // Add useEffect to fetch exam dates when grade changes
    useEffect(() => {
        if (grade === '12') {
            fetchExamDates();
        }
    }, [grade, subjectName]);

    // Add ExamDateDisplay component
    const ExamDateDisplay = () => {
        if (grade !== '12' || isLoadingExamDates) return null;

        // If both dates are null or undefined, don't show the component
        if (!examDates.p1 && !examDates.p2) return null;

        const formatDate = (dateString: string | null) => {
            if (!dateString) return 'Not available';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Not available';

                // Format the date to show only month, day and time
                const month = date.toLocaleDateString('en-US', {
                    month: 'long',
                });
                const dayNum = date.getDate();
                const time = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                return `${month} ${dayNum} at ${time}`;
            } catch (error) {
                return 'Not available';
            }
        };

        // Check if both dates are in the past
        const isDateInPast = (dateString: string | null): boolean => {
            if (!dateString) return false;
            try {
                const date = new Date(dateString);
                return date < new Date();
            } catch (error) {
                return false;
            }
        };

        // If both dates are in the past, don't show the component
        if (isDateInPast(examDates.p1) && isDateInPast(examDates.p2)) return null;

        return (
            <ThemedView style={[styles.examDateContainer, {
                backgroundColor: isDark ? colors.card : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'
            }]}>
                <View style={styles.examDateHeader}>
                    <ThemedText style={[styles.examDateTitle, {
                        color: colors.text,
                        marginBottom: 4
                    }]}>
                        📅 Upcoming Exam Dates
                    </ThemedText>

                </View>
                <View >
                    <ThemedText style={[styles.examDateSubtext, {
                        color: colors.text,
                        opacity: 0.7,
                        fontSize: 12,
                        marginBottom: 12
                    }]}>
                        Dates are subject to change. Please verify with your school.
                    </ThemedText>
                </View>
                <View style={styles.examDateGrid}>
                    <View style={[styles.examDateItem, {
                        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : '#F0F9FF',
                        borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#BAE6FD',
                        opacity: !examDates.p1 ? 0.7 : 1
                    }]}>
                        <View style={styles.examDateLabelContainer}>
                            <ThemedText style={[styles.examDateLabel, {
                                color: isDark ? '#7DD3FC' : '#0369A1',
                                marginBottom: 4
                            }]}>
                                📝 Paper 1
                            </ThemedText>
                        </View>
                        <ThemedText style={[styles.examDateValue, {
                            color: !examDates.p1
                                ? (isDark ? 'rgba(255, 255, 255, 0.5)' : colors.textSecondary)
                                : (isDark ? '#38BDF8' : '#0369A1')
                        }]}>
                            {!examDates.p1 ? '⏳ Not available' : `⏰ ${formatDate(examDates.p1)}`}
                        </ThemedText>
                    </View>
                    <View style={[styles.examDateItem, {
                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
                        borderColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#BBF7D0',
                        opacity: !examDates.p2 ? 0.7 : 1
                    }]}>
                        <View style={styles.examDateLabelContainer}>
                            <ThemedText style={[styles.examDateLabel, {
                                color: isDark ? colors.textSecondary : '#166534',
                                marginBottom: 4
                            }]}>
                                📝 Paper 2
                            </ThemedText>
                        </View>
                        <ThemedText style={[styles.examDateValue, {
                            color: !examDates.p2
                                ? colors.textSecondary
                                : (isDark ? colors.text : '#166534')
                        }]}>
                            {!examDates.p2 ? '⏳ Not available' : `⏰ ${formatDate(examDates.p2)}`}
                        </ThemedText>
                    </View>
                </View>

            </ThemedView>
        );
    };



    const handleListenToLecture = async () => {
        try {
            setIsLoadingLecture(true);
            console.log('Fetching lecture recording for question ID:', currentQuestion?.id);
            const response = await fetch(`${HOST_URL}/api/topics/recording/question/${currentQuestion?.id}`);
            console.log('Response status:', response.status);

            if (!response.ok) {
                console.error('Response not OK:', response.statusText);
                throw new Error('Failed to fetch lecture recording');
            }
            const data: LectureRecordingResponse = await response.json();
            console.log('Lecture recording response:', JSON.stringify(data, null, 2));

            if (data.status === 'success') {
                console.log('Setting lecture data:', data.data);
                setRecordingFileName(data.data.recordingFileName);
                setLectureData(data.data);
                console.log('Setting modal visible to true');
                setIsLectureModalVisible(true);
                console.log('Modal visibility state set to true');
            } else {
                console.error('API returned non-success status:', data.status);
                throw new Error(data.message || 'Failed to fetch lecture');
            }
        } catch (error) {
            console.error('Error handling lecture:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load lecture',
            });
        } finally {
            setIsLoadingLecture(false);
        }
    };


    const fetchTopicProgress = async (topic: string) => {
        if (!user?.uid) return;
        try {
            const response = await fetch(
                `${HOST_URL}/public/learn/topic/progress?uid=${user.uid}&topic=${encodeURIComponent(topic)}&subject_name=${encodeURIComponent(subjectName)}`
            );
            const data = await response.json();
            if (data.status === "OK") {
                setTopicProgress(data);
            }
        } catch (error) {
            console.error('Error fetching topic progress:', error);
        }
    };

    const fetchDailyUsage = async () => {
        if (!user?.uid) {
            console.warn("User not authenticated, skipping fetchDailyUsage.");
            return;
        }
        try {
            const response = await fetch(`${HOST_URL}/api/learner/daily-usage?uid=${user.uid}`);
            const data = await response.json();
            console.log('[Question13Modal] Daily usage response:', data);
            if (data.status === "OK") {
                setRemainingLessons(data.data.lesson);
                if (data.data.quiz !== undefined) {
                    console.log('[Question13Modal] Setting remaining quizzes:', data.data.quiz);
                    setRemainingQuizzes(data.data.quiz);

                    // Handle quiz limits
                    if (selectedMode === 'quiz' && learnerInfo?.subscription === 'free' && data.data.quiz <= 0) {
                        setTimeout(() => {
                            setShowPaywall(true);
                        }, 3000);
                    }

                    // Handle lesson limits
                    if (selectedMode === 'lessons' && learnerInfo?.subscription === 'free' && data.data.lesson <= 0) {
                        setQuizLimitReached(true);
                        setTimeout(() => {
                            setShowPaywall(true);
                        }, 3000);
                    }
                }
            } else {
                setQuizLimitReached(true); // Assume limit reached if status is not OK
                console.warn('Failed to fetch daily usage or status not OK:', data.message);
            }
        } catch (error) {
            console.error('Error fetching daily usage:', error);
            setQuizLimitReached(true); // Assume limit reached on error
        }
    };

    useEffect(() => {
        if (user?.uid) {
            fetchDailyUsage();
        }
    }, [user?.uid, selectedMode]);

    useEffect(() => {
        async function fetchLectureRecording() {
            if (!lectureId) {
                console.log('No lectureId provided, skipping fetch');
                return;
            }

            try {
                console.log('Fetching lecture recording for ID:', lectureId);
                console.log('API URL:', `${HOST_URL}/api/topics/recording/${lectureId}`);
                const response = await fetch(`${HOST_URL}/api/topics/recording/${lectureId}`);
                console.log('Response status:', response.status);

                if (!response.ok) {
                    console.error('Response not OK:', response.statusText);
                    throw new Error('Failed to fetch lecture recording');
                }

                const data: LectureRecordingResponse = await response.json();
                console.log('Lecture recording response:', JSON.stringify(data, null, 2));

                if (data.status === 'success') {
                    console.log('Setting lecture data:', data.data);
                    setRecordingFileName(data.data.recordingFileName);
                    setLectureData(data.data);
                    console.log('Setting modal visible to true');
                    setIsLectureModalVisible(true);
                    console.log('Modal visibility state set to true');
                } else {
                    console.error('API returned non-success status:', data.status);
                }
            } catch (error) {
                console.error('Error fetching lecture recording:', error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to load lecture recording',
                    position: 'bottom'
                });
            }
        }

        fetchLectureRecording();
    }, [lectureId]);


    // Add useEffect to initialize RevenueCat offerings
    useEffect(() => {
        const initializeOfferings = async () => {
            try {
                const offerings = await Purchases.getOfferings();
                if (offerings.current) {
                    setOfferings(offerings.current);
                }
            } catch (error) {
                console.error('Error initializing RevenueCat offerings:', error);
            }
        };

        initializeOfferings();
    }, []);

    // Add useEffect to fetch learner info
    useEffect(() => {
        async function fetchLearnerInfo() {
            if (!user?.uid) return;
            try {
                const learner = await getLearner(user.uid);
                setLearnerInfo({
                    subscription: (learner as any).subscription || 'free',
                    terms: learner.terms || ''
                });
            } catch (error) {
                console.error('Error fetching learner info:', error);
            }
        }
        fetchLearnerInfo();
    }, [user?.uid]);




    if (isLoading) {
        return (
            <ImageLoadingPlaceholder />
        );
    }

    if (isQuestionLoading) {
        return (
            <AiLoadingPlaceholder />
        );
    }



    if (!currentQuestion && !parentQuestion && !isRestartModalVisible) {
        return (
            <QuizEmptyState
                onGoToProfile={() => router.push('/profile')}
                onRestart={() => setIsRestartModalVisible(true)}
                onGoBack={() => {
                    console.log('GoBack pressed');
                    router.replace('/');
                    // router.back(); // Uncomment to test popping the stack
                }}
                isQuizLimitReached={quizLimitReached}
                mode={selectedMode}
                offerings={offerings}
            />
        );
    }

    return (
        <>
            {showPaywall && (
                <Paywall
                    offerings={offerings}
                    onSuccess={() => {
                        setShowPaywall(false);
                        // Refresh learner info after successful purchase
                        if (user?.uid) {
                            getLearner(user.uid).then(learner => {
                                setLearnerInfo(prev => {
                                    if (!prev) return null;
                                    return {
                                        ...prev,
                                        subscription: (learner as any).subscription || 'free'
                                    };
                                });
                            });
                        }
                    }}
                    onClose={() => setShowPaywall(false)}
                />
            )}
            <LinearGradient
                colors={isDark ? ['#1E1E1E', '#121212'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9']}
                style={[styles.gradient, { paddingTop: insets.top }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.container}
                    testID="quiz-scroll-view"
                >
                    <SubjectHeader />



                    {isLoading ? (
                        <View style={styles.tabLoadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <ThemedText style={styles.loadingText}>
                                {getRandomLoadingMessage()}
                            </ThemedText>
                        </View>
                    ) : (
                        <>
                            {selectedMode === 'quiz' && (
                                <View>
                                    <PerformanceSummary
                                        stats={stats}
                                        onRestart={() => setIsRestartModalVisible(true)}
                                    />
                                </View>
                            )}
                            <ThemedView style={styles.content}>
                                {selectedMode === 'lessons' ? (
                                    remainingLessons !== 999 &&
                                    remainingLessons !== undefined &&
                                    remainingLessons !== 0 &&
                                    (
                                        <ThemedText style={{
                                            textAlign: 'center',
                                            color: colors.textSecondary,
                                            fontSize: 16,
                                            fontWeight: '600',
                                            marginBottom: 16,
                                        }}>
                                            ⚠️ {remainingLessons} lessons remaining for today
                                        </ThemedText>
                                    )
                                ) : remainingQuizzes !== undefined &&
                                remainingQuizzes !== 999 &&
                                remainingQuizzes !== 0 &&
                                (
                                    <ThemedText style={{
                                        textAlign: 'center',
                                        color: colors.textSecondary,
                                        fontSize: 16,
                                        fontWeight: '600',
                                        marginBottom: 16,
                                    }}>
                                        ⚠️ {remainingQuizzes} questions remaining for today
                                    </ThemedText>
                                )}
                                <QuestionCard
                                    question={currentQuestion}
                                    selectedAnswer={selectedAnswer}
                                    showFeedback={showFeedback}
                                    isAnswerLoading={isAnswerLoading}
                                    selectedMode={selectedMode}
                                    handleAnswer={handleAnswer}
                                    cleanAnswer={cleanAnswer}
                                    feedbackMessage={feedbackMessage}
                                    correctAnswer={correctAnswer}
                                    isDark={isDark}
                                    colors={colors}
                                    fetchAIExplanation={fetchAIExplanation}
                                    isLoadingExplanation={isLoadingExplanation}
                                    learnerRole={learnerRole}
                                    handleApproveQuestion={handleApproveQuestion}
                                    isApproving={isApproving}
                                    setZoomImageUrl={setZoomImageUrl}
                                    setIsZoomModalVisible={setIsZoomModalVisible}
                                    renderMixedContent={renderMixedContent}
                                    reportIssue={reportIssue}
                                    relatedQuestions={relatedQuestions}
                                    currentQuestionIndex={currentQuestionIndex}
                                    handleNextRelatedQuestion={handleNextRelatedQuestion}
                                    handleListenToLecture={handleListenToLecture}
                                    isLoadingLecture={isLoadingLecture}
                                    recordingFileName={recordingFileName}
                                    subjectName={subjectName}
                                    setShowFeedback={setShowFeedback}
                                    isCorrect={isCorrect ?? false}
                                    learnerUid={user?.uid || ''}
                                    grade={grade || ''}
                                />
                            </ThemedView>
                        </>
                    )}
                </ScrollView>
                {selectedTopic && (
                    <TopicProgressBar
                        topicName={selectedTopic}
                        totalQuestions={topicProgress?.total_questions ?? 0}
                        viewedQuestions={topicProgress?.viewed_questions ?? 0}
                        progressPercentage={topicProgress?.progress_percentage ?? 0}
                        lessonsMode={selectedMode === 'lessons'}
                        onReset={() => selectedTopic && resetTopicProgress(selectedTopic, user, subjectName, setStats, fetchTopicProgress)}
                    />
                )}
                <QuizFooter
                    isFromFavorites={isFromFavorites}
                    onNext={handleNext}
                    onGoBack={() => {
                        router.back();
                    }}
                    selectedMode={selectedMode}
                    isDark={isDark}
                    colors={colors}
                />
                <ReportModal
                    isVisible={isReportModalVisible}
                    onClose={() => setIsReportModalVisible(false)}
                    onSubmit={handleSubmitReport}
                    reportComment={reportComment}
                    setReportComment={setReportComment}
                    isSubmitting={isSubmitting}
                    isDark={isDark}
                    insets={insets}
                />

                <ExplanationModal
                    isVisible={isExplanationModalVisible}
                    onClose={() => setIsExplanationModalVisible(false)}
                    aiExplanation={aiExplanation}
                    isDark={isDark}
                    renderMixedContent={renderMixedContent}
                />

                <ZoomModal
                    isVisible={isZoomModalVisible}
                    onClose={() => {
                        setIsZoomModalVisible(false);
                        setImageRotation(0);
                    }}
                    zoomImageUrl={zoomImageUrl}
                    imageRotation={imageRotation}
                    setImageRotation={setImageRotation}
                />

                <RestartModal
                    isVisible={isRestartModalVisible}
                    onClose={() => setIsRestartModalVisible(false)}
                    onRestart={handleRestart}
                    isDark={isDark}
                />

                {/* Add StreakModal */}
                <StreakModal
                    isVisible={showStreakModal}
                    onClose={() => setShowStreakModal(false)}
                    streak={currentStreak}
                />

                {/* Thank You Modal */}
                <ThankYouModal
                    isVisible={isThankYouModalVisible}
                    onClose={() => setIsThankYouModalVisible(false)}
                    isDark={isDark}
                />

                {/* Badge Celebration Modal */}
                {newBadge && (
                    <BadgeCelebrationModal
                        isVisible={showBadgeModal}
                        onClose={() => {
                            setShowBadgeModal(false);
                            // Prompt for rating after badge achievement
                            setTimeout(() => {
                                handleRating();
                            }, 2000);
                        }}
                        badge={newBadge}
                    />
                )}

                <Modal
                    isVisible={isNoteModalVisible}
                    onBackdropPress={() => !isSubmittingNote && setIsNoteModalVisible(false)}
                    onBackButtonPress={() => !isSubmittingNote && setIsNoteModalVisible(false)}
                    backdropOpacity={0.5}
                    style={{ margin: 0, justifyContent: 'flex-end' }}
                    avoidKeyboard
                >
                    <ThemedView style={[{
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        padding: 20,
                        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
                        backgroundColor: isDark ? colors.card : '#FFFFFF',
                    }]}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16,
                        }}>
                            <ThemedText style={{
                                fontSize: 20,
                                fontWeight: '600',
                            }}>Add Note 📝</ThemedText>
                            {!isSubmittingNote && (
                                <TouchableOpacity
                                    onPress={() => setIsNoteModalVisible(false)}
                                    style={{ padding: 4 }}
                                >
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderRadius: 12,
                                padding: 16,
                                minHeight: 120,
                                fontSize: 16,
                                textAlignVertical: 'top',
                                backgroundColor: isDark ? colors.surface : '#F8FAFC',
                                color: colors.text,
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'
                            }}
                            placeholder="Enter your note here..."
                            placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.5)' : '#94A3B8'}
                            multiline
                            value={noteText}
                            onChangeText={setNoteText}
                            editable={!isSubmittingNote}
                        />
                        <TouchableOpacity
                            style={{
                                marginTop: 16,
                                padding: 16,
                                borderRadius: 12,
                                alignItems: 'center',
                                backgroundColor: colors.primary,
                                opacity: isSubmittingNote ? 0.7 : 1
                            }}
                            onPress={handleSubmitNote}
                            disabled={isSubmittingNote}
                        >
                            {isSubmittingNote ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <ThemedText style={{
                                    color: '#FFFFFF',
                                    fontSize: 16,
                                    fontWeight: '600',
                                }}>Save Note</ThemedText>
                            )}
                        </TouchableOpacity>
                    </ThemedView>
                </Modal>



                {/* Add FirstAnswerPointsModal */}
                <FirstAnswerPointsModal
                    isVisible={showFirstAnswerModal}
                    onClose={() => setShowFirstAnswerModal(false)}
                />

            </LinearGradient>

        </>
    );
}


const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    subjectHeader: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    titleContainer: {
        gap: 4,
    },
    subjectTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    badge: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 14,
    },
    content: {
        gap: 20,
        backgroundColor: 'transparent',
        padding: 16,
    },
    sectionCard: {
        borderRadius: 12,
        padding: 8,
        marginBottom: 16,
        borderWidth: 1,
        marginHorizontal: 4,
    },
    questionContainer: {
        borderRadius: 12,
        margin: 8,
        color: '#000000',
    },
    questionText: {
        fontSize: 16,
        color: '#1E293B',
        lineHeight: 24,
        fontWeight: '500',
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    option: {
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#444',
        width: '100%',
    },
    selectedOption: {
        backgroundColor: '#00000020',
        borderColor: '#000000',
    },
    correctOption: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: '#22C55E',
    },
    wrongOption: {
        backgroundColor: 'rgba(255, 59, 48, 0.2)',
        borderColor: '#FF3B30',
    },
    optionText: {
        fontSize: 12,
        lineHeight: 20,
        color: '#1E293B',
    },
    contextText: {
        fontSize: 14,
        marginBottom: 16,
        color: '#000000',
        lineHeight: 20,
    },
    questionImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
    },
    feedbackContainer: {
        borderRadius: 12,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    correctAnswerContainer: {
        backgroundColor: '#FFFFFF',
        borderColor: '#22C55E',
        borderRadius: 8,
        marginTop: 12,
        padding: 12,
    },
    correctAnswerLabel: {
        fontSize: 14,
        color: '#999',
        marginBottom: 4,
        marginLeft: 16,
        marginTop: 16,
    },
    correctAnswerText: {
        color: '#166534',
        marginLeft: 16,
    },
    aiExplanationContainer: {
        backgroundColor: '#FFFFFF',
        borderColor: '#22C55E',
        borderRadius: 8,
        marginTop: 12,
        padding: 16,
        width: '100%',
        maxWidth: 700,
        alignSelf: 'center',
        flexShrink: 1,
    },
    answerImage: {
        width: '100%',
        height: 200,
        marginTop: 8,
        borderRadius: 8,
    },
    imageWrapper: {
        width: '100%',
        height: 200,
        marginVertical: 2,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
        position: 'relative',
        zIndex: 1
    },
    imageCaption: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 2
    },
    touchableImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        zIndex: 2
    },
    imagePlaceholderContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'absolute',
        zIndex: 4,
        justifyContent: 'center',
        alignItems: 'center'
    },
    imagePlaceholderContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '500',
        paddingHorizontal: 16,
    },
    contentText: {
        fontSize: 14,
        lineHeight: 20,
        marginVertical: 4,
        color: '#000000',
    },
    reportButton: {
        backgroundColor: '#FEE2E2',
        padding: 8,
        borderRadius: 8,
        flex: 1,
    },
    reportButtonText: {
        color: '#DC2626',
        fontSize: 14,
        fontWeight: '500',
    },
    paperSelectionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    paperSelectionText: {
        color: '#999',
        fontSize: 16,
        marginTop: 8,
        marginBottom: 32,
    },
    subjectIcon: {
        width: 120,
        height: 120,
        marginBottom: 16,
    },
    subjectheaderIcon: {
        width: 48,
        height: 48,
        marginBottom: 16,
    },
    zoomControls: {
        position: 'absolute',
        bottom: 40,
        right: 20,
        flexDirection: 'row',
        gap: 8,
        zIndex: 1,
    },
    zoomButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
    },
    zoomButtonText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    optionContent: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        color: '#000000',
    },
    latexOptionContainer: {
        width: '100%',
        flexWrap: 'wrap',
        color: '#000000',
    },
    latexContainer: {
        width: '100%',
        marginVertical: 4,
        backgroundColor: '#FFFFFF',
        color: '#000000',
    },
    mixedContentContainer: {
        flex: 1,
        width: '100%',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    reportModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 16,
    },
    reportInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        color: '#1E293B',
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    reportModalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
    },
    reportModalButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        minWidth: 80,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#E2E8F0',
    },
    performanceContainer: {
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    performanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    performanceTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 16,
    },
    statItem: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    statContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statIcon: {
        fontSize: 24,
    },
    statTextContainer: {
        flex: 1,
    },
    statCount: {
        fontSize: 20,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 14,
    },
    masteryText: {
        fontSize: 14,
        textAlign: 'right',
    },
    closeHeaderButton: {
        position: 'absolute',
        right: 16,
        top: 16,
        padding: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 20,
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    aiExplanationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4338CA',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginTop: 16,
        gap: 8,
    },
    aiExplanationButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    aiExplanationBugText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 8,
    },
    explanationModal: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
        width: '100%',
    },
    explanationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        zIndex: 1,
    },
    explanationHeaderButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    explanationTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1E293B',
    },
    explanationContent: {
        maxHeight: '100%',
        paddingHorizontal: 16,
        paddingBottom: 20,
        width: '100%',
        flexGrow: 1,
    },
    explanationLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        paddingRight: 16,
        width: '100%',
        flexWrap: 'wrap',
    },
    explanationTextContainer: {
        flex: 1,
        paddingRight: 16,
        width: '100%',
    },
    explanationText: {
        fontSize: 16,
        lineHeight: 28,
        color: '#1E293B',
        paddingVertical: 20,
        width: '100%',
        flexShrink: 1,
    },
    questionMeta: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
        fontWeight: '500'
    },
    loaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    hintText: {
        fontSize: 14,
        color: '#64748B',
        fontStyle: 'italic',
        marginBottom: 8,
    },
    optionLoadingContainer: {
        minHeight: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    approveButton: {
        backgroundColor: '#4F46E5',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
        alignItems: 'center',
    },
    approveButtonDisabled: {
        opacity: 0.5,
    },
    approveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    zoomModal: {
        margin: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomModalContent: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    zoomCloseButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomRotateButton: {
        position: 'absolute',
        top: 40,
        right: 70,
        zIndex: 10,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    restartModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    restartModalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 12,
    },
    restartModalText: {
        fontSize: 16,
        color: '#64748B',
        marginBottom: 24,
        lineHeight: 24,
    },
    restartModalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    restartModalButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        minWidth: 80,
        alignItems: 'center',
    },
    resetButton: {
        backgroundColor: '#EF4444',
    },
    restartIconButton: {
        padding: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    ratingTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 16,
    },
    ratingText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    ratingButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    ratingButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    ratingPrimaryButton: {
        backgroundColor: '#8B5CF6',
    },
    ratingSecondaryButton: {
        backgroundColor: '#E2E8F0',
    },
    ratingPrimaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    ratingSecondaryButtonText: {
        color: '#1E293B',
        fontSize: 16,
        fontWeight: '600',
    },
    h1Text: {
        fontSize: 24,
        fontWeight: '700',
        marginVertical: 12,
        lineHeight: 32,
    },
    h2Text: {
        fontSize: 20,
        fontWeight: '600',
        marginVertical: 10,
        lineHeight: 28,
    },
    h3Text: {
        fontSize: 18,
        fontWeight: '600',
        marginVertical: 8,
        lineHeight: 26,
    },
    h4Text: {
        fontSize: 16,
        fontWeight: '600',
        marginVertical: 6,
        lineHeight: 24,
    },
    boldText: {
        fontWeight: '700',
    },
    textContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    loadingGif: {
        width: 80,
        height: 80,
        marginBottom: 8
    },
    favoritesSection: {
        width: '100%',
        paddingHorizontal: 0,
        position: 'relative',
        paddingTop: 16,
    },
    favoritesTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    favoritesTitle: {
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 34,
    },
    favoritesGrid: {
        flexDirection: 'column',
        marginTop: 4,
    },
    favoriteCard: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    favoriteCardText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#000000',
        lineHeight: 20,
    },
    emptyFavorites: {
        padding: 24,
        borderWidth: 2,
        borderRadius: 16,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    emptyFavoritesText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    addButtonContainer: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 1,
    },
    addButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    favoriteButton: {
        padding: 5,
        borderRadius: 20,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 4,
        borderWidth: 1,
    },
    shareButtonText: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    fireIconContainer: {
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pointsContainer: {
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignSelf: 'center',
        width: 'auto',
        minWidth: 120,
    },
    pointsText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFD700',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    pointsLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
        marginTop: 4,
    },
    streakModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        alignSelf: 'center',
        alignItems: 'center',
    },
    streakIconContainer: {
        marginBottom: 24,
        alignItems: 'center',
    },
    streakDaysRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    streakDay: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF9500',
        justifyContent: 'center',
        alignItems: 'center',
    },
    streakDayText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    streakNumberContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FF9500',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -12,
    },
    streakNumber: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: 'bold',
    },
    streakTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    streakSubtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    continueButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        width: '100%',
        backgroundColor: '#E2E8F0',
        marginHorizontal: 16,
    },
    thankYouModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        maxWidth: 400,
        width: '90%',
        alignSelf: 'center',
    },
    thankYouIconContainer: {
        marginBottom: 16,
    },
    thankYouTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    thankYouMessage: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    thankYouButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    thankYouButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    bulletListContainer: {
        flexDirection: 'column',
        width: '100%',
        paddingLeft: 4,
        paddingRight: 4,
        marginVertical: 8,
    },
    bulletPointContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        width: '100%',
    },
    bulletPoint: {
        fontSize: 24,
        lineHeight: 24,
        marginRight: 4,
        marginTop: 0,
    },
    bulletTextWrapper: {
        flex: 1,
        flexDirection: 'row',
    },
    bulletTextContent: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    bulletPointText: {
        fontSize: 16,
        lineHeight: 24,
    },
    modeSelectionContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    modeSelectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
    },
    modeButtons: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        maxWidth: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    modeButtonSelected: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },
    modeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    modeButtonTextSelected: {
        color: '#FFFFFF',
    },
    bulletPointRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 8,
        width: '100%',
    },
    headerButtons: {
        position: 'absolute',
        top: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    tabView: {
        flex: 1,
    },
    tabContent: {
        flex: 1,
        padding: 16,
    },
    reviewButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 4,
        marginTop: 8,
        elevation: 2,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tabContainer: {
        flex: 1,
        marginTop: 16,
        marginHorizontal: -16,
    },
    tabHeaderContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabButton: {
        borderBottomWidth: 2,
    },
    tabButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabButtonText: {
        fontWeight: '600',
    },
    tabText: {
        fontSize: 16,
        lineHeight: 24,
    },
    statsToggleButton: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statsToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    statsToggleText: {
        fontSize: 15,
        letterSpacing: 0.2,
    },
    statsToggleIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    nextQuestionButton: {
        marginTop: 16,
        marginHorizontal: 16,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    nextQuestionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    nextQuestionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    tabLoadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    tabLoadingText: {
        fontSize: 16,
        fontWeight: '500',
    },
    questionCounterContainer: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    questionCounterText: {
        fontSize: 14,
        fontWeight: '500',
    },
    startQuestionsButton: {
        marginTop: 24,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    startQuestionsContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    startQuestionsText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    closeButton: {
        padding: 8,
        borderRadius: 25,
        position: 'absolute',
        top: 10,
        right: 30,
        zIndex: 10,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 231, 235, 0.9)',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.15,
        shadowRadius: 2.5,
        elevation: 3,
    },
    modal: {
        margin: 0,
        justifyContent: 'flex-end',
    },
    noteModalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    noteModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    noteModalTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    noteModalCloseButton: {
        padding: 4,
    },
    noteInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        minHeight: 120,
        fontSize: 16,
        textAlignVertical: 'top',
    },
    noteSubmitButton: {
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    noteSubmitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonLabel: {
        position: 'absolute',
        bottom: -20,
        left: -8,
        right: -8,
        textAlign: 'center',
        fontSize: 10,
        color: '#6B7280',
        backgroundColor: 'transparent'
    },
    relatedNavButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    relatedNavContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
    },
    relatedNavText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    footerButtonText: {
        color: '#fff',
        fontSize: 16,
        marginHorizontal: 8,
    },
    examDateContainer: {
        width: '100%',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    examDateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    examDateTitle: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'left',
    },
    examDateGrid: {
        width: '100%',
        flexDirection: 'row',
        gap: 8,
    },
    examDateItem: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    examDateLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    examDateLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    examDateValue: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    quickBiteContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    quickBiteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickBiteTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    quickBiteContent: {
        marginTop: 8,
    },
    quickBiteQuestion: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    quickBiteExplanation: {
        fontSize: 14,
        lineHeight: 20,
    },
    examDateSubtext: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'left',
        marginBottom: 8,

    },
    topicLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    topicContainer: {
        marginBottom: 16,
        marginHorizontal: 16,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    lectureButton: {
        marginTop: 10,
        padding: 12,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    lectureButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    loadingDots: {
        color: '#FFFFFF',
    },
    topicProgressContainer: {
        width: '100%',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    topicProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    topicProgressTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    topicProgressContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    topicProgressStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    topicProgressText: {
        fontSize: 14,
        color: '#64748B',
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E2E8F0',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    remainingText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        marginBottom: 16,
    },
    optionButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    optionButtonSelected: {
        borderColor: 'transparent',
    },
    optionButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    optionButtonTextSelected: {
        color: '#FFFFFF',
    },
    tableContainer: {
        marginVertical: 16,
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tableCell: {
        flex: 1,
        padding: 12,
        borderRightWidth: 1,
    },
    tableCellText: {
        fontSize: 14,
        lineHeight: 20,
    },
    tableHeaderText: {
        fontWeight: 'bold',
    },
});






