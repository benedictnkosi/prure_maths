import React from 'react';
import Modal from 'react-native-modal';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface LifetimeQuestionsModalProps {
    isVisible: boolean;
    onContinue: () => void;
    onUpgrade: () => void;
    remainingQuestions: number;
    isDark: boolean;
    colors: any;
}

export function LifetimeQuestionsModal({ 
    isVisible, 
    onContinue, 
    onUpgrade, 
    remainingQuestions, 
    isDark, 
    colors 
}: LifetimeQuestionsModalProps) {
    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={() => {}} // Prevent dismissal by backdrop
            onBackButtonPress={() => {}} // Prevent dismissal by back button
            backdropOpacity={0.8}
            style={styles.modal}
            animationIn="fadeIn"
            animationOut="fadeOut"
            useNativeDriver={true}
            hideModalContentWhileAnimating={true}
        >
            <View style={styles.modalContainer}>
                <LinearGradient
                    colors={isDark ? ['#1E293B', '#334155'] : ['#FFFFFF', '#F8FAFC']}
                    style={styles.modalContent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                >
                    {/* Warning Icon */}
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, { backgroundColor: isDark ? '#7F1D1D' : '#FEF2F2' }]}>
                            <Ionicons name="warning" size={48} color="#DC2626" />
                        </View>
                    </View>

                    {/* Title */}
                    <ThemedText style={[styles.title, { color: colors.text }]}>
                        ⚠️ Lifetime Limit Warning
                    </ThemedText>

                    {/* Message */}
                    <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
                        You have <ThemedText style={[styles.highlight, { color: '#DC2626' }]}>{remainingQuestions}</ThemedText> lifetime questions remaining in the free version.
                    </ThemedText>

                    <ThemedText style={[styles.subMessage, { color: colors.textSecondary }]}>
                        Upgrade to Pro for unlimited access to all questions and features!
                    </ThemedText>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.continueButton, { 
                                backgroundColor: isDark ? '#334155' : '#E5E7EB',
                                borderColor: isDark ? '#475569' : '#CBD5E1'
                            }]}
                            onPress={onContinue}
                        >
                            <ThemedText style={[styles.continueButtonText, { 
                                color: isDark ? '#A7F3D0' : '#1E293B' 
                            }]}>
                                Continue with {remainingQuestions} left
                            </ThemedText>
                        </TouchableOpacity>

                        
                    </View>
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: {
        margin: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalContent: {
        padding: 32,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#DC2626',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    subMessage: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 32,
        textAlign: 'center',
    },
    highlight: {
        fontWeight: '700',
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    continueButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    upgradeButton: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
    },
    upgradeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    upgradeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
}); 