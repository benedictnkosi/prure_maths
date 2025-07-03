import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, TextInput, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Login() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme];

  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const hasOpened = await AsyncStorage.getItem('hasOpenedApp');
        console.log('hasOpened', hasOpened);
        if (!hasOpened) {
          await AsyncStorage.setItem('hasOpenedApp', 'true');
          router.replace('/onboarding');
        }
      } catch (e) {
        // fail silently
      }
    };
    checkFirstTime();
  }, []);

  const validateInput = (input: string): { isValid: boolean; email: string } => {
    // Check if input is a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(input)) {
      return { isValid: true, email: input };
    }

    // Remove phone number validation
    return { isValid: false, email: '' };
  };

  const handleLogin = async () => {
    if (!emailOrPhone || !password) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields',
        position: 'bottom'
      });
      return;
    }

    const { isValid, email } = validateInput(emailOrPhone);
    if (!isValid) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a valid email',
        position: 'bottom'
      });
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      console.error('Login error:', error.code, error.message);

      const messages: { [key: string]: string } = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect email or password',
        'auth/invalid-credential': 'Incorrect email or password',
        'auth/too-many-requests': 'Too many attempts. Please try again later'
      };

      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: messages[error.code] || 'Invalid email or password',
        position: 'bottom'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1B1464', '#2B2F77'] : ['#FFFFFF', '#F5F5F5']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <ThemedText style={[styles.title, { color: themeColors.text }]}>➗ Dimpo Maths</ThemedText>
                <ThemedText style={[styles.subtitle, { color: themeColors.textSecondary }]}>Master Pure Maths! Start your journey today 🌟</ThemedText>
              </View>

              <View style={styles.form}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colorScheme === 'dark' ? themeColors.card : '#FAFAFA',
                      color: themeColors.text,
                      borderColor: colorScheme === 'dark' ? '#333' : '#E5E7EB',
                      borderWidth: 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.06,
                      shadowRadius: 2,
                      elevation: 2,
                    },
                  ]}
                  placeholder="Email or Phone Number"
                  placeholderTextColor={colorScheme === 'dark' ? '#94A3B8' : '#666666'}
                  value={emailOrPhone}
                  onChangeText={setEmailOrPhone}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  testID="email-input"
                  maxLength={50}
                />
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: colorScheme === 'dark' ? themeColors.card : '#FAFAFA',
                        color: themeColors.text,
                        borderColor: colorScheme === 'dark' ? '#333' : '#E5E7EB',
                        borderWidth: 1,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                        elevation: 2,
                      },
                    ]}
                    placeholder="Password"
                    placeholderTextColor={colorScheme === 'dark' ? '#94A3B8' : '#666666'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    testID="password-input"
                    maxLength={50}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    testID="toggle-password-visibility"
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={24}
                      color={colorScheme === 'dark' ? '#94A3B8' : '#666666'}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled, { backgroundColor: colorScheme === 'dark' ? '#3B82F6' : '#1B1464' }]}
                  onPress={handleLogin}
                  disabled={isLoading}
                  testID="login-button"
                >
                  <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
                    {isLoading ? 'Signing in...' : 'Start Learning →'}
                  </ThemedText>
                </TouchableOpacity>

                <View style={styles.registerContainer}>
                  <ThemedText style={[styles.helperText, { color: themeColors.textSecondary }]}>
                    New to Dimpo Maths? Join our community of math learners! 🌍
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.createAccountButton, { backgroundColor: colorScheme === 'dark' ? '#2563EB' : '#3B82F6' }]}
                    onPress={() => router.push('/onboarding')}
                    testID="create-account-button"
                  >
                    <ThemedText style={styles.createAccountButtonText}>Create an account</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.forgotPasswordContainer}>
                  <ThemedText style={[styles.helperText, { color: themeColors.textSecondary }]}>
                    Forgot your password? We'll help you get back to learning! 🔑
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => router.push('/forgot-password')}
                    testID="forgot-password-button"
                  >
                    <ThemedText style={[styles.linkText, { color: colorScheme === 'dark' ? '#60A5FA' : '#1B1464' }]}>Reset it here</ThemedText>
                  </TouchableOpacity>
                </View>

                <View style={styles.deleteAccountContainer}>
                  <TouchableOpacity
                    style={styles.deleteAccountButton}
                    onPress={() => router.push('https://examquiz.co.za/info/delete-account')}
                    testID="delete-account-button"
                  >
                    <ThemedText style={[styles.deleteAccountText, { color: '#EF4444' }]}>Delete Account</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    width: '100%',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    width: '100%',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 20,
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#1B1464',
    fontSize: 18,
    fontWeight: '600',
  },
  registerContainer: {
    marginTop: 32,
    alignItems: 'center',
    width: '100%',
  },
  createAccountButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  createAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  helperText: {
    color: '#E2E8F0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  linkButton: {
    padding: 8,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 12,
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
  deleteAccountContainer: {
    marginTop: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 24,
  },
  deleteAccountButton: {
    padding: 8,
  },
  deleteAccountText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
}); 