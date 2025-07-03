import React from 'react';
import { StyleSheet, Pressable, ActivityIndicator, View, ScrollView, Share, Platform, Modal } from 'react-native';
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
import { Paywall } from '../components/Paywall';
import SUBTOPIC_EMOJIS from '../constants/topicEmojis';

// Learning modes
const LEARNING_MODES = [
  { id: 'practice', label: 'Practice', emoji: '✏️', description: 'Step-by-step solving' },
  { id: 'quiz', label: 'Quiz', emoji: '🎯', description: 'Test your knowledge' }
];


// Math topic emojis
const TOPIC_EMOJIS: Record<string, string> = {
  'Algebra': '🧮',
  'Algebra and Equations': '➗',
  'Analytical Geometry': '📏',
  'Calculus': '∫',
  'Finance': '💰',
  'Finance and Growth': '📈',
  'Functions': '📊',
  'Functions and Graphs': '📉',
  'Measurement and Conversions': '📐',
  'Mensuration and Geometry': '🔺',
  'Probability': '🎲',
  'Sequences and Series': '🔢',
  'Statistics': '📊',
  'Trigonometry': '🧭',
  'Vectors': '🧲',
  'Vectors and Motion': '🏹',
  'Euclidean Geometry': '🟦',
  'Measurement': '📏',
  'Number Patterns': '🔢',
  'Geometry': '📐',
  'Graphs': '📈',
  'Data Handling (Statistics)': '📊',
  'Fractions, Decimals and Percentages': '¼',
  'Integers': '🔢',
  'Patterns and Sequences': '🔗',
};

