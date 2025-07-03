import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, TouchableOpacity, ScrollView, TextInput, Platform, StyleSheet, Linking, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { HOST_URL } from '@/config/api';
import { Header } from '@/components/Header';
import { UpgradeToProButton } from '../components/UpgradeToProButton';
import { Paywall } from '../components/Paywall';


interface ProfileInfo {
  name: string;
  email?: string;
  grade?: {
    id: number;
    number: number;
    active: number;
  };
  subscription?: string;
}

// Level to Grade mapping
const LEVEL_TO_GRADE: Record<number, number> = { 1: 8, 2: 9, 3: 10, 4: 11, 5: 12 };
const GRADE_TO_LEVEL: Record<number, number> = { 8: 1, 9: 2, 10: 3, 11: 4, 12: 5 };

export default function ProfileScreen() {
  const { user } = useAuth();
  const { signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [editName, setEditName] = useState('');
  const [editLevel, setEditLevel] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig] = useState<{
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({ title: '', message: '' });
  const insets = useSafeAreaInsets();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);

  const fetchLearnerData = async () => {
    try {
      const authData = await SecureStore.getItemAsync('auth');
      if (!authData) {
        throw new Error('No auth data found');
      }
      const { user } = JSON.parse(authData);

      const response = await fetch(`${HOST_URL}/public/learn/learner?uid=${user.uid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch learner data');
      }

      const learnerData = await response.json();
      console.log('Full learner data:', JSON.stringify(learnerData, null, 2));
      console.log('Grade data:', learnerData.grade);

      setProfileInfo({
        name: learnerData.name,
        email: user?.email || '',
        grade: learnerData.grade,
        subscription: learnerData.subscription || 'free',
      });
      console.log('Profile info set:', {
        name: learnerData.name,
        email: user?.email || '',
        grade: learnerData.grade,
        subscription: learnerData.subscription || 'free',
      });
      setEditName(learnerData.name);
      setEditLevel(GRADE_TO_LEVEL[learnerData.grade?.number as number] || undefined);
    } catch (error) {
      console.error('Error fetching learner data:', error);
    }
  };

  useEffect(() => {
    async function loadSoundSetting() {
      try {
        const soundSetting = await AsyncStorage.getItem('soundEnabled');
        // Default to true if no setting is stored
        setSoundEnabled(soundSetting === null ? true : soundSetting === 'true');
      } catch (error) {
        console.error('Error loading sound setting:', error);
        setSoundEnabled(true); // Default to enabled on error
      }
    }

    fetchLearnerData();
    loadSoundSetting();
  }, [user?.email]);

  const handleSave = async () => {
    await saveChanges();
  };

  const saveChanges = async () => {
    setIsSaving(true);
    console.log('saveChanges started');
    try {
      const authData = await SecureStore.getItemAsync('auth');
      if (!authData) {
        throw new Error('No auth data found');
      }
      const { user } = JSON.parse(authData);
      let updated = false;

      // Update name if changed
      if (editName.trim() && editName.trim() !== profileInfo?.name) {
        const nameBody = { name: editName.trim() };
        console.log('PATCH name:', `${HOST_URL}/api/learner/profile/${user.uid}`, nameBody);
        const response = await fetch(`${HOST_URL}/api/learner/profile/${user.uid}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(nameBody),
        });
        const respText = await response.text();
        console.log('PATCH name response:', response.status, respText);
        if (!response.ok) {
          throw new Error('Failed to update name');
        }
        updated = true;
        Toast.show({
          type: 'success',
          text1: 'Name updated successfully',
          position: 'top',
          topOffset: 60,
          visibilityTime: 2000,
          autoHide: true
        });
      }
      console.log('After name update block');

      // Update grade if changed
      console.log('Before grade update block');
      console.log('editLevel', editLevel);
      console.log('profileInfo?.grade?.number', profileInfo?.grade?.number);
      console.log('LEVEL_TO_GRADE[editLevel as number]', LEVEL_TO_GRADE[editLevel as number]);
      console.log('typeof editLevel === number:', typeof editLevel === 'number');
      console.log('LEVEL_TO_GRADE[editLevel as number] !== profileInfo?.grade?.number:', LEVEL_TO_GRADE[editLevel as number] !== profileInfo?.grade?.number);
      if (
        editLevel !== undefined &&
        LEVEL_TO_GRADE[Number(editLevel)] !== profileInfo?.grade?.number
      ) {
        console.log('Grade update condition passed');
        const gradeBody = { grade: LEVEL_TO_GRADE[Number(editLevel)] };
        console.log('PATCH grade:', `${HOST_URL}/api/learner/profile/${user.uid}`, gradeBody);
        const response = await fetch(`${HOST_URL}/api/learner/profile/${user.uid}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gradeBody),
        });
        const respText = await response.text();
        console.log('PATCH grade response:', response.status, respText);
        if (!response.ok) {
          throw new Error('Failed to update grade');
        }
        updated = true;
        
        // Clear stored selected subject when level changes
        try {
          await AsyncStorage.removeItem('lastSelectedSubject');
          console.log('Cleared stored selected subject due to level change');
        } catch (e) {
          console.error('Error clearing stored subject:', e);
        }
        
        Toast.show({
          type: 'success',
          text1: 'Level updated successfully',
          position: 'top',
          topOffset: 60,
          visibilityTime: 2000,
          autoHide: true
        });
      } else {
        console.log('Grade update condition failed');
      }

      if (updated) {
        // Refetch profile info
        const learnerRes = await fetch(`${HOST_URL}/public/learn/learner?uid=${user.uid}`);
        if (learnerRes.ok) {
          const learnerData = await learnerRes.json();
          setProfileInfo({
            name: learnerData.name,
            email: user?.email || '',
            grade: learnerData.grade,
            subscription: learnerData.subscription || 'free',
          });
          setEditName(learnerData.name);
          setEditLevel(GRADE_TO_LEVEL[learnerData.grade?.number as number] || undefined);
        }
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update profile',
        position: 'top',
        topOffset: 60,
        visibilityTime: 3000,
        autoHide: true
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to logout',
        position: 'bottom'
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid) return;

    setIsDeleting(true);
    try {
      // Mock successful deletion
      Toast.show({
        type: 'info',
        text1: 'Account deleted successfully',
        position: 'bottom'
      });

      setTimeout(async () => {
        await signOut();
      }, 3000);
    } catch (error) {
      console.error('Error deleting account:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete account',
        position: 'bottom'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSoundToggle = async (value: boolean) => {
    try {
      setSoundEnabled(value);
      await AsyncStorage.setItem('soundEnabled', value.toString());
      Toast.show({
        type: 'success',
        text1: value ? 'Sounds Enabled' : 'Sounds Disabled',
        text2: value ? 'Answer sounds are now on' : 'Answer sounds are now off',
        position: 'top',
        topOffset: 60,
        visibilityTime: 2000,
        autoHide: true
      });
    } catch (error) {
      console.error('Error saving sound setting:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save sound setting',
        position: 'top',
        topOffset: 60,
        visibilityTime: 3000,
        autoHide: true
      });
    }
  };

  console.log('Current profileInfo state:', profileInfo);

  return (
    <LinearGradient
      colors={isDark ? ['#1E1E1E', '#121212'] : ['#FFFFFF', '#F8FAFC', '#F1F5F9']}
      style={[styles.gradient, { paddingTop: insets.top }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <ScrollView
        style={styles.container}
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
      >
        <Header />

        {/* Upgrade to Pro marketing section (only for free users) */}
        {profileInfo?.subscription === 'free' && (
          <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: colors.primary }}>
              Unlock Your Full Potential!
            </ThemedText>
            <ThemedText style={{ fontSize: 15, textAlign: 'center', marginBottom: 12, color: colors.textSecondary }}>
              Upgrade to Pro for unlimited quizzes and practice. Invest in your success today!
            </ThemedText>
            <UpgradeToProButton
                style={styles.upgradeButton}
                onPress={() => {
                  setIsUpgradeLoading(true);
                  setShowPaywall(true);
                }}
                loading={isUpgradeLoading}
              />
          </View>
        )}

        <ThemedView style={styles.content}>
          <ThemedView style={[styles.profileCard, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>

            <View style={styles.editForm}>
              <View style={styles.inputGroup}>
                {/* Show PRO badge before the name label */}
                {profileInfo?.subscription && profileInfo.subscription !== 'free' && (
                  <View style={[styles.proBadgeContainer, { alignSelf: 'flex-start', marginBottom: 8 }]}> 
                    <LinearGradient
                      colors={["#FFD700", "#FFC300", "#FFB300"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.proBadge}
                    >
                      <ThemedText style={styles.proBadgeText}>
                        👑 PRO
                      </ThemedText>
                    </LinearGradient>
                  </View>
                )}
                <ThemedText style={[styles.label, { color: colors.text }]}>Name</ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: isDark ? colors.surface : '#FFFFFF',
                      borderColor: colors.border,
                      color: colors.text,
                      flex: 1
                    }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter your name"
                    placeholderTextColor={isDark ? colors.textSecondary : '#94A3B8'}
                    maxLength={50}
                  />
                </View>
                <ThemedText style={[styles.label, { color: colors.text, marginTop: 16 }]}>Level</ThemedText>
                <View style={[styles.input, { padding: 0, justifyContent: 'center' }]}>
                  <Picker
                    selectedValue={editLevel}
                    style={{ color: colors.text }}
                    onValueChange={(itemValue: number) => setEditLevel(itemValue)}
                    mode="dropdown"
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <Picker.Item key={level} label={`Level ${level}`} value={level} />
                    ))}
                  </Picker>
                </View>
                <ThemedText style={[styles.email, { color: colors.textSecondary, marginTop: 8 }]}>
                  {user?.email}
                </ThemedText>

                {/* Sound Toggle */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <ThemedText style={[styles.settingLabel, { color: colors.text }]}>Answer Sounds</ThemedText>
                    <ThemedText style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      Play sounds for correct and incorrect answers
                    </ThemedText>
                  </View>
                  <Switch
                    value={soundEnabled}
                    onValueChange={handleSoundToggle}
                    trackColor={{ false: isDark ? '#475569' : '#CBD5E1', true: colors.primary }}
                    thumbColor={soundEnabled ? '#FFFFFF' : (isDark ? '#94A3B8' : '#F1F5F9')}
                    ios_backgroundColor={isDark ? '#475569' : '#CBD5E1'}
                  />
                </View>

              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  { backgroundColor: colors.primary }
                ]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <ThemedText style={styles.buttonText}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.signOutContainer}>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: colors.border },
              ]}
              onPress={() => {
                router.replace('/(tabs)');
              }}
              disabled={isLoggingOut}
            >
              <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>
                Close
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: isDark ? '#DC2626' : '#F43F5E' },
                isLoggingOut && styles.buttonDisabled
              ]}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.deleteAccountButton,
              {
                backgroundColor: isDark ? colors.surface : '#FEE2E2',
                borderColor: '#DC2626'
              },
              isLoggingOut && styles.buttonDisabled
            ]}
            onPress={() => setShowDeleteModal(true)}
            disabled={isLoggingOut}
          >
            <ThemedText style={[styles.deleteAccountText, { color: '#DC2626' }]}>
              Delete Account
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>

      {showPaywall && (
        <Paywall
          onSuccess={() => {
            setShowPaywall(false);
            setIsUpgradeLoading(false);
            // Refresh profile data after successful upgrade
            fetchLearnerData();
          }}
          onClose={() => {
            setShowPaywall(false);
            setIsUpgradeLoading(false);
          }}
        />
      )}


      <Modal
        isVisible={showDeleteModal}
        onBackdropPress={() => setShowDeleteModal(false)}
        style={styles.modal}
      >
        <View style={[styles.confirmationModal, {
          backgroundColor: isDark ? colors.card : '#FFFFFF'
        }]}>
          <View style={styles.confirmationHeader}>
            <ThemedText style={[styles.confirmationTitle, { color: colors.text }]}>Delete Account?</ThemedText>
          </View>
          <ThemedText style={[styles.confirmationText, { color: colors.textSecondary }]}>
            This action cannot be undone. All your data will be permanently deleted.
          </ThemedText>

          <View style={styles.deleteConfirmationContainer}>
            <ThemedText style={[styles.deleteConfirmationText, { color: colors.textSecondary }]}>
              Type <ThemedText style={[styles.deleteConfirmationHighlight, { color: '#DC2626' }]}>delete</ThemedText> to confirm
            </ThemedText>
            <TextInput
              style={[styles.deleteConfirmationInput, {
                backgroundColor: isDark ? colors.surface : '#F8FAFC',
                borderColor: colors.border,
                color: colors.text
              }]}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type 'delete'"
              placeholderTextColor={isDark ? '#666666' : '#94A3B8'}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
            />
          </View>

          <View style={styles.confirmationButtons}>
            <TouchableOpacity
              style={[styles.paperButton]}
              onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
              }}
            >
              <LinearGradient
                colors={isDark ? ['#475569', '#334155'] : ['#64748B', '#475569']}
                style={styles.paperButtonGradient}
              >
                <ThemedText style={styles.paperButtonText}>Cancel</ThemedText>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paperButton,
                deleteConfirmation !== 'delete' && styles.paperButtonDisabled
              ]}
              onPress={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmation !== 'delete'}
            >
              <LinearGradient
                colors={['#DC2626', '#B91C1C']}
                style={styles.paperButtonGradient}
              >
                <ThemedText style={styles.paperButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  content: {
    backgroundColor: 'transparent',
  },
  profileCard: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileCardHeader: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
  },
  editForm: {
    width: '100%',
    gap: 16,
    marginTop: 16,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    marginVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    width: '100%',
  },
  button: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveButton: {
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutContainer: {
    padding: 20,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  confirmationHeader: {
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 8,
  },
  paperButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flex: 1,
    maxWidth: 160,
  },
  paperButtonGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  paperButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deleteAccountButton: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmationContainer: {
    marginVertical: 16,
    width: '100%',
  },
  deleteConfirmationText: {
    fontSize: 14,
    marginBottom: 8,
  },
  deleteConfirmationHighlight: {
    fontWeight: '600',
  },
  deleteConfirmationInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    width: '100%',
  },
  paperButtonDisabled: {
    opacity: 0.5,
  },
  grade: {
    fontSize: 16,
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  upgradeButton: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  proBadgeContainer: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
    minWidth: 64,
  },
  proBadgeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7c5700',
    letterSpacing: 1,
    textShadowColor: '#fffbe6',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}); 