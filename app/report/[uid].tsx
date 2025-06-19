import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, Modal, Image, ImageSourcePropType } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { HOST_URL } from '@/config/api';
import { Header } from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getLearnerBadges, LearnerBadge } from '@/services/api';
import subjectEmojisJson from '@/assets/subject-emojis.json';
import { Share } from 'react-native';
import { Paywall } from '../components/Paywall';
import Purchases from 'react-native-purchases';
import { ProPromoCard } from '@/components/ProPromoCard';
const subjectEmojis = subjectEmojisJson as Record<string, string>;

function getGradeColor(grade: number): string {
    switch (grade) {
        case 7: return '#10B981'; // Outstanding - Green
        case 6: return '#3B82F6'; // Meritorious - Blue
        case 5: return '#6366F1'; // Substantial - Indigo
        case 4: return '#F59E0B'; // Adequate - Amber
        case 3: return '#F97316'; // Moderate - Orange
        case 2: return '#EF4444'; // Elementary - Red
        default: return '#DC2626'; // Not achieved - Dark Red
    }
}

interface SubjectPerformance {
    subject: string;
    subjectId: number;
    totalAnswers: number;
    correctAnswers: string;
    incorrectAnswers: string;
    percentage: number;
    grade: number;
    gradeDescription: string;
}

interface DailyActivity {
    date: string;
    count: number;
    correct: number;
    incorrect: number;
}

interface SubTopic {
    name: string;
    totalAttempts: number;
    correctAnswers: number;
    incorrectAnswers: number;
    successRate: number;
    grade: number;
    gradeDescription: string;
}

interface MainTopic {
    mainTopic: string;
    subTopics: SubTopic[];
    totalAttempts: number;
    correctAnswers: number;
    incorrectAnswers: number;
    successRate: number;
    grade: number;
    gradeDescription: string;
    isLocked?: boolean;
}

interface SubjectTopicReport {
    uid: string;
    subject: string;
    report: MainTopic[];
}

interface TodayEvent {
    title: string;
    startTime: string;
    endTime: string;
    subject: string;
    reminder: boolean;
}

interface FollowingLearner {
    learner_uid: string;
    learner_name: string;
    points: number;
    streak: number;
    lastResult: {
        id: number;
        outcome: string;
        created: string;
        duration: number;
    };
    firstResult: {
        id: number;
        outcome: string;
        created: string;
        duration: number;
    };
    questionsAnsweredToday: number;
    questionsAnsweredThisWeek: number;
}

const badgeImages: Record<string, ImageSourcePropType> = {
    '3-day-streak.png': require('@/assets/images/badges/3-day-streak.png'),
    '7-day-streak.png': require('@/assets/images/badges/7-day-streak.png'),
    '30-day-streak.png': require('@/assets/images/badges/30-day-streak.png'),
    '5-in-a-row.png': require('@/assets/images/badges/5-in-a-row.png'),
    '3-in-a-row.png': require('@/assets/images/badges/3-in-a-row.png'),
    '10-in-a-row.png': require('@/assets/images/badges/10-in-a-row.png'),
    'mathematics.png': require('@/assets/images/badges/mathematics.png'),
    'daily-goat.png': require('@/assets/images/badges/daily-goat.png'),
    'weekly-goat.png': require('@/assets/images/badges/weekly-goat.png'),
    'all-time-goat.png': require('@/assets/images/badges/all-time-goat.png')
};

// Helper to clean subject name for display and emoji lookup
function getCleanSubjectName(subject: string): string {
    return subject.replace(/\bP[12]\b/gi, '').trim();
}

async function getLearnerPerformance(uid: string): Promise<{ data: SubjectPerformance[] }> {
    try {
        const response = await fetch(`${HOST_URL}/api/learner/${uid}/subject-performance`);
        if (!response.ok) {
            throw new Error('Failed to fetch learner performance');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching learner performance:', error);
        throw error;
    }
}

async function getLearnerDailyActivity(uid: string, subjectId?: number): Promise<{ data: DailyActivity[] }> {
    try {
        const url = subjectId
            ? `${HOST_URL}/api/learner/${uid}/daily-activity?subject_id=${subjectId}`
            : `${HOST_URL}/api/learner/${uid}/daily-activity`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch daily activity');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching daily activity:', error);
        throw error;
    }
}

