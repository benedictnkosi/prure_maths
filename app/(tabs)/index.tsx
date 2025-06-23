import React from 'react';
import { StyleSheet, Pressable, ActivityIndicator, View, ScrollView, Share, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { MathTopic } from '@/types/math';
import { HOST_URL } from '@/config/api';
import { Header } from '@/components/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { getLearner } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Learning modes
const LEARNING_MODES = [
  { id: 'practice', label: 'Practice', emoji: '✏️', description: 'Step-by-step solving' },
  { id: 'quiz', label: 'Quiz', emoji: '🎯', description: 'Test your knowledge' }
];

// Available subjects - now dynamic based on grade
const getAvailableSubjects = (grade: number | null) => {
  const allSubjects = [
    { label: 'Mathematics', value: 'Mathematics' },
    { label: 'Applied Maths	', value: 'Technical Mathematics' },
  ];
  
  // Hide Technical Mathematics for grades 8 and 9 (level 1 and 2)
  if (grade === 8 || grade === 9) {
    return allSubjects.filter(subject => subject.value !== 'Technical Mathematics');
  }
  
  return allSubjects;
};

// Subject emojis
const SUBJECT_EMOJIS: Record<string, string> = {
  'Mathematics': '📐',
  'Technical Mathematics': '🔧',
};

// Subject colors
const SUBJECT_COLORS: Record<string, { light: string; dark: string }> = {
  'Mathematics': { light: '#E0E7FF', dark: '#3730A3' },
  'Technical Mathematics': { light: '#FDE68A', dark: '#92400E' },
};

// Math topic emojis
const TOPIC_EMOJIS: Record<string, string> = {
  'Analytical Geometry': '📏',
  'Counting and probability': '🎲',
  'Differential Calculus, including polynomials': '📉',
  'Euclidean Geometry': '📐',
  'Finance, growth and decay (continuation)': '💹',
  'Functions: Formal definition, inverses, exponential and logarithmic': '📈',
  'Number patterns, sequences and series': '🔢',
  'Statistics': '📊',
  'Trigonometry': '📐',
  'Equations and Inequalities': '➗',
  'Exponents and Surds': '🧮',
  'Functions (Including Trigonometric Functions)': '📈',
  'Number Patterns': '🔢',
  'Trigonometry (Reduction Formulae, Trig Equations & General Solutions)': '📐',
  'Trigonometry (Sine, Cosine and Area Rules)': '📏',
  'Algebraic Expressions': '🧮',
  'Exponents, Equations and Inequalities': '➗',
  'Finance and Growth': '💹',
  'Functions and Graphs (Including Trigonometric Functions)': '📈',
  'Measurement': '📏',
  'Probability': '🎲',
  'Algebraic Equations': '➗',
  'Exponents': '🧮',
  'Geometry of 2D Shapes and Construction': '📐',
  'Geometry of Straight Lines': '📏',
  'Integers': '🔢',
  'Numeric and Geometric Patterns': '🔢',
  'Whole Numbers': '🔢',
  'Complex Numbers': '🔢',
  'Differential Calculus': '📉',
  'Integration': '➕',
  'Polynomials': '🧮',
};

// Unique color for each topic card - updated for dark mode compatibility
const TOPIC_COLORS: Record<string, { light: string; dark: string }> = {
  'Analytical Geometry': { light: '#C7D2FE', dark: '#1E3A8A' },
  'Counting and probability': { light: '#FEF3C7', dark: '#92400E' },
  'Differential Calculus, including polynomials': { light: '#F3E8FF', dark: '#6B21A8' },
  'Euclidean Geometry': { light: '#F3F4F6', dark: '#374151' },
  'Finance, growth and decay (continuation)': { light: '#C7F9CC', dark: '#14532D' },
  'Functions: Formal definition, inverses, exponential and logarithmic': { light: '#F3E8FF', dark: '#6B21A8' },
  'Number patterns, sequences and series': { light: '#DBEAFE', dark: '#1E40AF' },
  'Statistics': { light: '#DCFCE7', dark: '#166534' },
  'Trigonometry': { light: '#FCE7F3', dark: '#831843' },
  'Equations and Inequalities': { light: '#FDE68A', dark: '#92400E' },
  'Exponents and Surds': { light: '#FBCFE8', dark: '#9D174D' },
  'Functions (Including Trigonometric Functions)': { light: '#F3E8FF', dark: '#6B21A8' },
  'Number Patterns': { light: '#DBEAFE', dark: '#1E40AF' },
  'Trigonometry (Reduction Formulae, Trig Equations & General Solutions)': { light: '#FCE7F3', dark: '#831843' },
  'Trigonometry (Sine, Cosine and Area Rules)': { light: '#E0E7FF', dark: '#3730A3' },
  'Algebraic Expressions': { light: '#FDE68A', dark: '#92400E' },
  'Exponents, Equations and Inequalities': { light: '#E0E7FF', dark: '#3730A3' },
  'Finance and Growth': { light: '#C7F9CC', dark: '#14532D' },
  'Functions and Graphs (Including Trigonometric Functions)': { light: '#F3E8FF', dark: '#6B21A8' },
  'Measurement': { light: '#FECACA', dark: '#991B1B' },
  'Probability': { light: '#FEF3C7', dark: '#92400E' },
  'Algebraic Equations': { light: '#E0E7FF', dark: '#3730A3' },
  'Exponents': { light: '#FBCFE8', dark: '#9D174D' },
  'Geometry of 2D Shapes and Construction': { light: '#F3F4F6', dark: '#374151' },
  'Geometry of Straight Lines': { light: '#C7D2FE', dark: '#1E3A8A' },
  'Integers': { light: '#FDE68A', dark: '#92400E' },
  'Numeric and Geometric Patterns': { light: '#DBEAFE', dark: '#1E40AF' },
  'Whole Numbers': { light: '#DCFCE7', dark: '#166534' },
  'Complex Numbers': { light: '#F3E8FF', dark: '#6B21A8' },
  'Differential Calculus': { light: '#FBCFE8', dark: '#9D174D' },
  'Integration': { light: '#C7F9CC', dark: '#14532D' },
  'Polynomials': { light: '#FDE68A', dark: '#92400E' },
};

// Grade to Level mapping
const GRADE_TO_LEVEL: Record<number, number> = {
  12: 5,
  11: 4,
  10: 3,
  9: 2,
  8: 1,
};

function getLevelFromGrade(grade: number): number {
  return GRADE_TO_LEVEL[grade] || grade;
}

function formatQuestionCount(count: number): string {
  return `${count} question${count !== 1 ? 's' : ''}`;
}

export default function HomeScreen() {
  const [topics, setTopics] = useState<MathTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGrade, setIsLoadingGrade] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [learnerGrade, setLearnerGrade] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<MathTopic | null>(null);
  const [showSubtopics, setShowSubtopics] = useState(false);
  const [selectedLearningMode, setSelectedLearningMode] = useState<string | null>(null);
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const passedLearningMode = params.learningMode as string;
  const passedSubject = params.subjectName as string;
  const passedTopic = params.topic as string;

  // Fetch learner data to get grade
  useFocusEffect(
    React.useCallback(() => {
      async function fetchLearnerData() {
        if (!user?.uid) {
          setIsLoadingGrade(false);
          return;
        }

        try {
          const learner = await getLearner(user.uid);
          console.log('Learner data received:', JSON.stringify(learner, null, 2));

          // Add null checking for learner.grade
          if (learner?.grade?.number) {
            console.log('Setting learner grade to:', learner.grade.number);
            setLearnerGrade(learner.grade.number);
          } else {
            console.warn('Learner grade not found, using fallback grade 12. Learner data:', learner);
            setLearnerGrade(12);
          }
        } catch (error) {
          console.error('Error fetching learner data:', error);
          // Fallback to grade 12 if we can't fetch the learner's grade
          setLearnerGrade(12);
        } finally {
          setIsLoadingGrade(false);
        }
      }

      fetchLearnerData();

      // Load last selected learning mode and subject every time screen comes into focus
      const loadLastSelections = async () => {
        try {
          const [storedMode, storedSubject] = await Promise.all([
            AsyncStorage.getItem('lastLearningMode'),
            AsyncStorage.getItem('lastSelectedSubject')
          ]);
          
          if (storedMode && LEARNING_MODES.some(mode => mode.id === storedMode)) {
            setSelectedLearningMode(storedMode);
          }
          
          // Only validate and set stored subject if learnerGrade is available
          if (storedSubject && learnerGrade && getAvailableSubjects(learnerGrade).some(subject => subject.value === storedSubject)) {
            setSelectedSubject(storedSubject);
            fetchTopics(storedSubject);
          } else if (storedSubject && !learnerGrade) {
            // If we have a stored subject but no grade yet, set it anyway and let the useEffect handle fetching
            setSelectedSubject(storedSubject);
          }
        } catch (e) {
          // Ignore errors
        }
      };
      loadLastSelections();

      // Check for passed parameters from calling page
      // Auto-set learning mode if passed
      if (passedLearningMode && LEARNING_MODES.some(mode => mode.id === passedLearningMode)) {
        console.log('Auto-setting learning mode to:', passedLearningMode);
        setSelectedLearningMode(passedLearningMode);
      }

      // Auto-set subject if passed
      if (passedSubject && getAvailableSubjects(learnerGrade).some(subject => subject.value === passedSubject)) {
        console.log('Auto-setting subject to:', passedSubject);
        setSelectedSubject(passedSubject);
        fetchTopics(passedSubject);
      }

      // Reset to subjects view when tab is focused (only if no parameters passed)
      if (!passedLearningMode && !passedSubject && !passedTopic) {
        // Don't reset subject here - let loadLastSelections handle it
        setTopics([]);
        setError(null);
        setSelectedTopic(null);
        setShowSubtopics(false);
        // Don't reset learning mode here - let loadLastSelections handle it
      }
    }, [user?.uid, passedLearningMode, passedSubject, passedTopic, learnerGrade])
  );

  // Auto-select topic when topics are loaded and a topic is passed
  useEffect(() => {
    if (passedTopic && topics.length > 0 && !isLoading) {
      const topicToSelect = topics.find(topic => topic.mainTopic === passedTopic);
      if (topicToSelect) {
        console.log('Auto-selecting topic:', passedTopic);
        setSelectedTopic(topicToSelect);
        setShowSubtopics(true);
      }
    }
  }, [topics, passedTopic, isLoading]);

  // Retry fetching topics when learner grade becomes available
  useEffect(() => {
    if (learnerGrade && selectedSubject && topics.length === 0 && !isLoading) {
      console.log('Retrying to fetch topics for stored subject:', selectedSubject);
      fetchTopics(selectedSubject);
    }
  }, [learnerGrade, selectedSubject]);

  async function fetchTopics(subject: string) {
    if (!learnerGrade) {
      console.log('Learner grade not available yet, will retry when grade is loaded');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${HOST_URL}/api/maths/topics-subtopics-with-steps?grade=${learnerGrade}&subject_name=${encodeURIComponent(subject)}`);
      const data = await response.json();
      if (data.status === 'OK') {
        setTopics(data.topics);
      } else {
        setError('Error fetching topics');
      }
    } catch (err) {
      setError('Error fetching topics');
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubjectPress = async (subject: string) => {
    setSelectedSubject(subject);
    try {
      await AsyncStorage.setItem('lastSelectedSubject', subject);
    } catch (e) {
      // Ignore errors
    }
    fetchTopics(subject);
  };

  const handleLearningModeSelect = async (modeId: string) => {
    setSelectedLearningMode(modeId);
    try {
      await AsyncStorage.setItem('lastLearningMode', modeId);
    } catch (e) {
      // Ignore errors
    }
  };

  const handleBackToSubjects = async () => {
    setSelectedSubject(null);
    setTopics([]);
    setError(null);
    // Clear stored subject when manually going back
    try {
      await AsyncStorage.removeItem('lastSelectedSubject');
    } catch (e) {
      // Ignore errors
    }
    // setSelectedLearningMode(null);
    try {
      const storedMode = await AsyncStorage.getItem('lastLearningMode');
      if (storedMode && LEARNING_MODES.some(mode => mode.id === storedMode)) {
        setSelectedLearningMode(storedMode);
      } else {
        setSelectedLearningMode(null);
      }
    } catch {
      setSelectedLearningMode(null);
    }
  };

  const handleTopicPress = (topic: MathTopic) => {
    if (selectedLearningMode === 'quiz' || selectedLearningMode === 'lessons') {
      // Go directly to quiz/lessons for the main topic
      router.push({
        pathname: '/quiz',
        params: {
          topic: topic.mainTopic,
          subjectName: selectedSubject!,
          learnerUid: user?.uid,
          grade: learnerGrade?.toString(),
          learningMode: selectedLearningMode,
        },
      });
    } else {
      // Practice mode: always show subtopic selection
      setSelectedTopic(topic);
      setShowSubtopics(true);
    }
  };

  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setShowSubtopics(false);
  };

  const handlePracticeAll = () => {
    if (!user?.uid || !learnerGrade || !selectedTopic) {
      setError('Unable to determine user information');
      return;
    }

    // Route to quiz screen for quiz or lesson mode, maths screen for practice mode
    if (selectedLearningMode === 'quiz' || selectedLearningMode === 'lessons') {
      router.push({
        pathname: '/quiz',
        params: {
          topic: selectedTopic.mainTopic,
          subjectName: selectedSubject!,
          learnerUid: user.uid,
          grade: learnerGrade.toString(),
          learningMode: selectedLearningMode,
          practiceAll: 'true',
        },
      });
    } else {
      // Practice mode - navigate to maths screen
      router.push({
        pathname: '/maths',
        params: {
          topic: selectedTopic.mainTopic,
          subjectName: selectedSubject!,
          learnerUid: user.uid,
          grade: learnerGrade.toString(),
          practiceAll: 'true',
          learningMode: selectedLearningMode || 'quiz',
        },
      });
    }
  };

  const handleSubtopicPress = (subtopicName: string, topic?: MathTopic) => {
    const currentTopic = topic || selectedTopic;
    if (!user?.uid || !learnerGrade || !currentTopic) {
      setError('Unable to determine user information');
      return;
    }

    // Route to quiz screen for quiz or lesson mode, maths screen for practice mode
    if (selectedLearningMode === 'quiz' || selectedLearningMode === 'lessons') {
      router.push({
        pathname: '/quiz',
        params: {
          topic: currentTopic.mainTopic,
          subtopic: subtopicName,
          subjectName: selectedSubject!,
          learnerUid: user.uid,
          grade: learnerGrade.toString(),
          learningMode: selectedLearningMode,
        },
      });
    } else {
      // Practice mode - navigate to maths screen
      router.push({
        pathname: '/maths',
        params: {
          topic: currentTopic.mainTopic,
          subtopic: subtopicName,
          subjectName: selectedSubject!,
          learnerUid: user.uid,
          grade: learnerGrade.toString(),
          learningMode: selectedLearningMode || 'quiz',
        },
      });
    }
  };

  const handleShareApp = async () => {
    try {
      const iosLink = 'https://apps.apple.com/za/app/dimpo-learning-app/6747572593';
      const androidLink = 'https://play.google.com/store/apps/details?id=za.co.dimpomaths';

      const shareMessage = `📚 Master Mathematics with Dimpo Maths App! 🧮

🎯 Practice with step-by-step solutions
📊 Track your progress and earn badges
🏆 Compete with friends and climb leaderboards
📱 Perfect for exam preparation

Download now:
📱 iOS: ${iosLink}
🤖 Android: ${androidLink}

#PureMaths #Mathematics #ExamPrep #Learning`;

      await Share.share({
        message: shareMessage,
        title: 'Dimpo Maths App',
        url: Platform.select({
          ios: iosLink,
          android: androidLink,
          default: androidLink
        }),
      });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 20,
      backgroundColor: colors.background,
    },
    learningModeContainer: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    learningModeTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    learningModeGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    learningModeCard: {
      flex: 1,
      paddingVertical: 20,
      paddingHorizontal: 16,
      borderRadius: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    learningModeCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    learningModeEmoji: {
      fontSize: 32,
      marginBottom: 8,
    },
    learningModeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    learningModeDescription: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginBottom: 20,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.primary + '20',
      alignSelf: 'flex-start',
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 8,
    },
    subjectsContainer: {
      flexDirection: 'column',
      gap: 16,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    subjectCard: {
      width: '100%',
      paddingVertical: 40,
      paddingHorizontal: 24,
      borderRadius: 18,
      alignItems: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e6e6e6',
      backgroundColor: undefined,
    },
    subjectCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    subjectEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    subjectName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      minWidth: 160,
      maxWidth: 200,
      alignSelf: 'center',
    },
    subjectDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      opacity: 0.7,
    },
    topicsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    topicCard: {
      width: '90%',
      paddingVertical: 28,
      paddingHorizontal: 20,
      borderRadius: 18,
      alignItems: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#e6e6e6',
      backgroundColor: undefined,
    },
    topicCardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    topicEmoji: {
      fontSize: 40,
      marginBottom: 10,
    },
    topicName: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
      color: colors.text,
      textAlign: 'center',
    },
    topicQuestionCount: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    subtopicsCount: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      opacity: 0.8,
    },
    headerImage: {
      height: 200,
      width: '100%',
    },
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <ThemedView style={styles.container}>
        {/* View My Report Button and Share App Button - only show if no subject is selected */}
        {!selectedSubject && (
          <>
            {/* View My Report Button - only show if user is logged in */}
            {user?.uid && (
              <Pressable
                style={({ pressed }) => [
                  {
                    marginHorizontal: 20,
                    marginTop: 16,
                    marginBottom: 8,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? colors.primary : '#6366F1',
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  },
                ]}
                onPress={() => {
                  router.push({
                    pathname: '/report/[uid]',
                    params: { uid: user.uid, name: user.displayName || 'Me' },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel="View my performance report"
              >
                <ThemedText style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                  🏆 View My Report
                </ThemedText>
              </Pressable>
            )}

            {/* Share App Button */}
            <Pressable
              style={({ pressed }) => [
                {
                  marginHorizontal: 20,
                  marginTop: 8,
                  marginBottom: 16,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? colors.surface : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: isDark ? colors.border : '#E5E7EB',
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                },
              ]}
              onPress={handleShareApp}
              accessibilityRole="button"
              accessibilityLabel="Share Dimpo Maths app"
            >
              <ThemedText style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                📤 Invite a Friend
              </ThemedText>
            </Pressable>
          </>
        )}

        {isLoadingGrade ? (
          // Show loading state while fetching learner grade
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={styles.loadingText}>Loading your grade level...</ThemedText>
          </View>
        ) : selectedSubject ? (
          // Show topics for selected subject
          <>
            {showSubtopics && selectedTopic && selectedLearningMode === 'practice' ? (
              <>
                <Pressable style={styles.backButton} onPress={handleBackToTopics}>
                  <ThemedText style={{ fontSize: 20 }}>←</ThemedText>
                  <ThemedText style={styles.backButtonText}>Back to Topics</ThemedText>
                </Pressable>
                <ThemedView style={styles.topicsContainer}>
                  <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.text }}>
                    {selectedTopic.mainTopic}
                  </ThemedText>
                  <Pressable
                    style={({ pressed }) => [
                      styles.topicCard,
                      { backgroundColor: isDark ? colors.primary : colors.surface, marginBottom: 16 },
                      pressed && styles.topicCardPressed,
                    ]}
                    onPress={handlePracticeAll}
                    accessibilityRole="button"
                    accessibilityLabel={`Practice all questions in ${selectedTopic.mainTopic}`}
                  >
                    <ThemedText style={{ fontWeight: 'bold', color: colors.text }}>
                      Practice All Questions
                    </ThemedText>
                  </Pressable>
                  {selectedTopic.subtopics.map((sub, idx) => (
                    <Pressable
                      key={sub.name}
                      style={({ pressed }) => [
                        styles.topicCard,
                        { backgroundColor: isDark ? colors.surface : '#F3F4F6', marginBottom: 8 },
                        pressed && styles.topicCardPressed,
                      ]}
                      onPress={() => handleSubtopicPress(sub.name, selectedTopic)}
                      accessibilityRole="button"
                      accessibilityLabel={`Practice ${sub.name}`}
                    >
                      <ThemedText style={{ color: colors.text }}>{sub.name}</ThemedText>
                      <ThemedText style={styles.topicQuestionCount}>{formatQuestionCount(sub.questionCount)}</ThemedText>
                    </Pressable>
                  ))}
                </ThemedView>
              </>
            ) : (
              <>
                <Pressable style={styles.backButton} onPress={handleBackToSubjects}>
                  <ThemedText style={{ fontSize: 20 }}>←</ThemedText>
                  <ThemedText style={styles.backButtonText}>Back to Subjects</ThemedText>
                </Pressable>

                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <ThemedText style={styles.loadingText}>Loading math topics...</ThemedText>
                  </View>
                ) : error ? (
                  <ThemedText>{error}</ThemedText>
                ) : (
                  <ThemedView style={styles.topicsContainer}>
                    {topics
                      .sort((a, b) => b.questionCount - a.questionCount)
                      .map((topic) => (
                        <Pressable
                          key={topic.mainTopic}
                          style={({ pressed }) => [
                            [
                              styles.topicCard,
                              {
                                backgroundColor: TOPIC_COLORS[topic.mainTopic]
                                  ? (isDark
                                    ? TOPIC_COLORS[topic.mainTopic].dark
                                    : TOPIC_COLORS[topic.mainTopic].light)
                                  : colors.surface,
                              },
                            ],
                            pressed && styles.topicCardPressed,
                          ]}
                          onPress={() => handleTopicPress(topic)}
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${topic.mainTopic}`}
                        >
                          <ThemedText style={styles.topicEmoji}>
                            {TOPIC_EMOJIS[topic.mainTopic] || '📚'}
                          </ThemedText>
                          <ThemedText style={styles.topicName}>
                            {topic.mainTopic}
                          </ThemedText>
                          <ThemedText style={styles.topicQuestionCount}>
                            {formatQuestionCount(topic.questionCount)}
                          </ThemedText>
                          <ThemedText style={styles.subtopicsCount}>
                            {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}
                          </ThemedText>
                        </Pressable>
                      ))}
                  </ThemedView>
                )}
              </>
            )}
          </>
        ) : (
          // Show learning mode selection and subject selection
          <>
            {learnerGrade && (
              <ThemedView style={{ paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center' }}>
                <ThemedText style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  Level {getLevelFromGrade(learnerGrade)} Mathematics
                </ThemedText>
                <ThemedText style={{
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  opacity: 0.8
                }}>
                  Choose your learning mode and subject
                </ThemedText>
              </ThemedView>
            )}

            {/* Learning Mode Selection */}
            <ThemedView style={styles.learningModeContainer}>
              <ThemedText style={styles.learningModeTitle}>
                Choose Learning Mode
              </ThemedText>
              <View style={styles.learningModeGrid}>
                {LEARNING_MODES.map((mode) => (
                  <Pressable
                    key={mode.id}
                    style={({ pressed }) => [
                      styles.learningModeCard,
                      {
                        backgroundColor: isDark ? colors.surface : '#F8F9FA',
                        opacity: pressed ? 0.8 : 1,
                      },
                      selectedLearningMode === mode.id && styles.learningModeCardSelected,
                    ]}
                    onPress={() => handleLearningModeSelect(mode.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${mode.label} mode`}
                  >
                    <ThemedText style={styles.learningModeEmoji}>
                      {mode.emoji}
                    </ThemedText>
                    <ThemedText style={styles.learningModeLabel}>
                      {mode.label}
                    </ThemedText>
                    <ThemedText style={styles.learningModeDescription}>
                      {mode.description}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ThemedView>

            <ThemedText style={styles.learningModeTitle}>
              Choose Subject
            </ThemedText>
            {/* Subject Selection */}
            <ThemedView style={styles.subjectsContainer}>

              {getAvailableSubjects(learnerGrade).map((subject) => (
                <Pressable
                  key={subject.value}
                  style={({ pressed }) => [
                    [
                      styles.subjectCard,
                      {
                        backgroundColor: SUBJECT_COLORS[subject.value]
                          ? (isDark
                            ? SUBJECT_COLORS[subject.value].dark
                            : SUBJECT_COLORS[subject.value].light)
                          : colors.surface,
                        opacity: selectedLearningMode ? 1 : 0.5,
                      },
                    ],
                    pressed && styles.subjectCardPressed,
                  ]}
                  onPress={() => handleSubjectPress(subject.value)}
                  disabled={!selectedLearningMode}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${subject.label}`}
                >
                  <ThemedText style={styles.subjectEmoji}>
                    {SUBJECT_EMOJIS[subject.value] || '📚'}
                  </ThemedText>
                  <ThemedText style={styles.subjectName}>
                    {subject.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          </>
        )}
      </ThemedView>
    </ScrollView>
  );
}