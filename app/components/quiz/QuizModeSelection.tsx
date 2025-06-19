import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useColorScheme } from 'react-native';
import { Colors as colorConstants } from '@/constants/Colors';

export interface QuizMode {
    id: string;
    title: string;
    description: string;
    icon: string;
    isPremium?: boolean;
}


const styles = StyleSheet.create({
    container: {
        padding: 16,
        width: '100%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modesContainer: {
        gap: 12,
        width: '100%',
    },
    modeCard: {
        borderRadius: 12,
        padding: 16,
        width: '100%',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowRadius: 4,
        elevation: 3,
    },
    modeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modeIcon: {
        fontSize: 24,
    },
    modeTextContainer: {
        flex: 1,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modeTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    modeDescription: {
        fontSize: 14,
    },
    premiumBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    premiumText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
}); 