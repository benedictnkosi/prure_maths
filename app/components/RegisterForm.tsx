import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingData } from '../onboarding';
import { HOST_URL } from '@/config/api';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../constants/Colors';

interface RegisterFormProps {
    onboardingData: OnboardingData;
    defaultMethod?: RegistrationMethod;
}

type RegistrationMethod = 'email' | 'phone';

export default function RegisterForm({ onboardingData, defaultMethod = 'email' }: RegisterFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [registrationMethod, setRegistrationMethod] = useState<RegistrationMethod>(defaultMethod);
    const { signUp } = useAuth();
    const { isDark } = useTheme();
    const colors = isDark ? Colors.dark : Colors.light;
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const logAnalyticsEvent = async (eventName: string, params: {
        user_id: string;
        email: string;
        error?: string;
    }) => {
        console.log('Logging analytics event:', eventName, params);
    };

    const handleRegister = async () => {
        if (!name || !password || !confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please fill in all fields',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (registrationMethod === 'email' && !email) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter your email',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (password.length < 6) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Password must be at least 6 characters',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Passwords do not match',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
            return;
        }

        setIsLoading(true);
        try {
            const userEmail = registrationMethod === 'phone'
                ? `${phoneNumber}@examquiz.co.za`
                : email;

            // Register the user
            const user = await signUp(userEmail, password);

            // If we have onboarding data, update the learner profile
            if (onboardingData) {
                const learnerData = {
                    name: name,
                    email: userEmail,
                    avatar: onboardingData.avatar,
                };

                // Create new learner using the new API endpoint
                try {
                    const response = await fetch(`${HOST_URL}/public/learn/learner/create`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            uid: user.uid,
                            name: learnerData.name,
                            grade: onboardingData.grade?.toString() || "8",
                            school_name: onboardingData.school || "Default School",
                            school_address: onboardingData.school_address || "Default Address",
                            school_latitude: onboardingData.school_latitude || 0,
                            school_longitude: onboardingData.school_longitude || 0,
                            terms: "1,2,3,4", // Default terms
                            curriculum: onboardingData.curriculum || "CAPS",
                            email: learnerData.email,
                            avatar: `${learnerData.avatar}.png`
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to create learner profile');
                    }

                    const learnerResponse = await response.json();
                    console.log('Learner created:', learnerResponse);
                } catch (error) {
                    console.error('Error creating learner:', error);
                    // Don't throw here as the user is already registered
                    // Just log the error and continue
                }
            }

            // Store auth token
            await SecureStore.setItemAsync('auth', JSON.stringify({ user }));

            await logAnalyticsEvent('register_success', {
                user_id: user.uid,
                email: userEmail,
            });

            // Show success toast
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Account created successfully!',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });

            // Navigate to tabs
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Registration error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to create account',
                position: 'bottom',
                visibilityTime: 3000,
                autoHide: true,
                topOffset: 30,
                bottomOffset: 40
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateGmail = () => {
        setRegistrationMethod('phone');
    };

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <View style={[
                styles.card,
                {
                    backgroundColor: colors.card,
                    shadowColor: isDark ? '#000' : '#333',
                    shadowOpacity: isDark ? 0.5 : 0.12,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 8,
                    borderRadius: 24,
                    width: '100%',
                    maxWidth: 400,
                    padding: 28,
                },
            ]}>
                <ThemedText style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: colors.text }}>Create Account</ThemedText>
                <ThemedText style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>Join thousands of learners mastering maths step by step! 🔢</ThemedText>
                <View style={[styles.registrationMethodContainer, { backgroundColor: isDark ? '#23272F' : '#F3F4F6', marginBottom: 24 }]}> 
                    <TouchableOpacity
                        style={[
                            styles.methodButton,
                            registrationMethod === 'email' && { backgroundColor: Colors.primary }
                        ]}
                        onPress={() => setRegistrationMethod('email')}
                        activeOpacity={0.85}
                    >
                        <ThemedText style={[
                            styles.methodButtonText,
                            registrationMethod === 'email' && { color: '#fff' }
                        ]}>
                            Email
                        </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.methodButton,
                            registrationMethod === 'phone' && { backgroundColor: Colors.primary }
                        ]}
                        onPress={() => setRegistrationMethod('phone')}
                        activeOpacity={0.85}
                    >
                        <ThemedText style={[
                            styles.methodButtonText,
                            registrationMethod === 'phone' && { color: '#fff' }
                        ]}>
                            Phone
                        </ThemedText>
                    </TouchableOpacity>
                </View>
                <View style={{ marginBottom: 16 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Name</ThemedText>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: isDark ? '#18181B' : '#fff',
                                color: colors.text,
                                borderColor: focusedField === 'name' ? Colors.primary : (isDark ? '#333' : '#E5E7EB'),
                                borderWidth: 1.5,
                                shadowColor: focusedField === 'name' ? Colors.primary : 'transparent',
                                shadowOpacity: focusedField === 'name' ? 0.15 : 0,
                                shadowRadius: 6,
                            },
                        ]}
                        placeholder="Enter your name"
                        placeholderTextColor={colors.textSecondary}
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        testID="name-input"
                        maxLength={50}
                        accessibilityLabel="Full name input"
                    />
                </View>
                {registrationMethod === 'email' ? (
                    <>
                        <View style={{ marginBottom: 16 }}>
                            <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Email</ThemedText>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: isDark ? '#18181B' : '#fff',
                                        color: colors.text,
                                        borderColor: focusedField === 'email' ? Colors.primary : (isDark ? '#333' : '#E5E7EB'),
                                        borderWidth: 1.5,
                                        shadowColor: focusedField === 'email' ? Colors.primary : 'transparent',
                                        shadowOpacity: focusedField === 'email' ? 0.15 : 0,
                                        shadowRadius: 6,
                                    },
                                ]}
                                placeholder="Enter your email"
                                placeholderTextColor={colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                testID="email-input"
                                maxLength={50}
                                accessibilityLabel="Email input"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleCreateGmail}
                            style={{ marginBottom: 16, alignSelf: 'flex-end' }}
                            accessibilityLabel="Use phone number instead"
                        >
                            <ThemedText style={{ color: Colors.primary, fontSize: 14, textDecorationLine: 'underline' }}>
                                Don't have an email? Use your phone number
                            </ThemedText>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={{ marginBottom: 16 }}>
                        <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Phone Number</ThemedText>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: isDark ? '#18181B' : '#fff',
                                    color: colors.text,
                                    borderColor: focusedField === 'phone' ? Colors.primary : (isDark ? '#333' : '#E5E7EB'),
                                    borderWidth: 1.5,
                                    shadowColor: focusedField === 'phone' ? Colors.primary : 'transparent',
                                    shadowOpacity: focusedField === 'phone' ? 0.15 : 0,
                                    shadowRadius: 6,
                                },
                            ]}
                            placeholder="Enter your phone number"
                            placeholderTextColor={colors.textSecondary}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                            onFocus={() => setFocusedField('phone')}
                            onBlur={() => setFocusedField(null)}
                            testID="phone-input"
                            maxLength={10}
                            accessibilityLabel="Phone number input"
                        />
                    </View>
                )}
                <View style={{ marginBottom: 16 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Password</ThemedText>
                    <View style={{ position: 'relative' }}>
                        <TextInput
                            style={[
                                styles.input,
                                styles.passwordInput,
                                {
                                    backgroundColor: isDark ? '#18181B' : '#fff',
                                    color: colors.text,
                                    borderColor: focusedField === 'password' ? Colors.primary : (isDark ? '#333' : '#E5E7EB'),
                                    borderWidth: 1.5,
                                    shadowColor: focusedField === 'password' ? Colors.primary : 'transparent',
                                    shadowOpacity: focusedField === 'password' ? 0.15 : 0,
                                    shadowRadius: 6,
                                },
                            ]}
                            placeholder="Enter your password"
                            placeholderTextColor={colors.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            testID="password-input"
                            maxLength={50}
                            accessibilityLabel="Password input"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                            testID="toggle-password-visibility"
                        >
                            <Ionicons
                                name={showPassword ? "eye-off" : "eye"}
                                size={24}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                    <ThemedText style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Confirm Password</ThemedText>
                    <View style={{ position: 'relative' }}>
                        <TextInput
                            style={[
                                styles.input,
                                styles.passwordInput,
                                {
                                    backgroundColor: isDark ? '#18181B' : '#fff',
                                    color: colors.text,
                                    borderColor: focusedField === 'confirmPassword' ? Colors.primary : (isDark ? '#333' : '#E5E7EB'),
                                    borderWidth: 1.5,
                                    shadowColor: focusedField === 'confirmPassword' ? Colors.primary : 'transparent',
                                    shadowOpacity: focusedField === 'confirmPassword' ? 0.15 : 0,
                                    shadowRadius: 6,
                                },
                            ]}
                            placeholder="Confirm your password"
                            placeholderTextColor={colors.textSecondary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            onFocus={() => setFocusedField('confirmPassword')}
                            onBlur={() => setFocusedField(null)}
                            testID="confirm-password-input"
                            maxLength={50}
                            accessibilityLabel="Confirm password input"
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                            testID="toggle-confirm-password-visibility"
                        >
                            <Ionicons
                                name={showConfirmPassword ? "eye-off" : "eye"}
                                size={24}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
                <TouchableOpacity
                    style={[
                        styles.button,
                        {
                            backgroundColor: Colors.primary,
                            borderRadius: 16,
                            paddingVertical: 18,
                            marginTop: 8,
                            shadowColor: Colors.primary,
                            shadowOpacity: 0.18,
                            shadowRadius: 8,
                            elevation: 3,
                        },
                        isLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleRegister}
                    disabled={isLoading}
                    activeOpacity={0.85}
                    testID="register-button"
                    accessibilityLabel="Create account button"
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" testID="register-loading-indicator" />
                    ) : (
                        <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '700' }} testID="register-button-text">Create Account</ThemedText>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        // placeholder for card style, overridden inline
    },
    input: {
        borderRadius: 12,
        fontSize: 16,
        padding: 16,
        marginBottom: 0,
        marginTop: 0,
        // backgroundColor, color, borderColor, etc. are set inline
    },
    passwordInput: {
        paddingRight: 50,
        marginBottom: 0,
    },
    eyeIcon: {
        position: 'absolute',
        right: 12,
        top: 12,
        padding: 4,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    methodButton: {
        flex: 1,
        padding: 12,
        alignItems: 'center',
        borderRadius: 8,
        marginHorizontal: 2,
    },
    methodButtonText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: '600',
    },
    registrationMethodContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 4,
    },
});