// Unique color for each topic card - updated for dark mode compatibility
const TOPIC_COLORS: Record<string, { light: string; dark: string }> = {
  'Algebra': { light: '#FDE68A', dark: '#B45309' },
  'Algebra and Equations': { light: '#FCA5A5', dark: '#991B1B' },
  'Analytical Geometry': { light: '#C7D2FE', dark: '#1E3A8A' },
  'Calculus': { light: '#A7F3D0', dark: '#065F46' },
  'Finance': { light: '#F9FA8A', dark: '#A16207' },
  'Finance and Growth': { light: '#FDE68A', dark: '#92400E' },
  'Functions': { light: '#FBCFE8', dark: '#831843' },
  'Functions and Graphs': { light: '#A5B4FC', dark: '#3730A3' },
  'Measurement and Conversions': { light: '#F3F4F6', dark: '#374151' },
  'Mensuration and Geometry': { light: '#FCD34D', dark: '#92400E' },
  'Probability': { light: '#FCA5A5', dark: '#991B1B' },
  'Sequences and Series': { light: '#6EE7B7', dark: '#065F46' },
  'Statistics': { light: '#F9A8D4', dark: '#831843' },
  'Trigonometry': { light: '#FDE68A', dark: '#92400E' },
  'Vectors': { light: '#A7F3D0', dark: '#065F46' },
  'Vectors and Motion': { light: '#F3F4F6', dark: '#374151' },
  'Euclidean Geometry': { light: '#B6E0FE', dark: '#155E75' },
  'Measurement': { light: '#FDE68A', dark: '#B45309' },
  'Number Patterns': { light: '#A5B4FC', dark: '#3730A3' },
  'Geometry': { light: '#FCD34D', dark: '#92400E' },
  'Graphs': { light: '#A7F3D0', dark: '#065F46' },
  'Data Handling (Statistics)': { light: '#F9A8D4', dark: '#831843' },
  'Fractions, Decimals and Percentages': { light: '#FDE68A', dark: '#B45309' },
  'Integers': { light: '#A5B4FC', dark: '#3730A3' },
  'Patterns and Sequences': { light: '#6EE7B7', dark: '#065F46' },
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

// Subtopic color palette for variety
const SUBTOPIC_COLORS = [
  { light: '#FDE68A', dark: '#B45309' },
  { light: '#A7F3D0', dark: '#065F46' },
  { light: '#FCA5A5', dark: '#991B1B' },
  { light: '#C7D2FE', dark: '#1E3A8A' },
  { light: '#FBCFE8', dark: '#831843' },
  { light: '#A5B4FC', dark: '#3730A3' },
  { light: '#F9A8D4', dark: '#831843' },
  { light: '#FCD34D', dark: '#92400E' },
  { light: '#6EE7B7', dark: '#065F46' },
  { light: '#F9FA8A', dark: '#A16207' },
  { light: '#B6E0FE', dark: '#155E75' },
  { light: '#F3F4F6', dark: '#374151' },
];

function getSubtopicColor(idx: number, isDark: boolean) {
  const colorObj = SUBTOPIC_COLORS[idx % SUBTOPIC_COLORS.length];
  return isDark ? colorObj.dark : colorObj.light;
}

export default function HomeScreen() {
  const [topics, setTopics] = useState<MathTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGrade, setIsLoadingGrade] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [learnerGrade, setLearnerGrade] = useState<number | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<MathTopic | null>(null);
  const [showSubtopics, setShowSubtopics] = useState(false);
  const [selectedLearningMode, setSelectedLearningMode] = useState<string | null>(null);
  const [modeModalVisible, setModeModalVisible] = useState(false);
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const passedLearningMode = params.learningMode as string;
  const passedSubject = params.subjectName as string;
  const passedTopic = params.topic as string;
  const [showPaywall, setShowPaywall] = useState(false);

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

      // Load last selected learning mode every time screen comes into focus
      const loadLastSelections = async () => {
        try {
          const storedMode = await AsyncStorage.getItem('lastLearningMode');
          
          if (storedMode && LEARNING_MODES.some(mode => mode.id === storedMode)) {
            setSelectedLearningMode(storedMode);
          }

          // Always set subject to Mathematics and fetch topics
          setSelectedSubject('Mathematics');
          fetchTopics('Mathematics');
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

      // Auto-set subject if passed (though we always default to Mathematics)
      if (passedSubject && passedSubject === 'Mathematics') {
        console.log('Auto-setting subject to:', passedSubject);
        setSelectedSubject(passedSubject);
        fetchTopics(passedSubject);
      }

      // Reset to topics view when tab is focused (only if no parameters passed)
      if (!passedLearningMode && !passedSubject && !passedTopic) {
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
      console.log('Retrying to fetch topics for Mathematics');
      fetchTopics(selectedSubject);
    }
  }, [learnerGrade, selectedSubject]);

  useEffect(() => {
    // Show paywall on first visit
    const checkFirstVisit = async () => {
      try {
        const hasSeenPaywall = await AsyncStorage.getItem('hasSeenPaywall');
        if (!hasSeenPaywall) {
          setShowPaywall(true);
          await AsyncStorage.setItem('hasSeenPaywall', 'true');
        }
      } catch (e) {
        // Ignore errors
      }
    };
    checkFirstVisit();
  }, []);

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

  const handleLearningModeSelect = async (modeId: string) => {
    setSelectedLearningMode(modeId);
    try {
      await AsyncStorage.setItem('lastLearningMode', modeId);
    } catch (e) {
      // Ignore errors
    }
    
    // Always set subject to Mathematics and fetch topics
    setSelectedSubject('Mathematics');
    fetchTopics('Mathematics');
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
      // Practice mode: if only one subtopic, auto-navigate; else show subtopic selection
      if (topic.subtopics.length === 1) {
        handleSubtopicPress(topic.subtopics[0].name, topic);
      } else {
        setSelectedTopic(topic);
        setShowSubtopics(true);
      }
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
      const androidLink = 'https://play.google.com/store/apps/details?id=com.dimpomaths';

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
    subtopicCard: {
      width: '90%',
      paddingVertical: 24,
      paddingHorizontal: 18,
      borderRadius: 18,
      alignItems: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
    },
    subtopicEmoji: {
      fontSize: 36,
      marginBottom: 8,
    },
    subtopicName: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 2,
    },
  });

  return (
    <>
      {showPaywall && (
        <Paywall
          onSuccess={() => setShowPaywall(false)}
          onClose={() => setShowPaywall(false)}
        />
      )}
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header />
        {/* View Report Button - always visible if user is logged in */}
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
          ) : selectedLearningMode ? (
            // Show topics for selected subject
            <>
              {/* Learning mode selection as cards/buttons above topics */}
              <ThemedView style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8, marginBottom: 16, paddingHorizontal: 20 }}>
                {LEARNING_MODES.map((mode) => (
                  <Pressable
                    key={mode.id}
                    style={({ pressed }) => [
                      styles.learningModeCard,
                      {
                        backgroundColor: selectedLearningMode === mode.id
                          ? (isDark ? colors.primary : colors.primary + '10')
                          : (isDark ? colors.surface : '#F8F9FA'),
                        borderColor: selectedLearningMode === mode.id ? colors.primary : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                    onPress={async () => {
                      setSelectedLearningMode(mode.id);
                      // Always set subject to Mathematics and fetch topics
                      setSelectedSubject('Mathematics');
                      fetchTopics('Mathematics');
                      try {
                        await AsyncStorage.setItem('lastLearningMode', mode.id);
                      } catch {}
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${mode.label} mode`}
                  >
                    <ThemedText style={styles.learningModeEmoji}>{mode.emoji}</ThemedText>
                    <ThemedText style={styles.learningModeLabel}>{mode.label}</ThemedText>
                    <ThemedText style={styles.learningModeDescription}>{mode.description}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
              {showSubtopics && selectedTopic && selectedLearningMode === 'practice' ? (
                <>
                  <Pressable style={styles.backButton} onPress={handleBackToTopics}>
                    <ThemedText style={{ fontSize: 20 }}>←</ThemedText>
                    <ThemedText style={styles.backButtonText}>Back</ThemedText>
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
                          styles.subtopicCard,
                          {
                            backgroundColor: getSubtopicColor(idx, isDark),
                            borderColor: isDark ? colors.border : '#e6e6e6',
                          },
                          pressed && styles.topicCardPressed,
                        ]}
                        onPress={() => handleSubtopicPress(sub.name, selectedTopic)}
                        accessibilityRole="button"
                        accessibilityLabel={`Practice ${sub.name}`}
                      >
                        <ThemedText style={styles.subtopicEmoji}>
                          {(SUBTOPIC_EMOJIS[sub.name] || '📚')}
                        </ThemedText>
                        <ThemedText style={styles.subtopicName}>
                          {sub.name}
                        </ThemedText>
                        <ThemedText style={styles.topicQuestionCount}>{formatQuestionCount(sub.questionCount)}</ThemedText>
                      </Pressable>
                    ))}
                  </ThemedView>
                </>
              ) : (
                <>
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
                            {topic.subtopics.length > 1 && (
                              <ThemedText style={styles.subtopicsCount}>
                                {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}
                              </ThemedText>
                            )}
                          </Pressable>
                        ))}
                    </ThemedView>
                  )}
                </>
              )}
            </>
          ) : (
            // Show learning mode selection
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
                    Choose your learning mode
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
            </>
          )}
        </ThemedView>
      </ScrollView>
    </>
  );
}