async function getLearnerTopicReport(uid: string, subject: string): Promise<SubjectTopicReport> {
    try {
        console.log('getLearnerTopicReport uid', uid);
        const response = await fetch(`${HOST_URL}/api/learner/${uid}/report?subject=${encodeURIComponent(subject)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch topic report');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching topic report:', error);
        throw error;
    }
}

const SubjectReportModal = ({
    isVisible,
    onClose,
    subject,
    isDark,
    dailyActivity,
    isLoading,
    uid,
    name,
    user,
    learnerInfo
}: {
    isVisible: boolean;
    onClose: () => void;
    subject: SubjectPerformance;
    isDark: boolean;
    dailyActivity: DailyActivity[];
    isLoading: boolean;
    uid: string;
    name: string;
    user: any;
    learnerInfo?: any;
}) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = Dimensions.get('window');
    const [topicReport, setTopicReport] = useState<MainTopic[]>([]);
    const [isTopicLoading, setIsTopicLoading] = useState(false);
    const [expandedTopics, setExpandedTopics] = useState<{ [key: string]: boolean }>({});
    const [showPaywall, setShowPaywall] = useState(false);
    const [offerings, setOfferings] = useState<any>(null);
    const isFreeUser = learnerInfo?.subscription === 'free';

    useEffect(() => {
        async function fetchOfferings() {
            try {
                const offerings = await Purchases.getOfferings();
                setOfferings(offerings.current);
            } catch (error) {
                console.error('Error fetching offerings:', error);
            }
        }
        fetchOfferings();
    }, []);

    const toggleTopic = (topicName: string) => {
        if (isFreeUser && topicReport.find(t => t.mainTopic === topicName)?.isLocked) {
            return;
        }
        setExpandedTopics(prev => ({
            ...prev,
            [topicName]: !prev[topicName]
        }));
    };

    const fetchTopicReport = async () => {
        if (isVisible && subject) {
            setIsTopicLoading(true);
            try {
                const report = await getLearnerTopicReport(uid, subject.subject);
                // Add isLocked property to topics for free users only
                const processedReport = report.report.map((topic, index) => ({
                    ...topic,
                    isLocked: isFreeUser && index > 0
                }));
                setTopicReport(processedReport);
            } catch (error) {
                console.error('Error fetching topic report:', error);
            } finally {
                setIsTopicLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchTopicReport();
    }, [isVisible, subject, uid, isFreeUser]);

    return (
        <Modal
            visible={isVisible}
            transparent={false}
            animationType="slide"
            onRequestClose={onClose}
            testID='subject-report-modal'
            presentationStyle="fullScreen"
        >
            <View style={[styles.modalOverlay, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', flex: 1 }]}>
                <View style={[
                    styles.modalContent,
                    {
                        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        width: '100%',
                        height: '100%',
                        flex: 1,
                    }
                ]}>
                    <View style={styles.modalHeader}>
                        <ThemedText style={styles.modalTitle}>
                            {(subjectEmojis as Record<string, string>)[getCleanSubjectName(subject.subject)] || '📚'} {subject.subject}
                        </ThemedText>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeModalButton}
                        >
                            <Ionicons
                                name="close"
                                size={24}
                                color={isDark ? '#FFFFFF' : '#000000'}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.modalScrollView}
                        contentContainerStyle={styles.modalScrollViewContent}
                    >
                        {isLoading ? (
                            <View style={styles.modalLoadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <ThemedText style={styles.modalLoadingText}>Loading data...</ThemedText>
                            </View>
                        ) : (
                            <>
                                {dailyActivity.length > 1 ? (
                                    <ThemedView style={[styles.chartContainer, {
                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                                    }]}>
                                        <ThemedText style={styles.modalTitle}>📊 Daily Activity</ThemedText>
                                    </ThemedView>
                                ) : null}

                                <View style={styles.modalStatsContainer}>
                                    <View style={styles.modalStatItem}>
                                        <ThemedText style={styles.modalStatLabel}>Total Answers</ThemedText>
                                        <ThemedText style={styles.modalStatValue}>{subject.totalAnswers}</ThemedText>
                                    </View>
                                    <View style={styles.modalStatItem}>
                                        <ThemedText style={styles.modalStatLabel}>Correct Answers</ThemedText>
                                        <ThemedText style={[styles.modalStatValue, { color: '#10B981' }]}>
                                            {subject.correctAnswers}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.modalStatItem}>
                                        <ThemedText style={styles.modalStatLabel}>Incorrect Answers</ThemedText>
                                        <ThemedText style={[styles.modalStatValue, { color: '#EF4444' }]}>
                                            {subject.incorrectAnswers}
                                        </ThemedText>
                                    </View>
                                </View>

                                <View style={styles.modalGradeContainer}>
                                    <View style={styles.modalGradeInfo}>
                                        <ThemedText style={styles.modalGradeLabel}>Success Rate</ThemedText>
                                        <ThemedText style={[styles.modalGradeValue, { color: getGradeColor(subject.grade) }]}>
                                            {subject.percentage}%
                                        </ThemedText>
                                    </View>
                                    <View style={[styles.modalGradeBadge, { backgroundColor: getGradeColor(subject.grade) }]}>
                                        <ThemedText style={styles.modalGradeText}>Level {subject.grade}</ThemedText>
                                        <ThemedText style={styles.modalGradeDescription}>
                                            {subject.grade === 1 ? 'Not achieved' :
                                                subject.grade === 7 ? 'Outstanding achievement' :
                                                    subject.grade === 6 ? 'Meritorious achievement' :
                                                        subject.grade === 5 ? 'Substantial achievement' :
                                                            subject.grade === 4 ? 'Adequate achievement' :
                                                                subject.grade === 3 ? 'Moderate achievement' :
                                                                    'Elementary achievement'}
                                        </ThemedText>
                                    </View>
                                </View>

                                <ThemedView style={[styles.chartContainer, {
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                                }]}>
                                    <ThemedText style={styles.modalTitle}>📚 Topic Performance</ThemedText>
                                    {isTopicLoading ? (
                                        <View style={styles.modalLoadingContainer}>
                                            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 16 }} />
                                            <ThemedText style={{ fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
                                                Analyzing your performance...
                                            </ThemedText>
                                            <ThemedText style={{ fontSize: 16, opacity: 0.7, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 }}>
                                                Our AI is carefully reviewing your strengths and interests to provide personalized career guidance
                                            </ThemedText>
                                        </View>
                                    ) : topicReport.length > 0 ? (
                                        topicReport
                                            .filter(topic => topic.mainTopic !== "Uncategorized")
                                            .map((mainTopic: MainTopic, index: number) => (
                                                <View key={index} style={[
                                                    styles.topicItem,
                                                    {
                                                        backgroundColor: isDark
                                                            ? 'rgba(255, 255, 255, 0.03)'
                                                            : '#FFFFFF',
                                                        borderColor: isDark
                                                            ? 'rgba(255, 255, 255, 0.1)'
                                                            : 'rgba(0, 0, 0, 0.04)',
                                                        opacity: mainTopic.isLocked ? 0.7 : 1
                                                    }
                                                ]}>
                                                    <TouchableOpacity
                                                        style={styles.topicHeader}
                                                        onPress={() => toggleTopic(mainTopic.mainTopic)}
                                                        activeOpacity={mainTopic.isLocked ? 1 : 0.7}
                                                    >
                                                        <View style={styles.topicHeaderContent}>
                                                            <ThemedText style={styles.mainTopicName}>
                                                                {mainTopic.mainTopic}

                                                            </ThemedText>
                                                            <View style={styles.topicActions}>
                                                                {!mainTopic.isLocked && (
                                                                    <Ionicons
                                                                        name={expandedTopics[mainTopic.mainTopic] ? "chevron-up" : "chevron-down"}
                                                                        size={24}
                                                                        color={isDark ? '#FFFFFF' : '#000000'}
                                                                    />
                                                                )}
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>

                                                    {!mainTopic.isLocked && (
                                                        <>
                                                            <View style={styles.topicStats}>
                                                                <View style={styles.statGroup}>
                                                                    <ThemedText style={styles.topicStatLabel}>Total Answers</ThemedText>
                                                                    <ThemedText style={styles.topicStatValue}>{mainTopic.totalAttempts}</ThemedText>
                                                                </View>
                                                                <View style={styles.statGroup}>
                                                                    <ThemedText style={styles.topicStatLabel}>Correct</ThemedText>
                                                                    <ThemedText style={[
                                                                        styles.topicStatValue,
                                                                        { color: '#10B981' }
                                                                    ]}>
                                                                        {mainTopic.correctAnswers}
                                                                    </ThemedText>
                                                                </View>
                                                                <View style={styles.statGroup}>
                                                                    <ThemedText style={styles.topicStatLabel}>Incorrect</ThemedText>
                                                                    <ThemedText style={[
                                                                        styles.topicStatValue,
                                                                        { color: '#EF4444' }
                                                                    ]}>
                                                                        {mainTopic.incorrectAnswers}
                                                                    </ThemedText>
                                                                </View>
                                                            </View>

                                                            <View style={styles.gradeContainer}>
                                                                <View style={styles.successRate}>
                                                                    <ThemedText style={styles.successRateLabel}>Success Rate</ThemedText>
                                                                    <ThemedText style={[
                                                                        styles.successRateValue,
                                                                        { color: mainTopic.successRate === 0 ? '#EF4444' : '#3B82F6' }
                                                                    ]}>
                                                                        {mainTopic.successRate.toFixed(2)}%
                                                                    </ThemedText>
                                                                </View>
                                                                <View style={[
                                                                    styles.levelBadge,
                                                                    { backgroundColor: getGradeColor(mainTopic.grade) }
                                                                ]}>
                                                                    <ThemedText style={styles.levelText}>Level {mainTopic.grade}</ThemedText>
                                                                    <ThemedText style={styles.levelDescription}>
                                                                        {mainTopic.gradeDescription}
                                                                    </ThemedText>
                                                                </View>
                                                            </View>

                                                            {user?.uid === uid && (
                                                                <TouchableOpacity
                                                                    style={[
                                                                        styles.quizButton,
                                                                        {
                                                                            backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#6366F1',
                                                                            borderColor: isDark ? 'rgba(99,102,241,0.4)' : '#6366F1',
                                                                        }
                                                                    ]}
                                                                    onPress={() => {
                                                                        const grade = (user?.grade?.number || learnerInfo?.grade || '').toString();
                                                                        router.push({
                                                                            pathname: '/quiz',
                                                                            params: {
                                                                                subjectName: getCleanSubjectName(subject.subject),
                                                                                topic: mainTopic.mainTopic,
                                                                                learnerUid: user?.uid || uid,
                                                                                grade,
                                                                                learningMode: 'quiz',
                                                                            },
                                                                        });
                                                                    }}
                                                                >
                                                                    <Ionicons
                                                                        name="play-circle"
                                                                        size={20}
                                                                        color={isDark ? '#FFFFFF' : '#FFFFFF'}
                                                                    />
                                                                    <ThemedText style={[styles.quizButtonText, { color: '#FFFFFF' }]}>
                                                                        Start Quiz for this topic
                                                                    </ThemedText>
                                                                </TouchableOpacity>
                                                            )}

                                                            {expandedTopics[mainTopic.mainTopic] && (
                                                                <View style={styles.subTopicsContainer}>
                                                                    {mainTopic.subTopics.map((subTopic, subIndex) => (
                                                                        <View key={subIndex} style={[
                                                                            styles.subTopicItem,
                                                                            {
                                                                                backgroundColor: isDark
                                                                                    ? 'rgba(255, 255, 255, 0.02)'
                                                                                    : 'rgba(0, 0, 0, 0.02)',
                                                                                borderColor: isDark
                                                                                    ? 'rgba(255, 255, 255, 0.05)'
                                                                                    : 'rgba(0, 0, 0, 0.05)'
                                                                            }
                                                                        ]}>
                                                                            <ThemedText style={styles.subTopicName}>
                                                                                {subTopic.name}
                                                                            </ThemedText>
                                                                            <View style={styles.subTopicStats}>
                                                                                <View style={styles.subTopicStat}>
                                                                                    <ThemedText style={styles.subTopicStatLabel}>Total</ThemedText>
                                                                                    <ThemedText style={styles.subTopicStatValue}>{subTopic.totalAttempts}</ThemedText>
                                                                                </View>
                                                                                <View style={styles.subTopicStat}>
                                                                                    <ThemedText style={styles.subTopicStatLabel}>Correct</ThemedText>
                                                                                    <ThemedText style={[styles.subTopicStatValue, { color: '#10B981' }]}>
                                                                                        {subTopic.correctAnswers}
                                                                                    </ThemedText>
                                                                                </View>
                                                                                <View style={styles.subTopicStat}>
                                                                                    <ThemedText style={styles.subTopicStatLabel}>Incorrect</ThemedText>
                                                                                    <ThemedText style={[styles.subTopicStatValue, { color: '#EF4444' }]}>
                                                                                        {subTopic.incorrectAnswers}
                                                                                    </ThemedText>
                                                                                </View>
                                                                            </View>
                                                                            <View style={styles.subTopicGradeContainer}>
                                                                                <View style={styles.subTopicSuccessRate}>
                                                                                    <ThemedText style={styles.subTopicStatLabel}>Success Rate</ThemedText>
                                                                                    <ThemedText style={[
                                                                                        styles.subTopicGradeValue,
                                                                                        { color: subTopic.successRate === 0 ? '#EF4444' : '#3B82F6' }
                                                                                    ]}>
                                                                                        {subTopic.successRate.toFixed(2)}%
                                                                                    </ThemedText>
                                                                                </View>
                                                                                <View style={[
                                                                                    styles.subTopicLevelBadge,
                                                                                    { backgroundColor: getGradeColor(subTopic.grade) }
                                                                                ]}>
                                                                                    <ThemedText style={styles.subTopicLevelText}>Level {subTopic.grade}</ThemedText>
                                                                                    <ThemedText style={styles.subTopicLevelDescription}>
                                                                                        {subTopic.gradeDescription}
                                                                                    </ThemedText>
                                                                                </View>
                                                                            </View>
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </>
                                                    )}

                                                    {mainTopic.isLocked && (
                                                        <View style={styles.lockedTopicContainer}>
                                                            <Ionicons
                                                                name="lock-closed"
                                                                size={32}
                                                                color={isDark ? '#FFFFFF' : '#000000'}
                                                                style={{ marginBottom: 8 }}
                                                            />
                                                            <ThemedText style={styles.lockedTopicText}>
                                                                Upgrade to Pro to unlock detailed topic analysis
                                                            </ThemedText>
                                                            <TouchableOpacity
                                                                style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
                                                                onPress={() => setShowPaywall(true)}
                                                            >
                                                                <LinearGradient
                                                                    colors={isDark ? ['#7C3AED', '#4F46E5'] : ['#9333EA', '#4F46E5']}
                                                                    style={styles.upgradeButtonGradient}
                                                                >
                                                                    <ThemedText style={styles.upgradeButtonText}>✨ Upgrade to Pro</ThemedText>
                                                                </LinearGradient>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            ))
                                    ) : (
                                        <View style={styles.modalEmptyDataContainer}>
                                            <ThemedText style={styles.modalEmptyDataText}>
                                                No topic data available
                                            </ThemedText>
                                        </View>
                                    )}
                                </ThemedView>
                            </>
                        )}
                    </ScrollView>
                </View>
            </View>
            {showPaywall && (
                <Paywall
                    offerings={offerings}
                    onSuccess={() => {
                        setShowPaywall(false);
                        // Refresh topic report after successful purchase
                        if (user?.uid) {
                            fetchTopicReport();
                        }
                    }}
                    onClose={() => setShowPaywall(false)}
                />
            )}
        </Modal>
    );
};

export default function LearnerPerformanceScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { uid, name } = useLocalSearchParams();
    const { user } = useAuth();
    const [performance, setPerformance] = useState<SubjectPerformance[]>([]);
    const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
    const [subjectDailyActivity, setSubjectDailyActivity] = useState<DailyActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubjectLoading, setIsSubjectLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<SubjectPerformance | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [badges, setBadges] = useState<LearnerBadge[]>([]);
    const [isBadgesLoading, setIsBadgesLoading] = useState(true);
    const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
    const [isTodayEventsLoading, setIsTodayEventsLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFollowingLoading, setIsFollowingLoading] = useState(true);
    const [showPaywall, setShowPaywall] = useState(false);
    const [offerings, setOfferings] = useState<any>(null);
    const [learnerInfo, setLearnerInfo] = useState<any>(null);

    // Add useEffect to fetch learner info
    useEffect(() => {
        async function fetchLearnerInfo() {
            if (!uid) return;
            try {
                const response = await fetch(`${HOST_URL}/public/learn/learner?uid=${uid}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch learner info');
                }

                const data = await response.json();
                console.log('uid', uid);
                console.log('data', data);
                console.log('subscription', data.subscription);
                setLearnerInfo(data); // Set the entire data object, not data.data
            } catch (error) {
                console.error('Error fetching learner info:', error);
            }
        }
        fetchLearnerInfo();
    }, [uid]);

    // Reset modal state when component mounts or uid changes
    useEffect(() => {
        setIsModalVisible(false);
        setSelectedSubject(null);
    }, [uid]);

    const handleClose = () => {
        router.back();
    };

    const openSubjectReport = async (subject: SubjectPerformance) => {
        setSelectedSubject(subject);
        setIsSubjectLoading(true);
        try {
            const dailyResponse = await getLearnerDailyActivity(uid as string, subject.subjectId);
            setSubjectDailyActivity(dailyResponse.data);
            setIsModalVisible(true);
        } catch (err) {
            console.error('Error fetching subject data:', err);
            setError('Failed to load subject data');
        } finally {
            setIsSubjectLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalVisible(false);
        setSelectedSubject(null);
        setSubjectDailyActivity([]);
    };

    // Handle navigation focus
    useFocusEffect(
        React.useCallback(() => {
            closeModal();
        }, [])
    );

    const checkFollowingStatus = async () => {
        if (!user?.uid) return;

        try {
            const response = await fetch(`${HOST_URL}/api/learner-following/following/${user.uid}`);
            if (!response.ok) throw new Error('Failed to fetch following status');

            const data = await response.json();
            const isFollowingLearner = data.data.some((learner: FollowingLearner) => learner.learner_uid === uid);
            setIsFollowing(isFollowingLearner);
        } catch (error) {
            console.error('Error checking following status:', error);
        } finally {
            setIsFollowingLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!user?.uid) return;

        try {
            const response = await fetch(`${HOST_URL}/api/learner-following/follow/${user.uid}/${uid}`, {
                method: 'POST',
            });

            if (!response.ok) throw new Error('Failed to follow learner');

            setIsFollowing(true);
        } catch (error) {
            console.error('Error following learner:', error);
        }
    };

    const handleShare = async () => {
        try {
            const shareUrl = `https://examquiz.co.za/report/${uid}?name=${encodeURIComponent(name as string)}`;
            await Share.share({
                message: `📊 Check out ${name}'s performance report on ExamQuiz! See their progress and achievements in various subjects. Download ExamQuiz to track your own progress!\n\nView the report: ${shareUrl}`,
                title: `${name}'s Performance Report`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    useEffect(() => {
        async function fetchData() {
            try {
                const [performanceResponse, activityResponse, badgesResponse, todayEventsResponse] = await Promise.all([
                    getLearnerPerformance(uid as string),
                    getLearnerDailyActivity(uid as string),
                    getLearnerBadges(uid as string),
                    fetch(`${HOST_URL}/api/learner/${uid}/today-events`).then(res => res.json())
                ]);
                setPerformance(performanceResponse.data);
                setDailyActivity(activityResponse.data);
                setBadges(badgesResponse);
                setTodayEvents(todayEventsResponse.events || []);
            } catch (err) {
                setError('Failed to load learner data');
                console.error(err);
            } finally {
                setIsLoading(false);
                setIsBadgesLoading(false);
                setIsTodayEventsLoading(false);
            }
        }

        fetchData();
    }, [uid]);

    useEffect(() => {
        checkFollowingStatus();
    }, [user?.uid, uid]);

    return (
        <LinearGradient
            colors={isDark ? ['#1E1E1E', '#121212'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9']}
            style={[styles.gradient, { paddingTop: insets.top }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
        >
            <View style={styles.headerContainer}>
                <View style={styles.headerTopRow}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleClose}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="close"
                            size={24}
                            color={isDark ? '#FFFFFF' : '#000000'}
                        />
                    </TouchableOpacity>
                    <ThemedText style={styles.headerTitle}>🏆 {name}'s Performance</ThemedText>
                    <View style={styles.closeButton} />
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[
                            styles.shareButton,
                            {
                                backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#6366F1',
                                borderColor: isDark ? 'rgba(99,102,241,0.4)' : '#6366F1',
                            }
                        ]}
                        onPress={handleShare}
                    >
                        <Ionicons
                            name="share-outline"
                            size={20}
                            color={isDark ? '#FFFFFF' : '#FFFFFF'}
                        />
                        <ThemedText style={[styles.shareButtonText, { color: '#FFFFFF' }]}>
                            Share Report
                        </ThemedText>
                    </TouchableOpacity>
                    {user?.uid !== uid && !isFollowingLoading && (
                        <TouchableOpacity
                            style={[
                                styles.followButton,
                                {
                                    backgroundColor: isFollowing
                                        ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#10B981')
                                        : (isDark ? 'rgba(59, 130, 246, 0.2)' : '#3B82F6'),
                                    borderColor: isFollowing
                                        ? (isDark ? 'rgba(16, 185, 129, 0.4)' : '#10B981')
                                        : (isDark ? 'rgba(59, 130, 246, 0.4)' : '#3B82F6'),
                                }
                            ]}
                            onPress={handleFollow}
                            disabled={isFollowing}
                        >
                            <Ionicons
                                name={isFollowing ? "checkmark" : "person-add"}
                                size={20}
                                color={isDark ? '#FFFFFF' : '#FFFFFF'}
                            />
                            <ThemedText style={styles.followButtonText}>
                                {isFollowing ? 'Following' : 'Follow Learner'}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
            >
                {/* Update ProPromoCard condition */}
                {learnerInfo?.subscription === 'free' && (
                    <ProPromoCard
                        testID="performance-pro-promo"
                        onPress={() => setShowPaywall(true)}
                        showCrown={false}
                    />
                )}

                {/* Study Plan for Today */}
                {todayEvents.length > 0 && (
                    <ThemedView style={[
                        styles.todayEventsContainer,
                        {
                            backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : '#E0E7FF',
                            borderColor: isDark ? 'rgba(99,102,241,0.2)' : '#6366F1',
                        }
                    ]} accessibilityRole="summary" accessibilityLabel="Today's Study Plan">
                        <ThemedText style={styles.todayEventsTitle}>Study Plan! ⏰</ThemedText>
                        {isTodayEventsLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            todayEvents.map((event, idx) => {
                                const emoji = (subjectEmojis as Record<string, string>)[event.subject] || '📖';
                                return (
                                    <View key={idx} style={styles.todayEventCard}>
                                        <ThemedText style={styles.todayEventTitle}>{emoji} {event.title}</ThemedText>
                                        <ThemedText style={styles.todayEventTime}>{event.startTime} - {event.endTime}</ThemedText>
                                        <ThemedText style={styles.todayEventSubject}>{event.subject}</ThemedText>
                                    </View>
                                );
                            })
                        )}
                    </ThemedView>
                )}

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <ThemedText style={styles.loadingText}>Loading performance data...</ThemedText>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <ThemedText style={styles.errorText}>{error}</ThemedText>
                    </View>
                ) : (
                    <>
                        {!isBadgesLoading && badges.length > 0 && (
                            <ThemedView style={[styles.badgesContainer, {
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                            }]}>
                                <ThemedText style={styles.badgesTitle}>🏆 Achievements</ThemedText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.badgesScrollContent}
                                >
                                    {badges.map((badge, index) => (
                                        <View key={index} style={styles.badgeItem}>
                                            <Image
                                                source={badgeImages[badge.image] || require('@/assets/images/badges/3-day-streak.png')}
                                                style={[
                                                    styles.badgeImage
                                                ]}
                                                resizeMode="contain"
                                            />
                                            <ThemedText style={styles.badgeName}>{badge.name}</ThemedText>
                                        </View>
                                    ))}
                                </ScrollView>
                            </ThemedView>
                        )}

                        <ThemedText style={styles.hintText}>
                            💡 Tap on any subject card below to view detailed performance report
                        </ThemedText>

                        <View style={styles.performanceContainer}>
                            {(() => {
                                // Merge P1 and P2 results for the same subject
                                const merged: Record<string, SubjectPerformance> = {};
                                performance
                                    .filter(subject => subject.subject.toLowerCase().includes('mathematics'))
                                    .forEach(subject => {
                                        const cleanName = getCleanSubjectName(subject.subject);
                                        if (!merged[cleanName]) {
                                            merged[cleanName] = {
                                                ...subject,
                                                subject: cleanName,
                                                totalAnswers: 0,
                                                correctAnswers: '0',
                                                incorrectAnswers: '0',
                                            };
                                        }
                                        merged[cleanName].totalAnswers += subject.totalAnswers;
                                        merged[cleanName].correctAnswers = (parseInt(merged[cleanName].correctAnswers) + parseInt(subject.correctAnswers)).toString();
                                        merged[cleanName].incorrectAnswers = (parseInt(merged[cleanName].incorrectAnswers) + parseInt(subject.incorrectAnswers)).toString();
                                    });
                                // Calculate percentage and grade for merged subjects
                                const mergedSubjects = Object.values(merged).map(subj => {
                                    const total = subj.totalAnswers;
                                    const correct = parseInt(subj.correctAnswers);
                                    const incorrect = parseInt(subj.incorrectAnswers);
                                    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
                                    // Grade logic (reuse what is in your code)
                                    let grade = 1;
                                    if (percentage >= 80) grade = 7;
                                    else if (percentage >= 70) grade = 6;
                                    else if (percentage >= 60) grade = 5;
                                    else if (percentage >= 50) grade = 4;
                                    else if (percentage >= 40) grade = 3;
                                    else if (percentage >= 30) grade = 2;
                                    // Grade description
                                    const gradeDescription =
                                        grade === 1 ? 'Not achieved' :
                                            grade === 7 ? 'Outstanding achievement' :
                                                grade === 6 ? 'Meritorious achievement' :
                                                    grade === 5 ? 'Substantial achievement' :
                                                        grade === 4 ? 'Adequate achievement' :
                                                            grade === 3 ? 'Moderate achievement' :
                                                                'Elementary achievement';
                                    return {
                                        ...subj,
                                        correctAnswers: correct.toString(),
                                        incorrectAnswers: incorrect.toString(),
                                        percentage,
                                        grade,
                                        gradeDescription,
                                    };
                                });
                                return mergedSubjects
                                    .sort((a, b) => a.subject.localeCompare(b.subject))
                                    .map((subject, index) => (
                                        <TouchableOpacity
                                            key={`${subject.subject}-${index}`}
                                            onPress={() => openSubjectReport(subject)}
                                            activeOpacity={0.7}
                                        >
                                            <ThemedView
                                                style={[
                                                    styles.subjectCard,
                                                    {
                                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                                                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                                                    }
                                                ]}
                                            >
                                                <View style={styles.subjectHeader}>
                                                    <ThemedText style={styles.subjectName}>
                                                        {(subjectEmojis as Record<string, string>)[getCleanSubjectName(subject.subject)] || '📚'} {subject.subject}
                                                    </ThemedText>
                                                    <Ionicons
                                                        name="stats-chart"
                                                        size={24}
                                                        color={isDark ? '#FFFFFF' : '#000000'}
                                                    />
                                                </View>

                                                <View style={styles.statsGrid}>
                                                    <View style={styles.statItem}>
                                                        <ThemedText style={styles.statLabel}>Total Answers</ThemedText>
                                                        <ThemedText style={styles.statValue}>{subject.totalAnswers}</ThemedText>
                                                    </View>

                                                    <View style={styles.statItem}>
                                                        <ThemedText style={styles.statLabel}>Correct</ThemedText>
                                                        <ThemedText style={[styles.statValue, { color: '#10B981' }]}> {subject.correctAnswers} </ThemedText>
                                                    </View>

                                                    <View style={styles.statItem}>
                                                        <ThemedText style={styles.statLabel}>Incorrect</ThemedText>
                                                        <ThemedText style={[styles.statValue, { color: '#EF4444' }]}> {subject.incorrectAnswers} </ThemedText>
                                                    </View>
                                                </View>

                                                <View style={styles.performanceFooter}>
                                                    <View style={styles.percentageContainer}>
                                                        <ThemedText style={styles.percentageLabel}>Success Rate</ThemedText>
                                                        <ThemedText style={[
                                                            styles.percentageValue,
                                                            { color: subject.grade === 1 ? '#EF4444' : '#3B82F6' }
                                                        ]}>
                                                            {subject.percentage}%
                                                        </ThemedText>
                                                    </View>

                                                    <View style={[
                                                        styles.levelBadge,
                                                        { backgroundColor: getGradeColor(subject.grade) }
                                                    ]}>
                                                        <ThemedText style={styles.levelText}>Level {subject.grade}</ThemedText>
                                                        <ThemedText style={styles.levelDescription}>
                                                            {subject.gradeDescription}
                                                        </ThemedText>
                                                    </View>
                                                </View>
                                            </ThemedView>
                                        </TouchableOpacity>
                                    ));
                            })()}
                        </View>
                    </>
                )}
            </ScrollView>

            {selectedSubject && (
                <SubjectReportModal
                    isVisible={isModalVisible}
                    onClose={closeModal}
                    subject={selectedSubject}
                    isDark={isDark}
                    dailyActivity={subjectDailyActivity}
                    isLoading={isSubjectLoading}
                    uid={uid as string}
                    name={name as string}
                    user={user}
                    learnerInfo={learnerInfo}
                />
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        opacity: 0.7,
        textAlign: 'center',
    },
    chartContainer: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    performanceContainer: {
        gap: 16,
    },
    subjectCard: {
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    subjectName: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(128, 128, 128, 0.2)',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        fontSize: 13,
        opacity: 0.8,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '600',
    },
    performanceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    percentageContainer: {
        flex: 1,
    },
    percentageLabel: {
        fontSize: 13,
        opacity: 0.8,
        marginBottom: 4,
    },
    percentageValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    levelBadge: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 160,
    },
    levelText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    levelDescription: {
        color: '#FFFFFF',
        fontSize: 14,
        opacity: 0.9,
    },
    headerContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    closeButton: {
        padding: 8,
        width: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    shareButtonText: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '600',
    },
    followButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        marginLeft: 8,
    },
    followButtonText: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    topicItem: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: '#FFFFFF',
    },
    topicHeader: {
        paddingVertical: 8,
    } as const,
    topicHeaderContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    } as const,
    mainTopicName: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    topicStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statGroup: {
        alignItems: 'center',
        flex: 1,
    },
    topicStatLabel: {
        fontSize: 13,
        opacity: 0.7,
        marginBottom: 4,
    },
    topicStatValue: {
        fontSize: 20,
        fontWeight: '600',
    },
    gradeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    successRate: {
        flex: 1,
    },
    successRateLabel: {
        fontSize: 13,
        opacity: 0.7,
        marginBottom: 4,
    },
    successRateValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    subTopicsContainer: {
        marginTop: 16,
        gap: 12,
    },
    subTopicItem: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    subTopicName: {
        fontSize: 14,
        marginBottom: 12,
        opacity: 0.9,
    },
    subTopicStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    subTopicStat: {
        alignItems: 'center',
        flex: 1,
    },
    subTopicStatLabel: {
        fontSize: 12,
        opacity: 0.7,
        marginBottom: 4,
    },
    subTopicStatValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    subTopicGradeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    subTopicSuccessRate: {
        flex: 1,
    },
    subTopicGradeValue: {
        fontSize: 20,
        fontWeight: '600',
    },
    subTopicLevelBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        minWidth: 140,
    },
    subTopicLevelText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    subTopicLevelDescription: {
        color: '#FFFFFF',
        fontSize: 12,
        opacity: 0.9,
    },
    hintText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 16,
        opacity: 0.8,
        fontStyle: 'italic',
    },
    todayEventsContainer: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
    },
    todayEventsTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    todayEventsEmpty: {
        fontSize: 15,
        opacity: 0.7,
        fontStyle: 'italic',
    },
    todayEventCard: {
        marginTop: 8,
        marginBottom: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(99,102,241,0.08)',
    },
    todayEventTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    todayEventTime: {
        fontSize: 14,
        marginTop: 2,
        marginBottom: 2,
    },
    todayEventSubject: {
        fontSize: 14,
        marginBottom: 2,
    },
    todayEventReminder: {
        fontSize: 13,
        color: '#6366F1',
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingTop: 24,
    },
    modalContent: {
        flex: 1,
        padding: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '100%',
        height: '100%',
        borderWidth: 0,
        marginTop: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 8,
        marginTop: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    closeModalButton: {
        padding: 8,
    },
    modalScrollView: {
        flex: 1,
    },
    modalScrollViewContent: {
        paddingBottom: 0,
    },
    modalLoadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingImage: {
        width: 200,
        height: 200,
        marginBottom: 24,
    },
    modalLoadingText: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalLoadingSubtext: {
        fontSize: 16,
        opacity: 0.7,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 24,
    },
    loadingIndicator: {
        marginTop: 16,
    },
    modalEmptyDataContainer: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalEmptyDataText: {
        fontSize: 16,
        textAlign: 'center',
        opacity: 0.8,
    },
    modalStatsContainer: {
        marginBottom: 20,
    },
    modalStatItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    modalStatLabel: {
        fontSize: 13,
        opacity: 0.8,
    },
    modalStatValue: {
        fontSize: 20,
        fontWeight: '600',
    },
    modalGradeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalGradeInfo: {
        flex: 1,
    },
    modalGradeLabel: {
        fontSize: 13,
        opacity: 0.8,
        marginBottom: 4,
    },
    modalGradeValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    modalGradeBadge: {
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalGradeText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    modalGradeDescription: {
        color: '#FFFFFF',
        fontSize: 14,
        opacity: 0.9,
    },
    subjectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    graphButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    badgesContainer: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
    },
    badgesTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    badgesScrollContent: {
        paddingRight: 16,
    },
    badgeItem: {
        alignItems: 'center',
        marginRight: 16,
        width: 80,
    },
    badgeImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginBottom: 8,
    },
    badgeName: {
        fontSize: 14,
        textAlign: 'center'
    },
    topicActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quizButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        marginTop: 16,
        borderWidth: 1,
        gap: 8,
    },
    quizButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    lockedTopicContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        marginTop: 16,
    },
    lockedTopicText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16,
        opacity: 0.8,
    },
    upgradeButton: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    upgradeButtonGradient: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    upgradeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
}); 