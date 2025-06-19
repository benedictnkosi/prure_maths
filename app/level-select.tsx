import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const LEVELS = [
    { grade: 8, label: 'Level 1 (Grade 8)' },
    { grade: 9, label: 'Level 2 (Grade 9)' },
    { grade: 10, label: 'Level 3 (Grade 10)' },
    { grade: 11, label: 'Level 4 (Grade 11)' },
    { grade: 12, label: 'Level 5 (Grade 12)' },
];

export default function LevelSelectScreen() {
    const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Load previously selected grade if available
        AsyncStorage.getItem('learnerGrade').then((grade) => {
            if (grade) setSelectedGrade(Number(grade));
        });
    }, []);

    const handleSelect = async (grade: number) => {
        setSelectedGrade(grade);
        await AsyncStorage.setItem('learnerGrade', grade.toString());
        // You can adjust navigation as needed:
        router.back(); // or router.replace('/(tabs)') or router.push('/onboarding')
    };

    return (
        <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Choose Your Level</ThemedText>
            <ThemedText style={styles.subtitle}>
                Select your current grade to personalize your learning experience.
            </ThemedText>
            <View style={styles.levelsContainer}>
                {LEVELS.map((level) => (
                    <TouchableOpacity
                        key={level.grade}
                        style={[
                            styles.levelButton,
                            selectedGrade === level.grade && styles.levelButtonSelected,
                        ]}
                        onPress={() => handleSelect(level.grade)}
                        testID={`level-${level.grade}`}
                    >
                        <ThemedText
                            style={[
                                styles.levelButtonText,
                                selectedGrade === level.grade && styles.levelButtonTextSelected,
                            ]}
                        >
                            {level.label}
                        </ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'transparent',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 16,
        color: '#fff',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#E2E8F0',
        marginBottom: 32,
        textAlign: 'center',
    },
    levelsContainer: {
        width: '100%',
        gap: 16,
    },
    levelButton: {
        width: '100%',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 2,
        borderColor: 'transparent',
        marginBottom: 12,
    },
    levelButtonSelected: {
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79,70,229,0.15)',
    },
    levelButtonText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
    },
    levelButtonTextSelected: {
        color: '#4F46E5',
    },
}); 